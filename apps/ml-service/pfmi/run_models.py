"""
PFMI Model Inference Runner
============================
Loads all trained models and runs predictions on a fresh batch of sensor data.
Outputs a per-machine risk dashboard to console and CSV.

Run:  python run_models.py
"""

import warnings
warnings.filterwarnings("ignore")

import sys, os, json, pickle, time
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_pfmi_fast import FleetState, build_batch

# ──────────────────────────────────────────────────────────────────────────────
# 1. LOAD MODELS & ARTIFACTS
# ──────────────────────────────────────────────────────────────────────────────

print("=" * 70)
print("PFMI MODEL INFERENCE RUNNER")
print("=" * 70)

MODELS_DIR = Path("models")

def load(name):
    with open(MODELS_DIR / name, "rb") as f:
        return pickle.load(f)

print("\n[1/4] Loading models...")
rf_24h     = load("rf_failure_24h.pkl")
xgb_24h    = load("xgb_failure_24h.pkl")
rf_7d      = load("rf_failure_7d.pkl")
xgb_type   = load("xgb_failure_type.pkl")
imputer    = load("imputer.pkl")
scaler     = load("scaler.pkl")
le_encoders= load("label_encoders.pkl")
le_type    = load("label_encoder_type.pkl")

with open(MODELS_DIR / "model_meta.json") as f:
    meta = json.load(f)

FEATURE_NAMES  = meta["feature_names"]
FAILURE_CLASSES= meta["failure_type_classes"]

print(f"     Models loaded: rf_24h, xgb_24h, rf_7d, xgb_type")
print(f"     Expected features : {len(FEATURE_NAMES)}")
print(f"     Failure classes   : {FAILURE_CLASSES}")

# ──────────────────────────────────────────────────────────────────────────────
# 2. GENERATE FRESH INFERENCE DATA (new machines, mix of healthy & worn)
# ──────────────────────────────────────────────────────────────────────────────

print("\n[2/4] Generating fresh inference batch (10 machines x 5 readings each)...")

N_MACHINES = 10
rng = np.random.default_rng(999)   # different seed from training

fleet = FleetState(N_MACHINES, seed=999)

# Set up a varied fleet:
#   Machines 1-3  : healthy / new
#   Machines 4-6  : mid-life, moderate wear
#   Machines 7-8  : heavily worn, failure imminent
#   Machines 9-10 : post-maintenance (recently serviced)

# Machine 0-2: healthy
fleet.bearing_wear[:3]   = rng.uniform(0.0, 0.2,  3)
fleet.pump_health[:3]    = rng.uniform(0.85,1.0,  3)
fleet.cooling_health[:3] = rng.uniform(0.85,1.0,  3)
fleet.brake_health[:3]   = rng.uniform(0.85,1.0,  3)
fleet.tire_wear[:3]      = rng.uniform(0.0, 0.2,  (3,4))
fleet.eng_hours[:3]      = rng.uniform(500, 3000, 3)

# Machine 3-5: moderate wear
fleet.bearing_wear[3:6]   = rng.uniform(0.30, 0.50, 3)
fleet.pump_health[3:6]    = rng.uniform(0.55, 0.70, 3)
fleet.cooling_health[3:6] = rng.uniform(0.55, 0.70, 3)
fleet.brake_health[3:6]   = rng.uniform(0.55, 0.70, 3)
fleet.tire_wear[3:6]      = rng.uniform(0.30, 0.55, (3,4))
fleet.eng_hours[3:6]      = rng.uniform(8000, 13000, 3)

# Machine 6-7: critically worn — failures imminent
fleet.bearing_wear[6:8]   = rng.uniform(0.75, 0.92, 2)
fleet.pump_health[6:8]    = rng.uniform(0.10, 0.30, 2)
fleet.cooling_health[6:8] = rng.uniform(0.10, 0.28, 2)
fleet.brake_health[6:8]   = rng.uniform(0.12, 0.30, 2)
fleet.tire_wear[6:8]      = rng.uniform(0.75, 0.95, (2,4))
fleet.eng_hours[6:8]      = rng.uniform(18000,24000,2)

# Force-inject active failure arcs so the sensor readings carry degradation signals
from generate_pfmi_fast import FAILURE_TYPES, FAILURE_WINDOWS_H
# Machine 7 (index 6): Hydraulic Pump Failure, 8h before failure
fi_hpf = FAILURE_TYPES.index("Hydraulic Pump Failure")
fleet.active_fail_idx[6] = fi_hpf
fleet.fail_countdown[6]  = 8.0    # 8 hours left
fleet.fail_severity[6]   = 1.0 - 8.0 / FAILURE_WINDOWS_H["Hydraulic Pump Failure"]

# Machine 8 (index 7): Bearing Wear, 18h before failure
fi_bw = FAILURE_TYPES.index("Bearing Wear")
fleet.active_fail_idx[7] = fi_bw
fleet.fail_countdown[7]  = 18.0   # 18 hours left
fleet.fail_severity[7]   = 1.0 - 18.0 / FAILURE_WINDOWS_H["Bearing Wear"]

# Machine 8-9: recently serviced (reset degradation)
fleet.bearing_wear[8:]    = rng.uniform(0.0, 0.05, 2)
fleet.pump_health[8:]     = rng.uniform(0.90, 1.0,  2)
fleet.cooling_health[8:]  = rng.uniform(0.90, 1.0,  2)
fleet.brake_health[8:]    = rng.uniform(0.90, 1.0,  2)
fleet.tire_wear[8:]       = rng.uniform(0.0, 0.10,  (2,4))
fleet.svc_days[8:]        = rng.uniform(0, 5, 2)
fleet.svc_hours[8:]       = rng.uniform(0, 20, 2)
fleet.eng_hours[8:]       = rng.uniform(12000, 15000, 2)  # high hours but just serviced

# Collect 5 readings per machine (25 total steps across 5 cycles)
READINGS_PER_MACHINE = 5
raw_batches = []
for _ in range(READINGS_PER_MACHINE):
    fleet.step(5)
    raw_batches.append(build_batch(fleet, 5))

raw_df = pd.concat(raw_batches, ignore_index=True)
print(f"     Raw batch shape: {raw_df.shape}")

# ──────────────────────────────────────────────────────────────────────────────
# 3. PREPROCESS  (mirror training pipeline exactly)
# ──────────────────────────────────────────────────────────────────────────────

print("\n[3/4] Preprocessing inference data...")

DROP = [
    "Serial_Number", "Firmware_Version",
    "Latitude", "Longitude",
    "Active_DTC", "Error_Code", "Warning_Level",
    "Maintenance_Action", "Remaining_Useful_Life",
    "Failure_Within_24h", "Failure_Within_7d", "Failure_Type",
]
feat = raw_df.drop(columns=[c for c in DROP if c in raw_df.columns]).copy()

# Timestamp cyclical features
ts = pd.to_datetime(raw_df["Timestamp"])
feat["Hour_sin"]  = np.sin(2 * np.pi * ts.dt.hour  / 24)
feat["Hour_cos"]  = np.cos(2 * np.pi * ts.dt.hour  / 24)
feat["Month_sin"] = np.sin(2 * np.pi * ts.dt.month / 12)
feat["Month_cos"] = np.cos(2 * np.pi * ts.dt.month / 12)
feat["DayOfWeek"] = ts.dt.dayofweek.astype(float)

# Encode categoricals with saved encoders
for col, le in le_encoders.items():
    if col in feat.columns:
        known = set(le.classes_)
        feat[col] = feat[col].astype(str).apply(
            lambda v: v if v in known else le.classes_[0])
        feat[col] = le.transform(feat[col])

# Rolling features (sorted by machine)
ROLL_COLS = [
    "Overall_Vibration", "Bearing_Vibration", "Coolant_Temperature",
    "Hydraulic_Pressure", "Oil_Pressure", "Turbo_Boost",
    "Pump_Efficiency", "Ultrasonic_Emission",
]
feat = feat.sort_values("Machine_ID").reset_index(drop=True)
raw_df_sorted = raw_df.sort_values("Machine_ID").reset_index(drop=True)

for col in ROLL_COLS:
    if col not in feat.columns:
        continue
    grp = feat.groupby("Machine_ID")[col]
    feat[f"{col}_r12m"] = grp.transform(lambda x: x.rolling(12, min_periods=1).mean())
    feat[f"{col}_r12s"] = grp.transform(lambda x: x.rolling(12, min_periods=1).std().fillna(0))
    feat[f"{col}_d1"]   = grp.transform(lambda x: x.diff().fillna(0))

if "Turbo_Boost" in feat and "Engine_Load" in feat:
    feat["Turbo_Load_Ratio"] = feat["Turbo_Boost"] / feat["Engine_Load"].clip(lower=0.01)

tp = ["Tire_Pressure_FL","Tire_Pressure_FR","Tire_Pressure_RL","Tire_Pressure_RR"]
if all(c in feat.columns for c in tp):
    feat["Tire_P_Imbalance"] = feat[tp].max(axis=1) - feat[tp].min(axis=1)

# Align to exact training feature list
X_inf = feat.reindex(columns=FEATURE_NAMES).select_dtypes(include=[np.number])
X_inf = X_inf.reindex(columns=FEATURE_NAMES, fill_value=0)

# Impute + scale with training transformers
X_proc = scaler.transform(imputer.transform(X_inf.values))
print(f"     Processed shape: {X_proc.shape}")

# ──────────────────────────────────────────────────────────────────────────────
# 4. RUN PREDICTIONS
# ──────────────────────────────────────────────────────────────────────────────

print("\n[4/4] Running predictions...")

prob_24h_rf  = rf_24h.predict_proba(X_proc)[:, 1]
prob_24h_xgb = xgb_24h.predict_proba(X_proc)[:, 1]
prob_7d      = rf_7d.predict_proba(X_proc)[:, 1]
pred_type    = xgb_type.predict(X_proc)
type_labels  = le_type.inverse_transform(pred_type.astype(int))

# Ensemble 24h probability (average RF + XGB)
prob_24h_ens = (prob_24h_rf + prob_24h_xgb) / 2

# Risk tier
def risk_tier(p24, p7d):
    if p24 >= 0.70:  return "CRITICAL"
    if p24 >= 0.35:  return "HIGH"
    if p7d >= 0.60:  return "MEDIUM"
    if p7d >= 0.25:  return "LOW"
    return "OK"

# Ground truth labels from raw data
gt_24h  = raw_df_sorted["Failure_Within_24h"].values
gt_7d   = raw_df_sorted["Failure_Within_7d"].values
gt_type = raw_df_sorted["Failure_Type"].values
gt_rul  = raw_df_sorted["Remaining_Useful_Life"].values

# ── Build results DataFrame ───────────────────────────────────────────────────
results = pd.DataFrame({
    "Machine_ID":       raw_df_sorted["Machine_ID"].values,
    "Manufacturer":     raw_df_sorted["Manufacturer"].values,
    "Model":            raw_df_sorted["Model"].values,
    "Engine_Hours":     raw_df_sorted["Engine_Hours"].values.round(0).astype(int),
    "Reading_#":        feat.groupby("Machine_ID").cumcount().values + 1,
    "Timestamp":        raw_df_sorted["Timestamp"].values,
    "Working_Mode":     raw_df_sorted["Working_Mode"].values,
    # Sensor snapshot
    "Coolant_Temp":     raw_df_sorted["Coolant_Temperature"].values.round(1),
    "Oil_Pressure":     raw_df_sorted["Oil_Pressure"].values.round(0),
    "Hydraulic_P":      raw_df_sorted["Hydraulic_Pressure"].values.round(0),
    "Bearing_Vib":      raw_df_sorted["Bearing_Vibration"].values.round(3),
    "Pump_Eff":         raw_df_sorted["Pump_Efficiency"].values.round(3),
    "Turbo_Boost":      raw_df_sorted["Turbo_Boost"].values.round(2),
    # Predictions
    "P(Fail_24h)_RF":   prob_24h_rf.round(4),
    "P(Fail_24h)_XGB":  prob_24h_xgb.round(4),
    "P(Fail_24h)_ENS":  prob_24h_ens.round(4),
    "P(Fail_7d)_RF":    prob_7d.round(4),
    "Pred_Failure_Type":type_labels,
    "Risk_Tier":        [risk_tier(p24, p7) for p24, p7 in zip(prob_24h_ens, prob_7d)],
    # Ground truth
    "GT_Fail_24h":      gt_24h,
    "GT_Fail_7d":       gt_7d,
    "GT_Failure_Type":  gt_type,
    "GT_RUL_Hours":     gt_rul,
})

# ──────────────────────────────────────────────────────────────────────────────
# CONSOLE OUTPUT
# ──────────────────────────────────────────────────────────────────────────────

TIER_COLOR = {"CRITICAL": "!!!", "HIGH": ">> ", "MEDIUM": ">  ", "LOW": "   ", "OK": "   "}

print()
print("=" * 70)
print("PER-READING PREDICTIONS")
print("=" * 70)
print(f"{'M':<3} {'R':<2} {'Manufacturer+Model':<20} {'Hrs':>5}  "
      f"{'CT':>5} {'OP':>5} {'BVib':>6} {'PE':>6}  "
      f"{'P24h':>6} {'P7d':>5}  {'Risk':<8}  {'Pred Type':<22}  {'GT Type'}")
print("-" * 125)

for _, row in results.iterrows():
    flag = TIER_COLOR.get(row["Risk_Tier"], "   ")
    gt_match = "OK" if row["Pred_Failure_Type"] == row["GT_Failure_Type"] else "!!"
    rul_str = f"{row['GT_RUL_Hours']:.0f}h" if pd.notna(row["GT_RUL_Hours"]) else "  - "
    print(
        f"{flag}{int(row['Machine_ID']):<2} #{int(row['Reading_#'])}  "
        f"{row['Manufacturer'][:8]+' '+row['Model']:<20} {int(row['Engine_Hours']):>5}  "
        f"{row['Coolant_Temp']:>5.1f} {row['Oil_Pressure']:>5.0f} {row['Bearing_Vib']:>6.3f} {row['Pump_Eff']:>6.3f}  "
        f"{row['P(Fail_24h)_ENS']:>6.3f} {row['P(Fail_7d)_RF']:>5.3f}  "
        f"{row['Risk_Tier']:<8}  {row['Pred_Failure_Type']:<22}  {row['GT_Failure_Type']}  [{rul_str}]"
    )

# ── Per-machine aggregate risk summary ───────────────────────────────────────
print()
print("=" * 70)
print("PER-MACHINE RISK SUMMARY  (aggregated over 5 readings)")
print("=" * 70)

machine_profiles = {
    1: "HEALTHY",   2: "HEALTHY",   3: "HEALTHY",
    4: "MODERATE",  5: "MODERATE",  6: "MODERATE",
    7: "CRITICAL",  8: "CRITICAL",
    9: "SERVICED",  10: "SERVICED",
}

agg = results.groupby("Machine_ID").agg(
    Manufacturer    = ("Manufacturer", "first"),
    Model           = ("Model", "first"),
    Engine_Hours    = ("Engine_Hours", "first"),
    MaxP_24h        = ("P(Fail_24h)_ENS", "max"),
    MeanP_24h       = ("P(Fail_24h)_ENS", "mean"),
    MaxP_7d         = ("P(Fail_7d)_RF", "max"),
    PeakRisk        = ("Risk_Tier", lambda x: x.value_counts().index[0]),
    PredType        = ("Pred_Failure_Type",
                       lambda x: x[x != "No Failure"].mode()[0]
                                 if (x != "No Failure").any() else "No Failure"),
    GT_Type         = ("GT_Failure_Type",
                       lambda x: x[x != "No Failure"].mode()[0]
                                 if (x != "No Failure").any() else "No Failure"),
    GT_RUL_min      = ("GT_RUL_Hours", "min"),
).reset_index()

TIER_RANK = {"CRITICAL":4,"HIGH":3,"MEDIUM":2,"LOW":1,"OK":0}
agg = agg.sort_values("MaxP_24h", ascending=False)

print(f"\n{'M':<3} {'Make+Model':<20} {'Hrs':>6}  {'Profile':<10}  "
      f"{'Max P24h':>8}  {'Max P7d':>7}  {'Peak Risk':<9}  "
      f"{'Pred Failure Type':<22}  {'GT Type':<22}  {'Min RUL'}")
print("-" * 120)
for _, row in agg.iterrows():
    mid  = int(row["Machine_ID"])
    prof = machine_profiles.get(mid, "?")
    rul  = f"{row['GT_RUL_min']:.0f}h" if pd.notna(row["GT_RUL_min"]) else "—"
    flag = TIER_COLOR.get(row["PeakRisk"], "   ")
    print(
        f"{flag}{mid:<2}  {row['Manufacturer'][:8]+' '+row['Model']:<20} "
        f"{int(row['Engine_Hours']):>6}  {prof:<10}  "
        f"{row['MaxP_24h']:>8.4f}  {row['MaxP_7d']:>7.4f}  "
        f"{row['PeakRisk']:<9}  {row['PredType']:<22}  "
        f"{row['GT_Type']:<22}  {rul}"
    )

# ── Accuracy summary ──────────────────────────────────────────────────────────
print()
print("=" * 70)
print("PREDICTION ACCURACY vs GROUND TRUTH")
print("=" * 70)

pred_24h_binary = (prob_24h_ens >= 0.35).astype(int)
pred_7d_binary  = (prob_7d      >= 0.35).astype(int)

from sklearn.metrics import classification_report, confusion_matrix

tp24 = ((pred_24h_binary == 1) & (gt_24h == 1)).sum()
fp24 = ((pred_24h_binary == 1) & (gt_24h == 0)).sum()
tn24 = ((pred_24h_binary == 0) & (gt_24h == 0)).sum()
fn24 = ((pred_24h_binary == 0) & (gt_24h == 1)).sum()

tp7d = ((pred_7d_binary == 1) & (gt_7d == 1)).sum()
fp7d = ((pred_7d_binary == 1) & (gt_7d == 0)).sum()
tn7d = ((pred_7d_binary == 0) & (gt_7d == 0)).sum()
fn7d = ((pred_7d_binary == 0) & (gt_7d == 1)).sum()

print(f"\n  Threshold: P >= 0.35 => predict FAILURE")
print()
print(f"  {'Metric':<30} {'24h Model':>12}  {'7d Model':>12}")
print(f"  {'-'*58}")
print(f"  {'True Positives (caught failures)':<30} {tp24:>12}  {tp7d:>12}")
print(f"  {'False Positives (false alarms)':<30} {fp24:>12}  {fp7d:>12}")
print(f"  {'True Negatives (correct OK)':<30} {tn24:>12}  {tn7d:>12}")
print(f"  {'False Negatives (missed failures)':<30} {fn24:>12}  {fn7d:>12}")

prec24 = tp24/(tp24+fp24) if (tp24+fp24)>0 else 0
rec24  = tp24/(tp24+fn24) if (tp24+fn24)>0 else 0
f1_24  = 2*prec24*rec24/(prec24+rec24) if (prec24+rec24)>0 else 0

prec7d = tp7d/(tp7d+fp7d) if (tp7d+fp7d)>0 else 0
rec7d  = tp7d/(tp7d+fn7d) if (tp7d+fn7d)>0 else 0
f1_7d  = 2*prec7d*rec7d/(prec7d+rec7d) if (prec7d+rec7d)>0 else 0

print()
print(f"  {'Precision':<30} {prec24:>12.4f}  {prec7d:>12.4f}")
print(f"  {'Recall':<30} {rec24:>12.4f}  {rec7d:>12.4f}")
print(f"  {'F1 Score':<30} {f1_24:>12.4f}  {f1_7d:>12.4f}")

type_acc = (type_labels == gt_type).mean()
type_no_fail_mask = gt_type != "No Failure"
type_fault_acc = (type_labels[type_no_fail_mask] == gt_type[type_no_fail_mask]).mean() \
    if type_no_fail_mask.sum() > 0 else 0

print()
print(f"  {'Failure Type Accuracy (all)':<30} {type_acc:>12.4f}")
print(f"  {'Failure Type Acc (faults only)':<30} {type_fault_acc:>12.4f}  "
      f"(n={type_no_fail_mask.sum()})")

# ── Maintenance action recommendations ───────────────────────────────────────
print()
print("=" * 70)
print("MAINTENANCE DISPATCH RECOMMENDATIONS")
print("=" * 70)

def recommend(p24, p7d, pred_type, eng_hours):
    if p24 >= 0.70:
        return f"STOP IMMEDIATELY — {pred_type} predicted. Dispatch technician now."
    if p24 >= 0.35:
        return f"URGENT (< 24h) — {pred_type} risk. Schedule today."
    if p7d >= 0.60:
        return f"HIGH PRIORITY (< 7d) — {pred_type} developing. Schedule this week."
    if p7d >= 0.25:
        return f"MONITOR — rising indicators. Next PM at earliest."
    return "OK — continue operation."

for _, row in agg.iterrows():
    mid = int(row["Machine_ID"])
    rec = recommend(row["MaxP_24h"], row["MaxP_7d"],
                    row["PredType"], int(row["Engine_Hours"]))
    print(f"  Machine {mid:>2} ({row['Manufacturer']} {row['Model']}, "
          f"{int(row['Engine_Hours'])}h):  {rec}")

# ── Save outputs ─────────────────────────────────────────────────────────────
Path("output").mkdir(exist_ok=True)
results.to_csv("output/inference_results.csv", index=False)
agg.to_csv("output/machine_risk_summary.csv", index=False)

print()
print("=" * 70)
print("Saved:")
print("  output/inference_results.csv    — per-reading predictions")
print("  output/machine_risk_summary.csv — per-machine risk dashboard")
print("=" * 70)
