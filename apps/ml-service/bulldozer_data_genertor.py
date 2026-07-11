"""
bulldozer_sim.py
=================
Synthetic hourly sensor data generator for a bulldozer, for predictive
maintenance model training.

Design notes
------------
* Each of the 10 sessions is an independent asset-life segment with its own
  material profile, session length, and set of active degradation processes.
* Degradation is modelled as a set of PROCESSES. Each process has:
      - an onset hour (in session-hours)
      - a duration (hours from onset to full failure)
      - a progress p in [0, 1] computed from a curve (linear / exponential /
        sigmoid), where p = 0 is healthy and p = 1 is failed.
  Each process then pushes the healthy baselines of the sensors it affects.
* Material density >= 7 multiplies the RATE of every active process by
  1.5x - 2.0x (i.e. it shortens the effective duration).
* Overlapping failures: sessions can run more than one process at once, and
  cross-couplings are applied explicitly (e.g. cutting-edge wear raises engine
  load, which raises coolant temp and fuel burn).
* Labels are derived from the MAXIMUM progress across active processes, so the
  class balance (60/25/15) falls out of the session design rather than being
  stamped on afterwards.

Output: bulldozer_sensor_data.csv
"""

import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)

# ----------------------------------------------------------------------
# 1. HEALTHY BASELINES  (low, high) -> a per-session healthy operating point
#    is drawn from this band, then per-hour Gaussian noise (2-5%) is applied.
# ----------------------------------------------------------------------
BASELINES = {
    "Vibration_Engine_RMS":          (1.0, 1.5),    # g
    "Vibration_Undercarriage_RMS":   (1.5, 2.5),    # g
    "Hydraulic_Pressure_Implement":  (180.0, 250.0),  # bar
    "Return_Pressure":               (5.0, 15.0),   # bar
    "Hydraulic_Oil_Temp":            (60.0, 80.0),  # C
    "Engine_Coolant_Temp":           (80.0, 95.0),  # C
    "Differential_Pressure_Filter":  (0.3, 0.8),    # bar
    "Oil_Particle_Count":            (50.0, 200.0),  # particles/mL
    "Track_Slip_Ratio":              (2.0, 8.0),    # %
    "Engine_Load_Factor":            (40.0, 70.0),  # %
    "Fuel_Consumption_Rate":         (15.0, 30.0),  # L/hr
    "Drawbar_Pull_Force":            (100.0, 200.0),  # kN
}

# Peak channels are derived from RMS (crest factor), not sampled independently.
HEALTHY_CREST_ENGINE = 2.1          # -> peaks stay <= ~3.0 g when RMS ~1.4
HEALTHY_CREST_UNDERCARRIAGE = 2.0   # -> peaks stay <= ~5.0 g when RMS ~2.5

NOISE_PCT = (0.02, 0.05)            # 2-5% Gaussian noise on every channel

# ----------------------------------------------------------------------
# 2. DEGRADATION PROCESS DEFINITIONS
#    duration ranges are the spec's "spanning X-Y hours" windows.
# ----------------------------------------------------------------------
PROCESSES = {
    "cutting_edge_wear":     {"duration": (50, 150), "curve": "linear"},
    "undercarriage_wear":    {"duration": (150, 300), "curve": "sigmoid"},
    "final_drive_wear":      {"duration": (80, 200), "curve": "sigmoid"},
    "hydraulic_seal_failure": {"duration": (30, 100), "curve": "linear"},
    "filter_clogging":       {"duration": (20, 60), "curve": "exponential"},
}


def progress_curve(t, duration, kind):
    """Map elapsed hours since onset -> progress in [0, 1]."""
    x = np.clip(t / duration, 0.0, 1.0)
    if kind == "linear":
        return x
    if kind == "exponential":
        # slow start, sharp knee at the end (filter clogging behaviour)
        return (np.exp(2.2 * x) - 1.0) / (np.exp(2.2) - 1.0)
    if kind == "sigmoid":
        # slow -> accelerating -> saturating (mechanical wear behaviour)
        return 1.0 / (1.0 + np.exp(-6.0 * (x - 0.45)))
    raise ValueError(kind)


# ----------------------------------------------------------------------
# 3. SESSION PROFILES  (spec section 4)
# ----------------------------------------------------------------------
# onset is given as a FRACTION of session length so it scales with duration.
SESSIONS = [
    # --- Sessions 0-2: loose dirt/sand, long shifts, mostly healthy ---
    dict(id=0, hours=320, density=(2, 3), ambient=(24, 32), processes=[]),
    dict(id=1, hours=300, density=(2, 4), ambient=(23, 31), processes=[
        dict(name="filter_clogging", onset=0.90),  # only a hint at the very end
    ]),
    dict(id=2, hours=340, density=(3, 4), ambient=(25, 33), processes=[
        dict(name="cutting_edge_wear", onset=0.72),
    ]),

    # --- Sessions 3-5: mixed clay, moderate hydraulic/track wear mid-session ---
    dict(id=3, hours=280, density=(4, 5), ambient=(26, 34), processes=[
        dict(name="hydraulic_seal_failure", onset=0.48),
    ]),
    dict(id=4, hours=300, density=(5, 6), ambient=(25, 34), processes=[
        dict(name="undercarriage_wear", onset=0.28),
        dict(name="cutting_edge_wear", onset=0.55),   # overlap
    ]),
    dict(id=5, hours=260, density=(4, 6), ambient=(27, 35), processes=[
        dict(name="hydraulic_seal_failure", onset=0.44),
        dict(name="filter_clogging", onset=0.74),     # overlap: seal debris -> filter
    ]),

    # --- Sessions 6-8: heavy rock ripping, aggressive wear, multiple failures ---
    dict(id=6, hours=220, density=(7, 8), ambient=(28, 37), processes=[
        dict(name="cutting_edge_wear", onset=0.30),
        dict(name="final_drive_wear", onset=0.50),    # overlap
    ]),
    dict(id=7, hours=200, density=(8, 10), ambient=(29, 38), processes=[
        dict(name="undercarriage_wear", onset=0.26),
        dict(name="final_drive_wear", onset=0.40),
        dict(name="cutting_edge_wear", onset=0.56),   # triple overlap
    ]),
    dict(id=8, hours=190, density=(7, 10), ambient=(28, 38), processes=[
        dict(name="final_drive_wear", onset=0.36),
        dict(name="hydraulic_seal_failure", onset=0.52),
        dict(name="filter_clogging", onset=0.76),     # triple overlap
    ]),

    # --- Session 9: anomaly session (extreme heat + mud slip) ---
    dict(id=9, hours=180, density=(3, 5), ambient=(38, 47), anomaly=True, processes=[
        dict(name="undercarriage_wear", onset=0.55),
    ]),
]


def sample_healthy_point():
    """Draw one session's healthy operating point from the baseline bands."""
    return {k: RNG.uniform(lo, hi) for k, (lo, hi) in BASELINES.items()}


def build_session(cfg, hours_offset):
    n = cfg["hours"]
    t = np.arange(n)                       # hour_in_session

    # ---- material density: slow random walk inside the session's band -----
    d_lo, d_hi = cfg["density"]
    walk = np.cumsum(RNG.normal(0, 0.25, n))
    walk = walk - walk.mean()
    span = max(walk.max() - walk.min(), 1e-6)
    density = d_lo + (d_hi - d_lo) * (walk - walk.min()) / span
    density = np.clip(density, 1, 10)

    # ---- ambient temp: slow diurnal drift + noise -------------------------
    a_lo, a_hi = cfg["ambient"]
    diurnal = (a_hi - a_lo) / 2 * np.sin(2 * np.pi * t / 24.0)
    ambient = (a_lo + a_hi) / 2 + diurnal + RNG.normal(0, 0.6, n)

    # ---- degradation accelerator from hard material -----------------------
    # density >= 7 -> rate multiplier ramps 1.5x .. 2.0x across 7 -> 10
    accel = np.where(
        density >= 7,
        1.5 + 0.5 * np.clip((density - 7) / 3.0, 0, 1),
        1.0,
    )

    # ---- progress of each active process ---------------------------------
    # Effective elapsed time accumulates FASTER in hard material, so we
    # integrate the accelerator rather than scaling the clock uniformly.
    progress = {}
    for p in cfg["processes"]:
        name = p["name"]
        dur_lo, dur_hi = PROCESSES[name]["duration"]
        duration = RNG.uniform(dur_lo, dur_hi)
        onset_h = p["onset"] * n

        # effective hours since onset, accelerated by material hardness
        eff = np.cumsum(np.where(t >= onset_h, accel, 0.0))
        progress[name] = progress_curve(eff, duration, PROCESSES[name]["curve"])

    def prog(name):
        return progress.get(name, np.zeros(n))

    ce = prog("cutting_edge_wear")        # cutting edge
    uc = prog("undercarriage_wear")       # undercarriage
    fd = prog("final_drive_wear")         # final drive
    hs = prog("hydraulic_seal_failure")   # hydraulic seal
    fc = prog("filter_clogging")          # filter

    # ---- healthy operating point for this session ------------------------
    base = sample_healthy_point()

    # ---- load coupling ----------------------------------------------------
    # Harder material AND a worn cutting edge both raise engine load.
    # This is the primary interaction: worn edge -> more load -> more heat/fuel.
    density_load = (density - 5.0) * 2.0          # +/- ~10 pts across the scale
    load = base["Engine_Load_Factor"] + density_load + 28.0 * ce + 6.0 * uc
    load = np.clip(load, 30, 100)
    load_excess = np.clip(load - base["Engine_Load_Factor"], 0, None)  # >=0

    # ---- SENSOR CHANNELS --------------------------------------------------
    ch = {}

    # Drawbar pull: falls as the cutting edge dulls; rises slightly with density
    ch["Drawbar_Pull_Force"] = (
        base["Drawbar_Pull_Force"] * (1.0 - 0.45 * ce)
        + 3.0 * (density - 5.0)
    )

    ch["Engine_Load_Factor"] = load

    # Fuel burn: baseline + load-driven + edge-wear penalty
    ch["Fuel_Consumption_Rate"] = (
        base["Fuel_Consumption_Rate"]
        + 0.22 * load_excess
        + 9.0 * ce
    )

    # Engine vibration: mild rise with load; final-drive wear couples through
    ch["Vibration_Engine_RMS"] = (
        base["Vibration_Engine_RMS"]
        * (1.0 + 0.10 * (load_excess / 30.0) + 0.25 * fd)
    )

    # Undercarriage vibration: driven by undercarriage + final drive wear
    ch["Vibration_Undercarriage_RMS"] = (
        base["Vibration_Undercarriage_RMS"]
        * (1.0 + 1.20 * uc + 0.55 * fd)
        + 0.35 * (density / 10.0)
    )

    # Track slip: creeps past 15% with undercarriage wear; mud anomaly explodes it
    slip = base["Track_Slip_Ratio"] + 11.0 * uc + 1.2 * (density - 5.0) / 5.0
    if cfg.get("anomaly"):
        # mud: heavy, erratic slip spikes
        mud = 14.0 * np.clip((t - 0.25 * n) / (0.75 * n), 0, 1)
        slip = slip + mud + RNG.normal(0, 2.0, n).clip(0, None)
    ch["Track_Slip_Ratio"] = np.clip(slip, 0.5, 45.0)

    # Hydraulic implement pressure: sags as seals fail
    ch["Hydraulic_Pressure_Implement"] = (
        base["Hydraulic_Pressure_Implement"] * (1.0 - 0.22 * hs)
        + 8.0 * (density - 5.0)
    )

    # Return pressure: the signature of seal failure -> 30+ bar
    ch["Return_Pressure"] = (
        base["Return_Pressure"]
        + (32.0 - base["Return_Pressure"]) * hs
        + 2.0 * fc                      # a clogged filter also backs up return
    )

    # Hydraulic oil temp: ~1-2 C per 10 hrs of seal failure, + ambient, + clog
    ch["Hydraulic_Oil_Temp"] = (
        base["Hydraulic_Oil_Temp"]
        + 22.0 * hs
        + 6.0 * fc
        + 0.45 * (ambient - 28.0)
        + 0.06 * load_excess
    )

    # Coolant temp: ambient + engine load (so edge wear -> heat, via load)
    ch["Engine_Coolant_Temp"] = (
        base["Engine_Coolant_Temp"]
        + 0.30 * (ambient - 28.0)
        + 0.22 * load_excess
        + 4.0 * fc
    )
    if cfg.get("anomaly"):
        ch["Engine_Coolant_Temp"] += 6.0   # extreme-heat session pushes it over

    # Filter differential pressure: exponential 0.5 -> 3.5 bar
    ch["Differential_Pressure_Filter"] = (
        base["Differential_Pressure_Filter"]
        + (3.5 - base["Differential_Pressure_Filter"]) * fc
    )

    # Oil particle count: final-drive wear sheds metal -> 1500+ ; seals add some
    ch["Oil_Particle_Count"] = (
        base["Oil_Particle_Count"]
        + 1650.0 * (fd ** 1.6)
        + 260.0 * hs
        + 120.0 * uc
    )

    # ---- Gaussian noise (2-5%, drawn per channel) ------------------------
    for k, v in ch.items():
        pct = RNG.uniform(*NOISE_PCT)
        ch[k] = v * (1.0 + RNG.normal(0, pct, n))

    # ---- Peak channels: derived from RMS via crest factor ------------------
    # Final-drive wear makes the undercarriage peak SPIKE (impacts), so the
    # crest factor itself grows - that's the diagnostic, not just higher RMS.
    crest_e = HEALTHY_CREST_ENGINE * (1.0 + 0.15 * fd) * (1 + RNG.normal(0, 0.03, n))
    crest_u = HEALTHY_CREST_UNDERCARRIAGE * (1.0 + 0.85 * fd + 0.15 * uc) \
        * (1 + RNG.normal(0, 0.04, n))
    ch["Vibration_Engine_Peak"] = ch["Vibration_Engine_RMS"] * crest_e
    ch["Vibration_Undercarriage_Peak"] = ch["Vibration_Undercarriage_RMS"] * crest_u

    # ---- clip to physical floors -----------------------------------------
    for k in ch:
        ch[k] = np.clip(ch[k], 0.0, None)

    # ---- labels -----------------------------------------------------------
    all_prog = np.vstack([ce, uc, fd, hs, fc])
    max_prog = all_prog.max(axis=0)
    dominant = np.array(
        ["cutting_edge_wear", "undercarriage_wear", "final_drive_wear",
         "hydraulic_seal_failure", "filter_clogging"]
    )[all_prog.argmax(axis=0)]
    dominant = np.where(max_prog < 0.10, "none", dominant)

    health_state = np.select(
        [max_prog < 0.10, max_prog < 0.97],
        ["normal", "degrading"],
        default="imminent_failure",
    )
    n_active = (all_prog > 0.10).sum(axis=0)

    df = pd.DataFrame({
        "session_id": cfg["id"],
        "hour_in_session": t,
        "operating_hours_since_overhaul": hours_offset + t,
        "material_density": np.round(density, 2),
        "ambient_temp_C": np.round(ambient, 2),
        **{k: np.round(v, 3) for k, v in ch.items()},
        "degradation_progress": np.round(max_prog, 4),
        "active_failure_count": n_active,
        "dominant_failure_mode": dominant,
        "health_state": health_state,
    })
    return df, hours_offset + n


def main():
    frames, offset = [], 0
    for cfg in SESSIONS:
        df, offset = build_session(cfg, offset)
        frames.append(df)

    data = pd.concat(frames, ignore_index=True)

    cols = [
        "session_id", "hour_in_session", "operating_hours_since_overhaul",
        "material_density", "ambient_temp_C",
        "Vibration_Engine_RMS", "Vibration_Engine_Peak",
        "Vibration_Undercarriage_RMS", "Vibration_Undercarriage_Peak",
        "Hydraulic_Pressure_Implement", "Return_Pressure", "Hydraulic_Oil_Temp",
        "Engine_Coolant_Temp", "Differential_Pressure_Filter",
        "Oil_Particle_Count", "Track_Slip_Ratio", "Engine_Load_Factor",
        "Fuel_Consumption_Rate", "Drawbar_Pull_Force",
        "degradation_progress", "active_failure_count",
        "dominant_failure_mode", "health_state",
    ]
    data = data[cols]
    data.to_csv("bulldozer_sensor_data.csv", index=False)

    # ---------------- report ----------------
    print(f"Rows: {len(data)}  Sessions: {data.session_id.nunique()}")
    print("\nClass balance:")
    print((data.health_state.value_counts(normalize=True) * 100).round(1))
    print("\nOverlapping failures (>=2 active):",
          f"{(data.active_failure_count >= 2).mean() * 100:.1f}%")
    print("\nDominant failure mode:")
    print(data.dominant_failure_mode.value_counts())
    print("\nHealthy-row channel ranges (sanity vs spec):")
    healthy = data[data.health_state == "normal"]
    print(healthy[[
        "Vibration_Engine_RMS", "Vibration_Undercarriage_RMS",
        "Hydraulic_Pressure_Implement", "Return_Pressure",
        "Hydraulic_Oil_Temp", "Engine_Coolant_Temp",
        "Differential_Pressure_Filter", "Oil_Particle_Count",
        "Track_Slip_Ratio", "Engine_Load_Factor",
        "Fuel_Consumption_Rate", "Drawbar_Pull_Force",
    ]].describe().T[["min", "mean", "max"]].round(2))
    print("\nFailure-state extremes (sanity vs spec):")
    bad = data[data.health_state == "imminent_failure"]
    print(bad[[
        "Return_Pressure", "Differential_Pressure_Filter", "Oil_Particle_Count",
        "Track_Slip_Ratio", "Vibration_Undercarriage_Peak", "Drawbar_Pull_Force",
    ]].describe().T[["min", "mean", "max"]].round(2))
    print("\nWrote bulldozer_sensor_data.csv")


if __name__ == "__main__":
    main()