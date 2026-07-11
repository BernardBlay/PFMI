#!/usr/bin/env python3
"""
Synthetic Predictive Maintenance Dataset — LSTM-ready hourly telemetry.
Hydraulic top-hammer drilling rig, 10 sessions × ~550 hours each.
21 sensor channels + labels, smooth multi-hour degradation physics.
"""

import csv
import math
import random
import sys
from dataclasses import dataclass, field
from typing import Optional, List, Dict

random.seed(42)

# ── Constants ──────────────────────────────────────────────────────────────
ISO_VG46 = 46.0
DEGRADED_THRESHOLD = 0.30
IMMINENT_THRESHOLD = 0.78

# Degradation ramps (hours from first sign to failure, rough):
# These control base degradation rates.
DEGRADATION_HOURS = {
    "drill_bit":      (50, 150),   # fast wear item
    "striker_bar":    (20, 80),
    "drill_rod":      (100, 300),
    "coupling_sleeve": (80, 200),
    "hydraulic_seal":  (30, 100),
    "hydraulic_hose":  (40, 120),
    "filter":          (20, 60),
}

COMPONENT_KEYS = [
    "drill_bit", "striker_bar", "drill_rod", "coupling_sleeve",
    "hydraulic_seal", "hydraulic_hose", "filter",
]


# ── Helper: sigmoid acceleration ──────────────────────────────────────────
def accel_factor(deg: float) -> float:
    """Two-phase: flat 0.45 in degraded zone (d<0.72), quadratic ramp in imminent.
    This makes components spend ~80% of failure ramp in degraded, ~20% in imminent."""
    if deg < IMMINENT_THRESHOLD:
        return 0.45
    else:
        # Quadratic ramp from 0.45 at d=0.72 to 3.0 at d=1.0
        t = (deg - IMMINENT_THRESHOLD) / (1.0 - IMMINENT_THRESHOLD)
        return 0.45 + 2.55 * (t ** 2)


def rock_wear_mult(hardness: int) -> float:
    if hardness <= 3:   return 0.6
    elif hardness <= 5: return 0.8
    elif hardness <= 7: return 1.0
    elif hardness <= 9: return 1.7
    else:               return 2.2


def gauss_noise(frac: float = 0.03) -> float:
    return random.gauss(0.0, frac)


# ── Session generator ──────────────────────────────────────────────────────
def generate_session(
    session_id: int,
    num_hours: int,
    rock_profile: List[int],       # rock hardness per hour
    ambient_profile: List[float],  # ambient temp per hour
) -> List[dict]:
    """Generate one chronological session. Returns list of row dicts."""

    # Pick active components based on session rock hardness
    avg_hardness = sum(rock_profile) / len(rock_profile) if rock_profile else 5
    if avg_hardness <= 5:
        num_active = random.randint(2, 3)   # soft: 2-3
    elif avg_hardness <= 7:
        num_active = random.randint(2, 4)   # medium: 2-4
    else:
        num_active = random.randint(3, 4)   # hard: 3-4
    active_components = set(random.sample(COMPONENT_KEYS, min(num_active, len(COMPONENT_KEYS))))

    # Assign a baseline degradation rate.
    # Rate = 1/(ramp_h * K). With sigmoid accel averaging ~0.25 over 0→1,
    # effective rate ≈ 0.25/(ramp_h*K). For a 50h-ramp component:
    # K=2.5 → effective ~0.002/h → reaches d=0.5 in ~250h of active degradation.
    K = 5.0
    base_rates: Dict[str, float] = {}
    for key in COMPONENT_KEYS:
        lo, hi = DEGRADATION_HOURS[key]
        ramp_h = random.uniform(lo, hi)
        if key in active_components:
            # Per-component K variance (±40%) so components degrade at different speeds
            k_var = K * random.uniform(0.6, 1.4)
            base_rates[key] = 1.0 / (ramp_h * k_var)
        else:
            base_rates[key] = 0.0020 * random.uniform(0.5, 1.5)

    # Degradation start times: harder rock = earlier onset
    early_factor = max(0.05, min(0.40, 0.40 - (avg_hardness - 3) * 0.04))

    degradation_start: Dict[str, float] = {}
    for key in COMPONENT_KEYS:
        if key in active_components:
            degradation_start[key] = random.uniform(
                num_hours * early_factor,
                num_hours * (early_factor + 0.50)
            )
        else:
            degradation_start[key] = random.uniform(num_hours * 0.25, num_hours * 1.0)

    # Track current degradation per component
    degradation: Dict[str, float] = {k: 0.0 for k in COMPONENT_KEYS}

    # Tank level baseline (starts 88-92%, drifts down with hose leaks)
    tank_level = random.uniform(88.0, 92.0)

    rows = []
    for hour in range(num_hours):
        rock = rock_profile[hour]
        amb = ambient_profile[hour]
        rwm = rock_wear_mult(rock)

        # ── Advance degradation for each component ──────────────────────
        for key in COMPONENT_KEYS:
            if hour < degradation_start[key]:
                # Pre-degradation: slow background wear
                degradation[key] += base_rates[key] * 0.15 * rwm
            else:
                d = degradation[key]
                degradation[key] += base_rates[key] * accel_factor(d) * rwm
            degradation[key] = min(1.0, degradation[key])

        d_bit     = degradation["drill_bit"]
        d_striker = degradation["striker_bar"]
        d_rod     = degradation["drill_rod"]
        d_coupling = degradation["coupling_sleeve"]
        d_seal    = degradation["hydraulic_seal"]
        d_hose    = degradation["hydraulic_hose"]
        d_filter  = degradation["filter"]

        # ── Derive sensor values ────────────────────────────────────────
        # Vibration RMS: healthy ~1.0–2.0g, climbs with drill-string wear
        vib_x_rms = 1.2 + d_bit * 6.0 + d_striker * 2.0 + d_rod * 1.5 + d_coupling * 1.0 + rock * 0.10
        vib_y_rms = 1.1 + d_bit * 3.0 + d_striker * 4.0 + d_coupling * 3.5 + d_rod * 2.0 + rock * 0.08
        vib_z_rms = 1.4 + d_bit * 4.0 + d_rod * 3.5 + d_striker * 1.5 + rock * 0.12

        # Peaks are typically 1.8–2.5× RMS, higher with impact damage
        peak_mult = lambda d: 2.0 + d * 1.5
        vib_x_peak = vib_x_rms * peak_mult(d_bit + d_striker * 0.5)
        vib_y_peak = vib_y_rms * peak_mult(d_striker + d_coupling * 0.7)
        vib_z_peak = vib_z_rms * peak_mult(d_rod + d_bit * 0.3)

        # Acoustic emission: spikes with bit/rock interaction
        acoustic = 1.0 + d_bit * 5.0 + d_striker * 1.5 + (rock - 5) * 0.15

        # Penetration rate m/hr: drops with bit wear, harder rock
        pen_rate = max(0.05, 1.0 - d_bit * 0.7 - (rock - 4) * 0.08)

        # Rotation speed: drops slightly under heavy load
        rpm = 48 + random.uniform(-2, 2) - d_bit * 2.0 - d_coupling * 1.5

        # Feed pressure: rises to overcome worn bit
        feed = 72 + d_bit * 28 + (rock - 4) * 2.5 + random.uniform(-2, 2)

        # Hydraulic pressure: drifts up with filter clog, seal issues
        hyd_press = 175 + d_filter * 15 + d_seal * 8 + d_bit * 5 + random.uniform(-2, 2)

        # Return pressure: KEY seal indicator
        ret_press = 8.0 + d_seal * 22 + d_hose * 4 + d_filter * 6 + random.uniform(-1, 1)

        # Oil temp: rises with bypass heating
        oil_temp = 50 + amb * 0.15 + d_seal * 12 + d_filter * 6 + d_hose * 3 + random.uniform(-1.5, 1.5)

        # Flow rate: drops with filter clog, seal bypass
        flow = 98 - d_filter * 15 - d_seal * 8 + random.uniform(-1.5, 1.5)

        # Differential pressure filter
        dp_filter = 0.45 + d_filter * 3.0 + d_seal * 0.3 + random.uniform(0, 0.08)

        # Oil particle count: rises with seal, hose, bit wear (debris)
        particles = 120 + d_seal * 350 + d_hose * 180 + d_bit * 90 + d_filter * 40 + d_striker * 60

        # Oil moisture: rises with hose leak, humidity via ambient
        moisture = 100 + d_hose * 280 + amb * 1.5 + random.uniform(-8, 8)

        # Oil viscosity: deviates with temp + contamination
        visc = ISO_VG46 + (oil_temp - 50) * (-0.15) + d_seal * (-2.0) + d_hose * (-1.5) + random.uniform(-0.3, 0.3)

        # Tank level: drops with hose leak, occasional refill
        tank_drop = d_hose * random.uniform(0.08, 0.30)  # % per hour
        tank_level -= tank_drop
        # Refill when low (every ~150-200 hours if healthy)
        if tank_level < 72 or (random.random() < 0.005 and tank_level < 82):
            tank_level = random.uniform(88, 93)
        tank_level = max(60, min(96, tank_level))

        # Drive motor current: rises with harder rock, worn components
        current = 58 + d_bit * 8 + d_rod * 4 + d_coupling * 2.5 + (rock - 4) * 1.2 + random.uniform(-1.5, 1.5)

        # Motor winding temp
        winding_temp = 62 + (current - 58) * 0.45 + amb * 0.3 + random.uniform(-1.5, 1.5)

        # ── Health labels ───────────────────────────────────────────────
        health = {}
        for k in COMPONENT_KEYS:
            d = degradation[k]
            if d >= IMMINENT_THRESHOLD:
                health[k] = 2
            elif d >= DEGRADED_THRESHOLD:
                health[k] = 1
            else:
                health[k] = 0

        # ── RUL hours ───────────────────────────────────────────────────
        # Estimate: how long until the most-degraded component hits 1.0 at current rate
        worst_key = max(COMPONENT_KEYS, key=lambda k: degradation[k])
        worst_d = degradation[worst_key]
        if worst_d >= 0.99:
            rul = 0.0
        elif worst_d < 0.05:
            rul = 1800 + random.uniform(0, 200)
        else:
            remaining = 1.0 - worst_d
            current_rate = base_rates[worst_key] * accel_factor(worst_d) * rock_wear_mult(rock)
            if current_rate < 0.0001:
                current_rate = 0.0001
            rul = remaining / current_rate
            rul = min(2000, max(0, rul))

        # ── Failure type ────────────────────────────────────────────────
        active = [(k, degradation[k]) for k in COMPONENT_KEYS if degradation[k] >= IMMINENT_THRESHOLD]
        active.sort(key=lambda x: -x[1])
        if not active:
            ftype = "none"
        elif len(active) >= 2:
            ftype = "multiple"
        else:
            key = active[0][0]
            fm_map = {
                "drill_bit": "drill_bit", "striker_bar": "striker_bar",
                "drill_rod": "drill_rod", "coupling_sleeve": "coupling_sleeve",
                "hydraulic_seal": "seal_leak", "hydraulic_hose": "hose_burst",
                "filter": "filter_clog",
            }
            ftype = fm_map.get(key, "none")

        # ── Add noise ───────────────────────────────────────────────────
        row = {
            "Vibration_X_RMS":              round(vib_x_rms * (1 + gauss_noise(0.03)), 2),
            "Vibration_X_Peak":             round(vib_x_peak * (1 + gauss_noise(0.03)), 2),
            "Vibration_Y_RMS":              round(vib_y_rms * (1 + gauss_noise(0.03)), 2),
            "Vibration_Y_Peak":             round(vib_y_peak * (1 + gauss_noise(0.03)), 2),
            "Vibration_Z_RMS":              round(vib_z_rms * (1 + gauss_noise(0.03)), 2),
            "Vibration_Z_Peak":             round(vib_z_peak * (1 + gauss_noise(0.03)), 2),
            "Acoustic_Emission_RMS":        round(acoustic * (1 + gauss_noise(0.03)), 2),
            "Penetration_Rate_Avg":         round(pen_rate * (1 + gauss_noise(0.02)), 2),
            "Rotation_Speed_Avg":           round(rpm * (1 + gauss_noise(0.01)), 1),
            "Feed_Pressure_Avg":            round(feed * (1 + gauss_noise(0.03)), 1),
            "Hydraulic_Pressure_Avg":       round(hyd_press * (1 + gauss_noise(0.03)), 1),
            "Hydraulic_Return_Pressure_Avg": round(ret_press * (1 + gauss_noise(0.03)), 2),
            "Hydraulic_Oil_Temp_Avg":       round(oil_temp * (1 + gauss_noise(0.02)), 1),
            "Flow_Rate_Avg":                round(flow * (1 + gauss_noise(0.02)), 1),
            "Differential_Pressure_Filter_Avg": round(dp_filter * (1 + gauss_noise(0.03)), 2),
            "Oil_Particle_Count_Avg":       round(max(0, particles * (1 + gauss_noise(0.04)))),
            "Oil_Moisture_Avg":             round(max(0, moisture * (1 + gauss_noise(0.04)))),
            "Oil_Viscosity_Avg":            round(visc * (1 + gauss_noise(0.02)), 1),
            "Tank_Level_End":               round(tank_level, 1),
            "Drive_Motor_Current_Avg":      round(current * (1 + gauss_noise(0.03)), 1),
            "Motor_Winding_Temp_Avg":       round(winding_temp * (1 + gauss_noise(0.02)), 1),
            "drill_bit_health":             health["drill_bit"],
            "striker_bar_health":           health["striker_bar"],
            "drill_rod_health":             health["drill_rod"],
            "coupling_sleeve_health":       health["coupling_sleeve"],
            "hydraulic_seal_health":        health["hydraulic_seal"],
            "hydraulic_hose_health":        health["hydraulic_hose"],
            "filter_health":                health["filter"],
            "rul_hours":                    round(rul, 1),
            "failure_type":                 ftype,
            "rock_hardness":                rock,
            "drill_hours_since_overhaul":   round(hour + session_id * 500, 1),
            "hour_in_session":              hour,
            "session_id":                   session_id,
            "ambient_temp_C":               round(amb, 1),
        }

        # ── Sensor malfunction injection (0.3% / row) ───────────────────
        if random.random() < 0.003:
            sensor = random.choice([c for c in COLUMNS if c.startswith(("Vibration","Acoustic","Penetration","Rotation","Feed","Hydraulic","Flow","Differential","Oil","Tank","Drive","Motor"))])
            if random.random() < 0.5:
                row[sensor] = 0.0  # dropout
            # else: stuck — keep previous value (implicitly, since we don't update)

        rows.append(row)

    return rows


# ── Column order ───────────────────────────────────────────────────────────
COLUMNS = [
    "Vibration_X_RMS", "Vibration_X_Peak", "Vibration_Y_RMS", "Vibration_Y_Peak",
    "Vibration_Z_RMS", "Vibration_Z_Peak", "Acoustic_Emission_RMS",
    "Penetration_Rate_Avg", "Rotation_Speed_Avg", "Feed_Pressure_Avg",
    "Hydraulic_Pressure_Avg", "Hydraulic_Return_Pressure_Avg",
    "Hydraulic_Oil_Temp_Avg", "Flow_Rate_Avg",
    "Differential_Pressure_Filter_Avg", "Oil_Particle_Count_Avg",
    "Oil_Moisture_Avg", "Oil_Viscosity_Avg", "Tank_Level_End",
    "Drive_Motor_Current_Avg", "Motor_Winding_Temp_Avg",
    "drill_bit_health", "striker_bar_health", "drill_rod_health",
    "coupling_sleeve_health", "hydraulic_seal_health",
    "hydraulic_hose_health", "filter_health",
    "rul_hours", "failure_type", "rock_hardness",
    "drill_hours_since_overhaul", "hour_in_session", "session_id",
    "ambient_temp_C",
]


def build_rock_profile(num_hours: int, base_hardness: int, variability: float) -> List[int]:
    """Generate rock hardness per hour — mostly base, occasional shifts."""
    profile = []
    current = base_hardness
    for h in range(num_hours):
        # Occasional formation change (2% chance per hour)
        if random.random() < 0.02:
            delta = random.choice([-2, -1, 0, 1, 2])
            current = max(1, min(10, current + delta))
        profile.append(current)
    return profile


def build_ambient_profile(num_hours: int, base_temp: float) -> List[float]:
    """Slowly varying ambient temperature."""
    profile = []
    current = base_temp
    for h in range(num_hours):
        current += random.uniform(-0.3, 0.3)
        current = max(-5, min(50, current))
        profile.append(round(current, 1))
    return profile


def run(output_path: str = "synthetic_drill_rig_dataset.csv"):
    # Session definitions per prompt spec:
    sessions_spec = [
        # (num_hours, base_hardness, variability, base_temp, label)
        (580, 4, 0.3, 22, "soft rock, slow wear"),
        (560, 4, 0.4, 25, "soft rock, slow wear"),
        (540, 5, 0.5, 28, "soft rock, mostly healthy"),
        (530, 5, 0.6, 30, "soft-medium, mixed"),
        (520, 6, 0.7, 27, "mixed rock, some failures"),
        (550, 6, 0.8, 32, "mixed rock, some failures"),
        (510, 7, 0.9, 35, "mixed-hard, failures mid-session"),
        (530, 8, 1.0, 33, "hard rock, aggressive wear"),
        (500, 9, 1.1, 38, "hard rock, multiple failures"),
        (480, 8, 1.5, 45, "unusual: extreme heat, sensor glitches"),
    ]

    all_rows = []
    for sid, (num_hours, base_hardness, variability, base_temp, label) in enumerate(sessions_spec):
        rock_profile = build_rock_profile(num_hours, base_hardness, variability)
        ambient_profile = build_ambient_profile(num_hours, base_temp)
        session_rows = generate_session(sid, num_hours, rock_profile, ambient_profile)
        all_rows.extend(session_rows)
        print(f"  Session {sid}: {num_hours}h, {label} → {len(session_rows)} rows")

    # Write CSV
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(all_rows)

    # Stats
    total = len(all_rows)
    h0 = sum(1 for r in all_rows if all(r[f"{k}_health"] == 0 for k in COMPONENT_KEYS))
    degraded = sum(1 for r in all_rows if any(r[f"{k}_health"] == 1 for k in COMPONENT_KEYS)
                   and not any(r[f"{k}_health"] == 2 for k in COMPONENT_KEYS))
    imminent = sum(1 for r in all_rows if any(r[f"{k}_health"] == 2 for k in COMPONENT_KEYS))
    multi = sum(1 for r in all_rows if r["failure_type"] == "multiple")
    none_ft = sum(1 for r in all_rows if r["failure_type"] == "none")

    print(f"\nTotal: {total} rows → {output_path}")
    print(f"  Healthy (all=0):  {h0:5d}  ({100*h0/total:.1f}%)")
    print(f"  Degraded only:    {degraded:5d}  ({100*degraded/total:.1f}%)")
    print(f"  Imminent failure: {imminent:5d}  ({100*imminent/total:.1f}%)")
    print(f"  Multiple:         {multi:5d}  ({100*multi/total:.1f}%)")
    print(f"  failure_type=none:{none_ft:5d}  ({100*none_ft/total:.1f}%)")

    from collections import Counter
    ft = Counter(r["failure_type"] for r in all_rows)
    print("\n  Failure types:")
    for k, c in ft.most_common():
        print(f"    {k:20s}: {c:5d}  ({100*c/total:.1f}%)")

    # Per-session stats
    print("\n  Per-session health:")
    for sid in range(10):
        sess = [r for r in all_rows if r["session_id"] == sid]
        s_h0 = sum(1 for r in sess if all(r[f"{k}_health"] == 0 for k in COMPONENT_KEYS))
        s_h2 = sum(1 for r in sess if any(r[f"{k}_health"] == 2 for k in COMPONENT_KEYS))
        print(f"    Session {sid}: {len(sess)}h, healthy={100*s_h0/len(sess):.0f}%, imminent={100*s_h2/len(sess):.0f}%")

    return output_path


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "synthetic_drill_rig_dataset.csv"
    run(out)
