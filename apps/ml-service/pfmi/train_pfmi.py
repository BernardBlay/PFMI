"""
PFMI Training Pipeline
======================
1. Generates 5,000 rows of synthetic wheel loader sensor data
2. Preprocesses features (encoding, scaling, rolling stats)
3. Trains four models:
     A. Random Forest        — Failure_Within_24h (binary)
     B. XGBoost              — Failure_Within_24h (binary)
     C. XGBoost              — Failure_Type       (12-class)
     D. Random Forest        — Failure_Within_7d  (binary)
4. Evaluates on a held-out test split
5. Saves models + results to  models/

Run:  python train_pfmi.py
"""

import warnings
warnings.filterwarnings("ignore")

import sys, os, time, json, pickle
import numpy as np
import pandas as pd
from pathlib import Path

# ── 0. Imports ────────────────────────────────────────────────────────────────
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, RobustScaler
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, f1_score, precision_score, recall_score,
)
from sklearn.impute import SimpleImputer

try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:
    from sklearn.ensemble import GradientBoostingClassifier
    HAS_XGB = False
    print("[INFO] xgboost not found — using GradientBoostingClassifier")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_pfmi_fast import FleetState, build_batch

# ──────────────────────────────────────────────────────────────────────────────
# 1. GENERATE 5,000 ROWS
# ──────────────────────────────────────────────────────────────────────────────

print("=" * 65)
print("PFMI TRAINING PIPELINE")
print("=" * 65)

N_ROWS     = 5000
N_MACHINES = 120
SEED       = 42

print(f"\n[1/5] Generating {N_ROWS:,} rows (pre-worn fleet for failure variety)...")
t0 = time.time()

rng_init = np.random.default_rng(SEED)
fleet = FleetState(N_MACHINES, seed=SEED)

# Force-age every other machine so failures appear across the sample
worn = np.arange(0, N_MACHINES, 2)
fleet.bearing_wear[worn]   = rng_init.uniform(0.56, 0.83, len(worn))
fleet.pump_health[worn]    = rng_init.uniform(0.20, 0.44, len(worn))
fleet.turbo_health[worn]   = rng_init.uniform(0.25, 0.48, len(worn))
fleet.trans_health[worn]   = rng_init.uniform(0.20, 0.42, len(worn))
fleet.cooling_health[worn] = rng_init.uniform(0.20, 0.45, len(worn))
fleet.brake_health[worn]   = rng_init.uniform(0.22, 0.42, len(worn))
fleet.tire_wear[worn]      = rng_init.uniform(0.62, 0.88, (len(worn), 4))
fleet.eng_hours[worn]      = rng_init.uniform(14000, 22000, len(worn))

steps = (N_ROWS // N_MACHINES) + 2
batches = []
for _ in range(steps):
    fleet.step(5)
    batches.append(build_batch(fleet, 5))

df = pd.concat(batches, ignore_index=True).iloc[:N_ROWS].copy()

Path("output").mkdir(exist_ok=True)
df.to_csv("output/pfmi_5000_raw.csv", index=False)

gen_time = time.time() - t0
print(f"     Generated {len(df):,} rows in {gen_time:.1f}s")
print(f"     Failure_Within_24h : {df['Failure_Within_24h'].mean()*100:.1f}%  "
      f"({df['Failure_Within_24h'].sum()} positive)")
print(f"     Failure_Within_7d  : {df['Failure_Within_7d'].mean()*100:.1f}%  "
      f"({df['Failure_Within_7d'].sum()} positive)")
print(f"     Failure types seen : {df['Failure_Type'].nunique()} distinct classes")
print(f"     Saved -> output/pfmi_5000_raw.csv")

# ──────────────────────────────────────────────────────────────────────────────
# 2. PREPROCESSING
# ──────────────────────────────────────────────────────────────────────────────

print("\n[2/5] Preprocessing...")

# ── Drop leakage / identifier columns ────────────────────────────────────────
DROP = [
    "Serial_Number", "Firmware_Version", "Timestamp",
    "Latitude", "Longitude",
    "Active_DTC", "Error_Code", "Warning_Level",   # derived from label — leakage
    "Maintenance_Action",                           # derived label
    "Remaining_Useful_Life",                        # regression target
]
feat = df.drop(columns=[c for c in DROP if c in df.columns]).copy()

# ── Timestamp cyclical features ───────────────────────────────────────────────
ts = pd.to_datetime(df["Timestamp"])
feat["Hour_sin"]  = np.sin(2 * np.pi * ts.dt.hour   / 24)
feat["Hour_cos"]  = np.cos(2 * np.pi * ts.dt.hour   / 24)
feat["Month_sin"] = np.sin(2 * np.pi * ts.dt.month  / 12)
feat["Month_cos"] = np.cos(2 * np.pi * ts.dt.month  / 12)
feat["DayOfWeek"] = ts.dt.dayofweek.astype(float)

# ── Label-encode all object columns ──────────────────────────────────────────
label_encoders = {}
for col in feat.select_dtypes("object").columns:
    le = LabelEncoder()
    feat[col] = le.fit_transform(feat[col].astype(str))
    label_encoders[col] = le

# ── Rolling features (vectorised per machine via numpy groupby) ───────────────
ROLL_COLS = [
    "Overall_Vibration", "Bearing_Vibration", "Coolant_Temperature",
    "Hydraulic_Pressure", "Oil_Pressure", "Turbo_Boost",
    "Pump_Efficiency", "Ultrasonic_Emission",
]
WINDOW = 12   # 12 × 5 min = 1 hour

feat_sorted = feat.sort_values("Machine_ID").reset_index(drop=True)
for col in ROLL_COLS:
    if col not in feat_sorted.columns:
        continue
    grp = feat_sorted.groupby("Machine_ID")[col]
    feat_sorted[f"{col}_r12m"] = grp.transform(
        lambda x: x.rolling(WINDOW, min_periods=1).mean())
    feat_sorted[f"{col}_r12s"] = grp.transform(
        lambda x: x.rolling(WINDOW, min_periods=1).std().fillna(0))
    feat_sorted[f"{col}_d1"]   = grp.transform(lambda x: x.diff().fillna(0))

# ── Derived ratios ────────────────────────────────────────────────────────────
if "Turbo_Boost" in feat_sorted and "Engine_Load" in feat_sorted:
    feat_sorted["Turbo_Load_Ratio"] = (
        feat_sorted["Turbo_Boost"] /
        feat_sorted["Engine_Load"].clip(lower=0.01))

tp = ["Tire_Pressure_FL","Tire_Pressure_FR","Tire_Pressure_RL","Tire_Pressure_RR"]
if all(c in feat_sorted.columns for c in tp):
    feat_sorted["Tire_P_Imbalance"] = (
        feat_sorted[tp].max(axis=1) - feat_sorted[tp].min(axis=1))

# ── Extract labels ────────────────────────────────────────────────────────────
y_24h  = feat_sorted.pop("Failure_Within_24h")
y_7d   = feat_sorted.pop("Failure_Within_7d")

# Failure_Type label (from original df, aligned by sort)
type_vals = df.loc[feat_sorted.index, "Failure_Type"].values \
    if "Failure_Type" in df.columns else \
    df["Failure_Type"].values[feat_sorted.index]
feat_sorted.drop(columns=["Failure_Type"], errors="ignore", inplace=True)

le_type     = LabelEncoder()
y_type_enc  = le_type.fit_transform(type_vals)

# ── Numeric feature matrix ────────────────────────────────────────────────────
X = feat_sorted.select_dtypes(include=[np.number])
feature_names = X.columns.tolist()

print(f"     Feature matrix : {X.shape[0]:,} rows × {X.shape[1]} features")
print(f"     Positive 24h   : {y_24h.sum()} ({y_24h.mean()*100:.1f}%)")
print(f"     Positive 7d    : {y_7d.sum()} ({y_7d.mean()*100:.1f}%)")
print(f"     Failure classes: {list(le_type.classes_)}")

# ── Time-ordered train / test split (80/20) ──────────────────────────────────
CUT = int(len(X) * 0.80)
X_tr,  X_te  = X.iloc[:CUT].values,  X.iloc[CUT:].values
y24_tr, y24_te = y_24h.iloc[:CUT].values, y_24h.iloc[CUT:].values
y7d_tr, y7d_te = y_7d.iloc[:CUT].values,  y_7d.iloc[CUT:].values
yty_tr, yty_te = y_type_enc[:CUT],         y_type_enc[CUT:]

print(f"     Train / Test   : {len(X_tr):,} / {len(X_te):,} (time-ordered)")

# ── Impute + scale ────────────────────────────────────────────────────────────
imputer = SimpleImputer(strategy="median")
scaler  = RobustScaler()
X_tr = scaler.fit_transform(imputer.fit_transform(X_tr))
X_te = scaler.transform(imputer.transform(X_te))

# ──────────────────────────────────────────────────────────────────────────────
# HELPER: evaluate binary classifier
# ──────────────────────────────────────────────────────────────────────────────

def eval_binary(model, X_test, y_test, name, target):
    pred = model.predict(X_test)
    prob = model.predict_proba(X_test)[:, 1]
    f1   = f1_score(y_test, pred, zero_division=0)
    rec  = recall_score(y_test, pred, zero_division=0)
    pre  = precision_score(y_test, pred, zero_division=0)
    try:
        auc = roc_auc_score(y_test, prob)
    except Exception:
        auc = float("nan")
    print(f"       F1={f1:.4f}  Prec={pre:.4f}  Recall={rec:.4f}  AUC={auc:.4f}")
    return pred, prob, {"model": name, "target": target,
                        "f1": round(f1,4), "precision": round(pre,4),
                        "recall": round(rec,4),
                        "roc_auc": None if np.isnan(auc) else round(auc,4)}

# ──────────────────────────────────────────────────────────────────────────────
# 3. TRAIN MODELS
# ──────────────────────────────────────────────────────────────────────────────

print("\n[3/5] Training models...")
results = {}

pos24 = y24_tr.sum()
neg24 = len(y24_tr) - pos24
scale24 = max(1.0, neg24 / max(pos24, 1))

pos7d = y7d_tr.sum()
neg7d = len(y7d_tr) - pos7d
scale7d = max(1.0, neg7d / max(pos7d, 1))

# ── A: Random Forest — 24h ───────────────────────────────────────────────────
print("\n  [A] Random Forest — Failure_Within_24h")
t1 = time.time()
rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=14,
    min_samples_leaf=3,
    class_weight={0: 1.0, 1: scale24},
    random_state=SEED,
    n_jobs=1,          # n_jobs=1 avoids Windows multiprocessing hangs
)
rf.fit(X_tr, y24_tr)
print(f"       Trained in {time.time()-t1:.1f}s")
pred_rf, prob_rf, res_rf = eval_binary(rf, X_te, y24_te, "RandomForest", "Failure_Within_24h")
res_rf["train_sec"] = round(time.time()-t1, 2)
results["A_RF_24h"] = res_rf

fi_rf = pd.Series(rf.feature_importances_, index=feature_names).sort_values(ascending=False)
print(f"       Top 5: {', '.join(fi_rf.head(5).index.tolist())}")

# ── B: XGBoost — 24h ─────────────────────────────────────────────────────────
algo = "XGBoost" if HAS_XGB else "GradientBoosting"
print(f"\n  [B] {algo} — Failure_Within_24h")
t2 = time.time()
if HAS_XGB:
    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale24,
        eval_metric="logloss",
        random_state=SEED,
        nthread=1,
        verbosity=0,
    )
    xgb.fit(X_tr, y24_tr)
else:
    from sklearn.ensemble import GradientBoostingClassifier
    xgb = GradientBoostingClassifier(
        n_estimators=150, max_depth=5, learning_rate=0.08,
        subsample=0.8, random_state=SEED,
    )
    xgb.fit(X_tr, y24_tr)

print(f"       Trained in {time.time()-t2:.1f}s")
pred_xgb, prob_xgb, res_xgb = eval_binary(xgb, X_te, y24_te, algo, "Failure_Within_24h")
res_xgb["train_sec"] = round(time.time()-t2, 2)
results[f"B_{algo}_24h"] = res_xgb

fi_xgb = pd.Series(xgb.feature_importances_, index=feature_names).sort_values(ascending=False)
print(f"       Top 5: {', '.join(fi_xgb.head(5).index.tolist())}")

# ── C: XGBoost — Failure_Type (multi-class) ──────────────────────────────────
print(f"\n  [C] {algo} — Failure_Type ({len(le_type.classes_)} classes)")
t3 = time.time()
n_cls = len(le_type.classes_)
if HAS_XGB:
    xgb_type = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="multi:softmax",
        num_class=n_cls,
        eval_metric="mlogloss",
        random_state=SEED,
        nthread=1,
        verbosity=0,
    )
else:
    from sklearn.ensemble import GradientBoostingClassifier
    xgb_type = GradientBoostingClassifier(
        n_estimators=150, max_depth=5, learning_rate=0.08,
        subsample=0.8, random_state=SEED,
    )
xgb_type.fit(X_tr, yty_tr)
dt3 = time.time() - t3
print(f"       Trained in {dt3:.1f}s")

pred_ty = xgb_type.predict(X_te)
acc_ty  = (pred_ty == yty_te).mean()
f1_mac  = f1_score(yty_te, pred_ty, average="macro",    zero_division=0)
f1_wt   = f1_score(yty_te, pred_ty, average="weighted", zero_division=0)
print(f"       Accuracy={acc_ty:.4f}  F1-macro={f1_mac:.4f}  F1-weighted={f1_wt:.4f}")
results[f"C_{algo}_Type"] = {
    "model": algo, "target": "Failure_Type",
    "accuracy": round(float(acc_ty),4), "f1_macro": round(f1_mac,4),
    "f1_weighted": round(f1_wt,4), "n_classes": n_cls,
    "classes": le_type.classes_.tolist(), "train_sec": round(dt3,2),
}

# ── D: Random Forest — 7d ────────────────────────────────────────────────────
print("\n  [D] Random Forest — Failure_Within_7d")
t4 = time.time()
rf7d = RandomForestClassifier(
    n_estimators=200,
    max_depth=14,
    min_samples_leaf=3,
    class_weight={0: 1.0, 1: scale7d},
    random_state=SEED,
    n_jobs=1,
)
rf7d.fit(X_tr, y7d_tr)
print(f"       Trained in {time.time()-t4:.1f}s")
pred_7d, prob_7d, res_7d = eval_binary(rf7d, X_te, y7d_te, "RandomForest", "Failure_Within_7d")
res_7d["train_sec"] = round(time.time()-t4, 2)
results["D_RF_7d"] = res_7d

# ──────────────────────────────────────────────────────────────────────────────
# 4. DETAILED EVALUATION
# ──────────────────────────────────────────────────────────────────────────────

print("\n[4/5] Detailed evaluation...")

print("\n  --- Failure_Within_24h : Random Forest ---")
print(classification_report(y24_te, pred_rf, zero_division=0,
      target_names=["No Failure (<24h)", "Failure Within 24h"]))

print(f"  --- Failure_Within_24h : {algo} ---")
print(classification_report(y24_te, pred_xgb, zero_division=0,
      target_names=["No Failure (<24h)", "Failure Within 24h"]))

print("  --- Failure_Type : multi-class ---")
print(classification_report(yty_te, pred_ty, zero_division=0,
      target_names=le_type.classes_))

# Best 24h model confusion matrix
f1_rf_val  = results["A_RF_24h"]["f1"]
f1_xgb_val = results[f"B_{algo}_24h"]["f1"]
best_pred_24h = pred_rf if f1_rf_val >= f1_xgb_val else pred_xgb
best_name_24h = "Random Forest" if f1_rf_val >= f1_xgb_val else algo

cm = confusion_matrix(y24_te, best_pred_24h)
print(f"  Confusion Matrix — {best_name_24h} (best 24h model):")
print(f"                  Pred OK  Pred FAIL")
if cm.shape == (2, 2):
    print(f"  Actual OK       {cm[0,0]:>7}  {cm[0,1]:>9}")
    print(f"  Actual FAIL     {cm[1,0]:>7}  {cm[1,1]:>9}")
else:
    print(cm)

# Top-20 feature importances
best_fi = fi_rf if f1_rf_val >= f1_xgb_val else fi_xgb
print(f"\n  Top 20 Feature Importances ({best_name_24h} / 24h target):")
print(f"  {'Rank':<5} {'Feature':<50} {'Importance':>10}")
print(f"  {'-'*68}")
for rank, (feat_n, imp) in enumerate(best_fi.head(20).items(), 1):
    print(f"  {rank:<5} {feat_n:<50} {imp:>10.4f}")

# ──────────────────────────────────────────────────────────────────────────────
# 5. SAVE
# ──────────────────────────────────────────────────────────────────────────────

print("\n[5/5] Saving models and artifacts...")
Path("models").mkdir(exist_ok=True)

with open("models/rf_failure_24h.pkl",      "wb") as f: pickle.dump(rf,         f)
with open("models/xgb_failure_24h.pkl",     "wb") as f: pickle.dump(xgb,        f)
with open("models/xgb_failure_type.pkl",    "wb") as f: pickle.dump(xgb_type,   f)
with open("models/rf_failure_7d.pkl",       "wb") as f: pickle.dump(rf7d,       f)
with open("models/imputer.pkl",             "wb") as f: pickle.dump(imputer,     f)
with open("models/scaler.pkl",              "wb") as f: pickle.dump(scaler,      f)
with open("models/label_encoders.pkl",      "wb") as f: pickle.dump(label_encoders, f)
with open("models/label_encoder_type.pkl",  "wb") as f: pickle.dump(le_type,     f)

meta = {
    "feature_names": feature_names,
    "n_features": len(feature_names),
    "failure_type_classes": le_type.classes_.tolist(),
    "train_rows": len(X_tr),
    "test_rows":  len(X_te),
    "positive_rate_24h_train": round(float(y24_tr.mean()), 4),
    "positive_rate_7d_train":  round(float(y7d_tr.mean()), 4),
}
with open("models/model_meta.json", "w") as f:
    json.dump(meta, f, indent=2)

# Feature importances
fi_df = pd.DataFrame({
    "feature":           feature_names,
    "importance_rf_24h": rf.feature_importances_,
    "importance_xgb_24h": xgb.feature_importances_,
    "importance_xgb_type": xgb_type.feature_importances_,
    "importance_rf_7d":  rf7d.feature_importances_,
}).sort_values("importance_rf_24h", ascending=False)
fi_df.to_csv("models/feature_importances.csv", index=False)

with open("models/training_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\n  Saved artifacts:")
for p in sorted(Path("models").iterdir()):
    print(f"    {p.name:<38} {p.stat().st_size/1024:>7.1f} KB")

# ──────────────────────────────────────────────────────────────────────────────
# SUMMARY TABLE
# ──────────────────────────────────────────────────────────────────────────────

total = time.time() - t0
print("\n" + "=" * 65)
print("FINAL SUMMARY")
print("=" * 65)
print(f"  Dataset        : 5,000 rows | {len(feature_names)} features")
print(f"  Split          : 80% train / 20% test (time-ordered)")
print(f"  Total time     : {total:.0f}s")
print()
print(f"  {'Key':<22} {'Model':<16} {'Target':<22} {'F1/Acc':>8}  {'AUC':>8}")
print(f"  {'-'*80}")
for key, r in results.items():
    f1_val  = r.get("f1", r.get("f1_macro", r.get("accuracy", 0)))
    auc_val = r.get("roc_auc", r.get("accuracy", None))
    auc_str = f"{auc_val:.4f}" if auc_val is not None else "   N/A"
    print(f"  {key:<22} {r['model']:<16} {r['target']:<22} {f1_val:>8.4f}  {auc_str:>8}")

print()
print("  Output files:")
print("    output/pfmi_5000_raw.csv")
print("    models/rf_failure_24h.pkl")
print("    models/xgb_failure_24h.pkl")
print("    models/xgb_failure_type.pkl")
print("    models/rf_failure_7d.pkl")
print("    models/feature_importances.csv")
print("    models/training_results.json")
print("=" * 65)
