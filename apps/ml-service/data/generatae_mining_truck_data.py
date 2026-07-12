"""
Mining Haul Truck Telemetry — Temporal Progression Generator
Each truck progresses from normal -> wear -> failure across multiple trips.
LSTM-friendly: sequences capture upward sensor drift over time.
Output: CSV with ~10k rows. No NaN, no anomaly/impossible labels.
"""

import csv, random, argparse
from datetime import datetime, timedelta

random.seed(42)

MECHANICAL = ["CAT_789", "CAT_793"]
ELECTRIC   = ["KOM_980E", "LIE_T282", "HIT_EH5000"]
ALL_MODELS = MECHANICAL + ELECTRIC

PHASE_STRUCTURE = [
    ("idle",        1, 3),
    ("loading",     3, 8),
    ("loaded_haul", 8, 20),
    ("dumping",     2, 5),
    ("empty_return",5, 15),
    ("idle",        1, 3),
]

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

# ── Per-sensor generators (accept wear_factor 0..1) ─────────

def gen_vibration(phase, road_q, payload, wear):
    if phase == "idle":
        return round(random.uniform(0.005, 0.02), 4)
    rf = {0: 1.0, 1: 1.5, 2: 2.8, 3: 4.5}[road_q]
    lf = 0.8 + (payload / 400) * 0.4
    base = 0.03 * rf * lf
    val = base + wear * 1.0 + random.gauss(0, 0.02)
    return clamp(round(val, 4), 0.01, 3.0)

def gen_hub_oil_temp(ambient, vibration, running_frac, wear):
    heat = running_frac
    base = ambient + 10 + heat * 20 + vibration * 8
    val = base + wear * 45 + random.gauss(0, 2)
    return clamp(round(val, 1), ambient, 130)

def gen_case_drain_flow(payload, wear):
    val = random.uniform(1.0, 2.5) + (payload / 400) * 1.5 + wear * 15 + random.gauss(0, 0.3)
    return clamp(round(val, 2), 0.5, 20)

def gen_system_pressure(phase, payload, wear):
    if phase == "idle":
        return round(random.uniform(0, 50), 1)
    if phase in ("loading", "dumping"):
        return round(random.uniform(200, 240), 1)
    base = 80 + (payload / 400) * 80
    val = base - wear * 60 + random.gauss(0, 5)
    return clamp(round(val, 1), 0, 280)

def gen_strut_pressure(payload, grade, wear):
    per_side = 30 + (payload / 400) * 180
    gs = grade * 0.5
    left, right = per_side + gs, per_side - gs
    imbal = random.uniform(0, 5) + wear * 50
    if random.random() < 0.5:
        left += imbal
    else:
        right += imbal
    left  += random.gauss(0, 3)
    right += random.gauss(0, 3)
    return (clamp(round(left, 1), 20, 300), clamp(round(right, 1), 20, 300))

def gen_brake_oil_temp(ambient, grade, running_frac, wear):
    base = ambient + 5 + running_frac * 25 + max(0, -grade) * 3
    val = base + wear * 30 + random.gauss(0, 2)
    return clamp(round(val, 1), ambient, 120)

def gen_brake_stroke(wear):
    val = 2.0 + wear * 7 + random.gauss(0, 0.05)
    return clamp(round(val, 2), 2.0, 10.0)

def gen_crankcase_pressure(phase, payload, grade, wear):
    if phase == "idle":
        return round(random.uniform(0.2, 0.5), 3)
    load = (payload / 400) * 0.8 + abs(grade) * 0.02
    val = load + wear * 3.5 + random.gauss(0, 0.05)
    return clamp(round(val, 3), 0.1, 5.0)

def gen_egt(ambient, payload, grade, running_frac, wear):
    if running_frac < 0.1:
        return round(random.uniform(100, 250), 1)
    load = (payload / 400) * 200 + max(0, grade) * 15
    base = ambient + 200 + running_frac * 150 + load
    val = base + wear * 230 + random.gauss(0, 15)
    return clamp(round(val, 1), ambient, 850)

def gen_winding_temp(is_electric, ambient, payload, grade, running_frac, wear):
    if not is_electric:
        return 0.0
    load = (payload / 400) * 40 + max(0, grade) * 2
    base = ambient + 20 + running_frac * 40 + load
    val = base + wear * 75 + random.gauss(0, 4)
    return clamp(round(val, 1), ambient, 200)

# ── Trip generator ──────────────────────────────────────────

def generate_trip(truck_id, model, is_electric, trip_idx, wear_base, timestamp):
    """Generate one trip for a truck. wear_base = 0..1."""
    rows = []
    ambient = round(random.uniform(20, 45), 1)
    running_samples = 0

    for phase_name, n_min, n_max in PHASE_STRUCTURE:
        n = random.randint(n_min, n_max)
        for i in range(n):
            running_samples += 1
            running_frac = clamp(running_samples / 30, 0, 1)
            t = i / max(n - 1, 1)

            # Drift within each trip so the LSTM sees a clear slope
            wear = clamp(wear_base + t * 0.25, 0, 1)

            payload = random.uniform(0, 10) if phase_name in ("idle", "empty_return") else (
                random.uniform(0, 380) if phase_name == "loading" else random.uniform(200, 380)
            )
            grade = random.uniform(-1, 1) if phase_name in ("idle", "loading", "dumping") else (
                random.uniform(2, 10) if phase_name == "loaded_haul" else random.uniform(-8, 2)
            )
            road_q = 0 if phase_name in ("idle", "loading", "dumping") else random.choices([0, 1, 2, 3], weights=[40, 30, 20, 10])[0]

            vib = gen_vibration(phase_name, road_q, payload, wear)
            hub_temp = gen_hub_oil_temp(ambient, vib, running_frac, wear)

            rows.append({
                "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "truck_id": truck_id,
                "truck_model": model,
                "payload_t": round(payload, 1),
                "grade_pct": round(grade, 1),
                "road_quality": road_q,
                "ambient_temp_c": ambient,
                "vibration_g": vib,
                "hub_oil_temp_c": hub_temp,
                "case_drain_flow_pct": gen_case_drain_flow(payload, wear),
                "system_pressure_bar": gen_system_pressure(phase_name, payload, wear),
                "strut_pressure_left_bar": 0,
                "strut_pressure_right_bar": 0,
                "brake_oil_temp_c": gen_brake_oil_temp(ambient, grade, running_frac, wear),
                "brake_stroke_mm": gen_brake_stroke(wear),
                "crankcase_pressure_kpa": gen_crankcase_pressure(phase_name, payload, grade, wear),
                "egt_c": gen_egt(ambient, payload, grade, running_frac, wear),
                "winding_temp_c": gen_winding_temp(is_electric, ambient, payload, grade, running_frac, wear),
                "strut_imbalance_pct": 0,
                "label": "",
                "failure_mode": "",
                "trip_id": f"{truck_id}-TRIP-{trip_idx:04d}",
            })
            timestamp += timedelta(seconds=random.randint(10, 30))

    # Fill in strut pressures (needs payload, grade)
    for r in rows:
        spl, spr = gen_strut_pressure(r["payload_t"], r["grade_pct"], wear_base)
        r["strut_pressure_left_bar"] = spl
        r["strut_pressure_right_bar"] = spr
        imbal = abs(spl - spr) / max(spl, spr, 0.01) * 100
        r["strut_imbalance_pct"] = round(imbal, 2)

    return rows, timestamp

# ── Main ───────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rows', type=int, default=10000, help='Target row count')
    parser.add_argument('--trucks', type=int, default=50, help='Number of trucks')
    args = parser.parse_args()

    target_rows = args.rows
    num_trucks = args.trucks

    trucks = []
    for i in range(num_trucks):
        truck_id = f"HT-{i+1:03d}"
        model = random.choice(ALL_MODELS)
        # Stratify life progress: most trucks are healthy
        # 55% in 0-0.3 (normal), 25% in 0.3-0.55 (wear zone), 20% in 0.55-0.85 (near failure)
        r = random.random()
        if r < 0.55:
            life_progress = random.uniform(0, 0.3)
        elif r < 0.80:
            life_progress = random.uniform(0.3, 0.55)
        else:
            life_progress = random.uniform(0.55, 0.85)
        trucks.append({
            "id": truck_id,
            "model": model,
            "electric": model in ELECTRIC,
            "progress": life_progress,
        })

    all_rows = []
    timestamp = datetime(2026, 1, 1, 6, 0, 0)
    total_generated = 0
    trip_counter = 0
    dead_trucks = set()

    while total_generated < target_rows:
        for truck in trucks:
            if total_generated >= target_rows:
                break
            if truck["id"] in dead_trucks:
                continue

            trip_counter += 1
            wear = truck["progress"]
            if wear >= 1.0:
                dead_trucks.add(truck["id"])
                continue

            trip_rows, timestamp = generate_trip(
                truck["id"], truck["model"], truck["electric"],
                trip_counter, wear, timestamp
            )

            # Label based on wear
            for r in trip_rows:
                if wear < 0.30:
                    r["label"] = "normal"
                elif wear < 0.60:
                    r["label"] = "wear"
                else:
                    r["label"] = "failure"

            all_rows.extend(trip_rows)
            total_generated += len(trip_rows)
            timestamp += timedelta(minutes=random.randint(10, 60))

            # Advance wear for this truck (bigger steps = sharper class boundaries)
            truck["progress"] = clamp(truck["progress"] + random.uniform(0.04, 0.08), 0, 1.1)

    # Trim to target
    all_rows = all_rows[:target_rows]

    # Compute RUL: per-truck, based on sequential trip index
    for truck_id in set(r["truck_id"] for r in all_rows):
        truck_rows = [r for r in all_rows if r["truck_id"] == truck_id]
        # Get unique trips in order of first appearance
        seen = {}
        ordered_trips = []
        for r in truck_rows:
            if r["trip_id"] not in seen:
                seen[r["trip_id"]] = len(ordered_trips)
                ordered_trips.append(r["trip_id"])
        # Find first failure trip (by sequential index)
        first_fail_seq = None
        for seq_idx, tid in enumerate(ordered_trips):
            trip_rows = [r for r in truck_rows if r["trip_id"] == tid]
            if any(r["label"] == "failure" for r in trip_rows):
                first_fail_seq = seq_idx
                break

        if first_fail_seq is None:
            for r in truck_rows:
                r["rul"] = 50.0
        else:
            for r in truck_rows:
                seq = seen[r["trip_id"]]
                trips_remaining = max(0, first_fail_seq - seq)
                rul = trips_remaining * 20
                r["rul"] = round(min(rul, 50), 1)

    # Shuffle by truck (not by row — keep temporal order within each truck)
    # Group by truck, shuffle truck order
    truck_groups = {}
    for r in all_rows:
        tid = r["truck_id"]
        if tid not in truck_groups:
            truck_groups[tid] = []
        truck_groups[tid].append(r)

    truck_ids = list(truck_groups.keys())
    random.shuffle(truck_ids)
    shuffled = []
    for tid in truck_ids:
        shuffled.extend(truck_groups[tid])
    all_rows = shuffled

    # ── Write CSV ──
    outpath = f"C:\\Users\\User\\Desktop\\mining_haul_truck_telemetry_temporal.csv"
    fieldnames = [
        "timestamp", "truck_id", "truck_model", "payload_t", "grade_pct",
        "road_quality", "ambient_temp_c",
        "vibration_g", "hub_oil_temp_c",
        "case_drain_flow_pct", "system_pressure_bar",
        "strut_pressure_left_bar", "strut_pressure_right_bar",
        "brake_oil_temp_c", "brake_stroke_mm",
        "crankcase_pressure_kpa", "egt_c", "winding_temp_c",
        "strut_imbalance_pct", "label", "failure_mode", "trip_id", "rul",
    ]

    with open(outpath, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in all_rows:
            out_row = {k: r.get(k, "") for k in fieldnames}
            w.writerow(out_row)

    counts = {}
    for r in all_rows:
        counts[r["label"]] = counts.get(r["label"], 0) + 1
    print(f"[OK] Wrote {len(all_rows)} rows to {outpath}")
    for lbl in ["normal", "wear", "failure"]:
        n = counts.get(lbl, 0)
        if n:
            print(f"  {lbl:12s}  {n:4d} ({n/len(all_rows)*100:5.1f}%)")

if __name__ == "__main__":
    main()
