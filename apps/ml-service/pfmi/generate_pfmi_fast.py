"""
PFMI Fast Batch Generator
Uses numpy vectorized batch generation for high throughput (~50k-100k rows/sec).
Produces identical schema to generate_pfmi_dataset.py.

Usage:
    python generate_pfmi_fast.py [--records 10000000] [--machines 120] [--out output]
"""

import numpy as np
import pandas as pd
import json
import math
import os
import time
import argparse
from pathlib import Path
from datetime import datetime, timedelta

# ──────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────

MANUFACTURERS = ["Caterpillar", "Volvo", "Komatsu", "Hyundai"]
MODELS        = ["950GC", "L120H", "WA380", "HL960"]
BUCKET_CAPS   = [3.1, 3.4, 2.8, 3.2]

JOB_SITES = [
    ("Copper Ridge Mine",       -23.55, -46.63, 850,  "Mining"),
    ("Port Authority Yard",       1.35,  103.81,  15,  "Port"),
    ("Highland Quarry",          51.50,   -0.12, 320,  "Quarry"),
    ("Desert Sand Fill",         24.87,   67.01,  45,  "Construction"),
    ("Arctic Aggregate",         64.15,  -21.94, 110,  "Quarry"),
    ("Tropical Bauxite Site",    -5.79,  -35.20,  30,  "Mining"),
    ("Mountain Road Project",    45.42,    6.85,1900,  "Construction"),
    ("Coastal Reclamation",      22.28,  114.15,   5,  "Construction"),
    ("Iron Ore Station",        -22.90,  -43.17, 200,  "Mining"),
    ("Urban Development East",   40.71,  -74.00,  10,  "Construction"),
]

SITE_BASE_TEMP = {"Mining": 30.0, "Port": 27.0, "Quarry": 22.0, "Construction": 25.0}

TERRAIN_TYPES  = ["Flat","Gravel","Rocky","Muddy","Sandy","Compacted","Steep","Uneven"]
WORKING_MODES  = ["Digging","Loading","Traveling","Dumping","Idle","Grading","Stockpiling"]
GEARS          = ["1","2","3","4","N","R"]
SHIFTS         = ["Day","Night","Swing"]
LUBE_STATUSES  = ["Good","Fair","Poor"]
PARTS_LIST     = ["Nothing","Filters","Belts","Pump","Bearings","Tires","Oil"]
WARRANTY_STATS = ["Active","Expired"]
WEATHER_CATS   = ["Clear","Cloudy","Clear","Clear"]

FAILURE_TYPES = [
    "No Failure","Hydraulic Pump Failure","Bearing Wear","Engine Overheating",
    "Fuel System Failure","Turbo Failure","Transmission Failure","Brake Failure",
    "Tire Failure","Electrical Failure","Cooling System Failure","Sensor Failure",
]
FAULT_CATS = {
    "No Failure": "No Fault", "Hydraulic Pump Failure": "Hydraulic",
    "Bearing Wear": "Mechanical", "Engine Overheating": "Thermal",
    "Fuel System Failure": "Mechanical", "Turbo Failure": "Mechanical",
    "Transmission Failure": "Mechanical", "Brake Failure": "Mechanical",
    "Tire Failure": "Mechanical", "Electrical Failure": "Electrical",
    "Cooling System Failure": "Thermal", "Sensor Failure": "Electrical",
}
FAILURE_WINDOWS_H = {           # hours of degradation before event
    "No Failure": 0,
    "Hydraulic Pump Failure": 72, "Bearing Wear": 144, "Engine Overheating": 48,
    "Fuel System Failure": 24, "Turbo Failure": 96, "Transmission Failure": 120,
    "Brake Failure": 72, "Tire Failure": 36, "Electrical Failure": 24,
    "Cooling System Failure": 48, "Sensor Failure": 12,
}
DTC_PREFIX = {
    "Hydraulic Pump Failure": "P2290", "Bearing Wear": "C0500",
    "Engine Overheating": "P0217", "Fuel System Failure": "P0087",
    "Turbo Failure": "P0234", "Transmission Failure": "P0700",
    "Brake Failure": "C0110", "Tire Failure": "C1110",
    "Electrical Failure": "B1000", "Cooling System Failure": "P0128",
    "Sensor Failure": "U0100",
}

# ──────────────────────────────────────────────────────────────────────────────
# MACHINE STATE  (one row per machine, updated each batch step)
# ──────────────────────────────────────────────────────────────────────────────

class FleetState:
    def __init__(self, n_machines, seed=42):
        rng = np.random.default_rng(seed)
        N   = n_machines
        self.N   = N
        self.rng = rng

        # Identity
        self.mfr_idx   = np.arange(N) % 4
        self.site_idx  = np.arange(N) % len(JOB_SITES)
        self.year      = rng.integers(2015, 2024, N)
        self.eng_hours = rng.uniform(500, 18000, N)
        self.op_exp    = rng.integers(1, 26, N)
        self.serial    = [f"{MANUFACTURERS[self.mfr_idx[i]][:3].upper()}-{i+1:04d}-{rng.integers(100000,999999)}"
                          for i in range(N)]
        self.firmware  = [f"FW-{rng.integers(1,5)}.{rng.integers(0,9)}.{rng.integers(0,9)}" for _ in range(N)]
        self.warranty  = rng.choice([0, 1], N)        # 0=Active, 1=Expired

        # Degradation (0=new, 1=failed)
        self.bearing_wear    = rng.uniform(0.0, 0.35, N)
        self.pump_health     = rng.uniform(0.65, 1.0, N)
        self.turbo_health    = rng.uniform(0.65, 1.0, N)
        self.trans_health    = rng.uniform(0.65, 1.0, N)
        self.cooling_health  = rng.uniform(0.65, 1.0, N)
        self.brake_health    = rng.uniform(0.65, 1.0, N)
        self.tire_wear       = rng.uniform(0.0, 0.40, (N, 4))  # FL FR RL RR

        # Maintenance tracking
        self.svc_days        = rng.uniform(0, 90, N)
        self.svc_hours       = rng.uniform(0, 500, N)
        self.filter_age      = rng.uniform(0, 500, N)
        self.oil_age         = rng.uniform(0, 500, N)
        self.prev_failures   = rng.integers(0, 9, N)
        self.parts_replaced  = rng.integers(0, len(PARTS_LIST), N)
        self.lube_status     = np.where(self.oil_age < 150, 0, np.where(self.oil_age < 350, 1, 2))

        # Failure arc (per machine)
        self.active_fail_idx = np.zeros(N, dtype=int)   # 0 = No Failure
        self.fail_countdown  = np.zeros(N)               # hours remaining
        self.fail_severity   = np.zeros(N)               # 0→1

        # Shift / mode
        self.shift_idx       = rng.integers(0, 3, N)
        self.shift_counter   = rng.uniform(0, 540, N)    # minutes
        self.mode_idx        = rng.integers(0, len(WORKING_MODES), N)
        self.mode_counter    = rng.uniform(0, 60, N)
        self.operator_ids    = rng.integers(1, 81, N)

        # Timestamps — spread machines over 3 years
        base = datetime(2022, 1, 1)
        self.timestamps = [base + timedelta(days=int(rng.integers(0, 60))) for _ in range(N)]

    def step(self, interval_min):
        """Advance all machines by interval_min minutes."""
        rng = self.rng
        N   = self.N
        dt  = interval_min / 60.0   # hours

        # Ambient temp proxy for degradation (use month of first machine as fleet proxy)
        month = self.timestamps[0].month
        seasonal = 10 * math.sin((month - 6) * math.pi / 6)

        # Load factor per machine (random each step)
        load = rng.uniform(0.3, 0.9, N)
        accel = 1.0 + load * 1.5

        # Ambient stress on cooling
        ambient_approx = 28 + seasonal
        cool_stress = 1 + max(0, (ambient_approx - 25) / 50)

        # Degrade components
        self.bearing_wear   = np.clip(self.bearing_wear   + dt * 0.00008 * accel, 0, 1)
        self.pump_health    = np.clip(self.pump_health    - dt * 0.00005 * accel, 0, 1)
        self.turbo_health   = np.clip(self.turbo_health   - dt * 0.00004 * accel, 0, 1)
        self.trans_health   = np.clip(self.trans_health   - dt * 0.00003 * accel, 0, 1)
        self.cooling_health = np.clip(self.cooling_health - dt * 0.00003 * accel * cool_stress, 0, 1)
        self.brake_health   = np.clip(self.brake_health   - dt * 0.00004 * accel, 0, 1)
        self.tire_wear      = np.clip(self.tire_wear      + dt * 0.00006 * accel[:, None], 0, 1)
        self.eng_hours     += dt
        self.svc_hours     += dt
        self.filter_age    += dt
        self.oil_age       += dt
        self.svc_days      += interval_min / 1440.0

        # Advance active failure countdowns
        active = self.active_fail_idx > 0
        self.fail_countdown[active] -= interval_min / 60.0
        self.fail_countdown          = np.maximum(self.fail_countdown, 0)

        # Recalculate severity for machines in failure arc
        for i in np.where(active)[0]:
            fi  = self.active_fail_idx[i]
            win = FAILURE_WINDOWS_H[FAILURE_TYPES[fi]]
            self.fail_severity[i] = max(0.0, 1.0 - self.fail_countdown[i] / win) if win > 0 else 0.0

        # Stochastic failure arc initiation for healthy machines
        no_fail = ~active
        r_start = rng.uniform(0, 1, N)
        for i in np.where(no_fail)[0]:
            prob, fi = self._failure_prob(i)
            if r_start[i] < prob and fi > 0:
                self.active_fail_idx[i] = fi
                self.fail_countdown[i]  = float(FAILURE_WINDOWS_H[FAILURE_TYPES[fi]])
                self.fail_severity[i]   = 0.0

        # Maintenance triggers (service every ~500 h or 90 days)
        for i in range(N):
            if self.svc_hours[i] > rng.uniform(480, 560) or self.svc_days[i] > rng.uniform(85, 95):
                if rng.uniform() < 0.70:
                    self._maintain(i)

        # Shift and mode changes
        self.shift_counter -= interval_min
        change_shift = self.shift_counter <= 0
        self.shift_idx[change_shift]     = rng.integers(0, 3, change_shift.sum())
        self.operator_ids[change_shift]  = rng.integers(1, 81, change_shift.sum())
        self.shift_counter[change_shift] = rng.uniform(420, 540, change_shift.sum())

        self.mode_counter -= interval_min
        change_mode = self.mode_counter <= 0
        self.mode_idx[change_mode]    = rng.integers(0, len(WORKING_MODES), change_mode.sum())
        self.mode_counter[change_mode] = rng.uniform(5, 60, change_mode.sum())

        # Lube status
        self.lube_status = np.where(self.oil_age < 150, 0, np.where(self.oil_age < 350, 1, 2))

        # Advance timestamps
        for i in range(N):
            self.timestamps[i] += timedelta(minutes=interval_min)

    def _failure_prob(self, i):
        """Return (probability_this_step, failure_type_index) for machine i."""
        bw = self.bearing_wear[i]
        ph = self.pump_health[i]
        th = self.turbo_health[i]
        tr = self.trans_health[i]
        ch = self.cooling_health[i]
        bh = self.brake_health[i]
        tw = self.tire_wear[i].max()

        candidates = []
        if bw > 0.55: candidates.append((3, (bw - 0.55) * 0.05))   # Bearing Wear idx=2
        if ph < 0.45: candidates.append((2, (0.45 - ph) * 0.06))   # Hydraulic Pump idx=1
        if th < 0.45: candidates.append((6, (0.45 - th) * 0.04))   # Turbo idx=5
        if tr < 0.40: candidates.append((7, (0.40 - tr) * 0.05))   # Transmission idx=6
        if ch < 0.45: candidates.append((11,(0.45 - ch) * 0.04))   # Cooling idx=10
        if ch < 0.35: candidates.append((4, (0.35 - ch) * 0.05))   # Overheating idx=3
        if bh < 0.40: candidates.append((8, (0.40 - bh) * 0.04))   # Brake idx=7
        if tw > 0.70: candidates.append((9, (tw - 0.70) * 0.06))   # Tire idx=8
        r = self.rng.uniform()
        if r < 0.00008: candidates.append((10, 0.002))  # Electrical
        r2 = self.rng.uniform()
        if r2 < 0.00006: candidates.append((5, 0.002))  # Fuel
        r3 = self.rng.uniform()
        if r3 < 0.00005: candidates.append((12, 0.003)) # Sensor

        if not candidates:
            return 0.0, 0
        total = sum(p for _, p in candidates)
        return total, max(candidates, key=lambda x: x[1])[0]

    def _maintain(self, i):
        rng = self.rng
        if self.active_fail_idx[i] > 0:
            self.prev_failures[i] += 1
        self.svc_hours[i]       = 0
        self.svc_days[i]        = 0
        self.filter_age[i]      = 0
        self.oil_age[i]         = 0
        self.lube_status[i]     = 0
        self.parts_replaced[i]  = rng.integers(1, len(PARTS_LIST))  # never "Nothing" on service
        self.active_fail_idx[i] = 0
        self.fail_countdown[i]  = 0
        self.fail_severity[i]   = 0.0
        # partial health recovery
        self.bearing_wear[i]    = max(0.0, self.bearing_wear[i] * 0.3)
        self.pump_health[i]     = min(1.0, self.pump_health[i]    + 0.15)
        self.cooling_health[i]  = min(1.0, self.cooling_health[i] + 0.15)
        self.brake_health[i]    = min(1.0, self.brake_health[i]   + 0.10)


# ──────────────────────────────────────────────────────────────────────────────
# VECTORIZED SENSOR BATCH  (produces one row per machine per call)
# ──────────────────────────────────────────────────────────────────────────────

def build_batch(fleet: FleetState, interval_min: int) -> pd.DataFrame:
    rng = fleet.rng
    N   = fleet.N

    fi   = fleet.active_fail_idx      # shape (N,)
    sev  = fleet.fail_severity        # shape (N,)
    fail_names = np.array(FAILURE_TYPES)[fi]

    # ── Environment ─────────────────────────────────────────────────────────
    ts_list   = fleet.timestamps
    months    = np.array([t.month for t in ts_list])
    seasonal  = 10 * np.sin((months - 6) * np.pi / 6)

    site_base = np.array([SITE_BASE_TEMP.get(JOB_SITES[s][4], 25) for s in fleet.site_idx])
    ambient   = np.clip(site_base + seasonal + rng.normal(0, 5, N), -20, 55)
    humidity  = np.clip(rng.normal(60, 20, N), 5, 100)
    dust      = np.clip(rng.normal(35, 15, N), 0, 100)
    slope     = np.clip(rng.normal(0, 8, N), -30, 30)
    elevation = np.array([JOB_SITES[s][3] for s in fleet.site_idx]) + rng.normal(0, 5, N)

    wx_idx = np.where(humidity > 85, 0,                    # Rain
             np.where((ambient > 40) & (dust > 60), 1,     # Dust Storm
             np.where(ambient < 0, 2,                      # Snow
             rng.integers(0, len(WEATHER_CATS), N))))
    wx_names = np.array(["Rain","Dust Storm","Snow","Clear","Cloudy"])[np.minimum(wx_idx, 4)]

    rainfall = np.where(wx_idx == 0, np.clip(rng.normal(5, 3, N), 0, 50), 0.0)

    # ── Operating state ──────────────────────────────────────────────────────
    is_idle   = fleet.mode_idx == 4   # Idle mode
    rpm_base  = np.where(is_idle, np.clip(rng.normal(780, 40, N), 700, 900),
                                  np.clip(rng.normal(1900, 150, N), 1400, 2300))
    rpm       = np.clip(rpm_base + rng.normal(0, 30, N), 700, 2600)

    eng_load  = np.clip(np.where(is_idle, rng.normal(0.3, 0.10, N), rng.normal(0.72, 0.15, N)), 0.05, 1.0)
    hyd_load  = np.clip(eng_load * 0.65 + rng.normal(0, 0.08, N), 0.05, 1.0)
    bc_cap    = np.array([BUCKET_CAPS[m] for m in fleet.mfr_idx])
    bucket_l  = np.clip(np.where(is_idle, rng.normal(0, 0.2, N), rng.normal(bc_cap * 0.75, 0.4)), 0, bc_cap)
    speed     = np.clip(np.where(is_idle, rng.normal(0, 1, N), rng.normal(14, 4, N)), 0, 38)
    fuel_rate = np.clip(eng_load * 22 + rng.normal(0, 2, N), 2, 32)
    fuel_lvl  = np.clip(rng.normal(65, 20, N), 5, 100)

    # ── Engine sensors ───────────────────────────────────────────────────────
    cooling_f  = 1.0 + (1.0 - fleet.cooling_health) * 0.4
    is_over    = (fail_names == "Engine Overheating") | (fail_names == "Cooling System Failure")
    coolant_t  = np.clip(70 + eng_load*30 + ambient*0.3 + cooling_f*10
                         + np.where(is_over, sev*35, 0) + rng.normal(0,2,N), 60, 130)
    oil_t      = np.clip(coolant_t + 8 + eng_load*10 + rng.normal(0,2,N), 65, 145)
    eng_t      = np.clip(coolant_t + 5 + rng.normal(0,3,N), 65, 140)
    oil_p      = np.clip(380 - eng_load*40 - fleet.bearing_wear*60
                         - np.where(fail_names=="Engine Overheating", sev*120, 0)
                         + rng.normal(0,10,N), 120, 500)
    cool_p     = np.clip(1.4 - (1-fleet.cooling_health)*0.5 + rng.normal(0,0.05,N), 0.5, 2.2)
    iat        = np.clip(ambient + 20 + eng_load*10 + rng.normal(0,3,N), 15, 80)
    int_p      = np.clip(1.2 + eng_load*0.3 + rng.normal(0,0.05,N), 0.9, 2.0)
    exh_t      = np.clip(350 + eng_load*150
                         + np.where(fail_names=="Turbo Failure", sev*200, 0)
                         + rng.normal(0,10,N), 200, 750)
    exh_bp     = np.clip(3 + eng_load*2
                         + np.where(fail_names=="Turbo Failure", sev*8, 0)
                         + rng.normal(0,0.3,N), 1, 15)
    turbo      = np.clip(1.5 + eng_load*0.8
                         - np.where(fail_names=="Turbo Failure", sev*0.9, 0)
                         + rng.normal(0,0.05,N), 0.5, 3.0)
    fuel_p     = np.clip(550 - np.where(fail_names=="Fuel System Failure", sev*250, 0)
                         + rng.normal(0,15,N), 50, 700)
    air_filt   = np.clip(fleet.filter_age/5 + dust*0.3 + rng.normal(0,2,N), 0, 100)

    # ── Hydraulic ────────────────────────────────────────────────────────────
    hyd_p      = np.clip(250*hyd_load - np.where(fail_names=="Hydraulic Pump Failure", sev*150, 0)
                         + rng.normal(0,8,N), 20, 380)
    hyd_t      = np.clip(45 + hyd_load*40 + ambient*0.2 + cooling_f*5
                         + np.where(fail_names=="Hydraulic Pump Failure", sev*30, 0)
                         + rng.normal(0,3,N), 30, 120)
    pump_eff   = np.clip(fleet.pump_health - np.where(fail_names=="Hydraulic Pump Failure", sev*0.5, 0)
                         + rng.normal(0,0.02,N), 0.1, 1.0)
    pump_vib   = np.clip(1.5 + (1-pump_eff)*8 + rng.normal(0,0.2,N), 0.5, 15)
    pump_cur   = np.clip(eng_load*45 + rng.normal(0,2,N), 5, 80)
    hyd_flow   = np.clip(pump_eff*hyd_load*120 + rng.normal(0,3,N), 0, 160)
    hyd_oil    = np.clip(85 - (1-pump_eff)*20 + rng.normal(0,2,N), 20, 100)

    # ── Electrical ───────────────────────────────────────────────────────────
    batt_v     = np.clip(24.5 - np.where(fail_names=="Electrical Failure", sev*4, 0)
                         + rng.normal(0,0.3,N), 18, 30)
    batt_i     = np.clip(eng_load*80 + rng.normal(0,5,N), -10, 200)
    alt_out    = np.clip(28 - np.where(fail_names=="Electrical Failure", sev*6, 0)
                         + rng.normal(0,0.5,N), 10, 32)
    ecu_t      = np.clip(55 + eng_load*10 + ambient*0.1 + rng.normal(0,2,N), 40, 95)

    # ── Mechanical ───────────────────────────────────────────────────────────
    trans_t    = np.clip(75 + eng_load*30
                         + np.where(fail_names=="Transmission Failure", sev*40, 0)
                         + rng.normal(0,3,N), 55, 145)
    trans_p    = np.clip(1600 - np.where(fail_names=="Transmission Failure", sev*800, 0)
                         + rng.normal(0,30,N), 200, 2200)
    brake_t    = np.clip(80 + eng_load*50
                         + np.where(fail_names=="Brake Failure", sev*120, 0)
                         + rng.normal(0,5,N), 40, 350)
    brake_p    = np.clip(120 - np.where(fail_names=="Brake Failure", sev*60, 0)
                         + rng.normal(0,5,N), 10, 180)

    tire_fail  = np.where(fail_names=="Tire Failure", sev*40, 0)
    tp_FL      = np.clip(105 - fleet.tire_wear[:,0]*30 - tire_fail + rng.normal(0,2,N), 20, 130)
    tp_FR      = np.clip(105 - fleet.tire_wear[:,1]*30              + rng.normal(0,2,N), 20, 130)
    tp_RL      = np.clip(105 - fleet.tire_wear[:,2]*30 - tire_fail + rng.normal(0,2,N), 20, 130)
    tp_RR      = np.clip(105 - fleet.tire_wear[:,3]*30              + rng.normal(0,2,N), 20, 130)
    tire_t     = np.clip(35 + eng_load*20 + ambient*0.2 + rng.normal(0,3,N), 25, 100)
    steer      = np.clip(rng.normal(0, 15, N), -55, 55)
    susp_vib   = np.clip(1.0 + eng_load*2 + np.abs(slope)*0.05 + rng.normal(0,0.2,N), 0.5, 12)

    # ── Condition monitoring ─────────────────────────────────────────────────
    bear_fac   = 1.0 + fleet.bearing_wear*5 + np.where(fail_names=="Bearing Wear", sev*3, 0)
    ovib       = np.clip(1.2*bear_fac + eng_load*1.5 + rng.normal(0,0.15,N), 0.5, 25)
    rms_v      = np.clip(ovib*0.7 + rng.normal(0,0.1,N), 0.3, 18)
    fft_pk     = np.clip(ovib*1.3 + rng.normal(0,0.2,N), 0.5, 30)
    bear_t     = np.clip(65 + fleet.bearing_wear*40
                         + np.where(fail_names=="Bearing Wear", sev*50, 0)
                         + rng.normal(0,2,N), 50, 160)
    bear_vib   = np.clip(ovib*0.85 + rng.normal(0,0.1,N), 0.3, 20)
    acoustic   = np.clip(72 + eng_load*12 + ovib*1.5 + rng.normal(0,2,N), 60, 110)
    ultrasonic = np.clip(fleet.bearing_wear*50
                         + np.where(fail_names=="Bearing Wear", sev*30, 0)
                         + rng.normal(0,3,N), 0, 100)

    # ── Labels ───────────────────────────────────────────────────────────────
    mins_to_fail = np.where(fi > 0, fleet.fail_countdown * 60, 99999.0)
    f24h  = (mins_to_fail > 0) & (mins_to_fail <= 1440)
    f7d   = (mins_to_fail > 0) & (mins_to_fail <= 10080)
    rul   = np.where(fi > 0, fleet.fail_countdown, np.nan)   # hours
    maint = np.where(f24h, "Urgent", np.where(f7d, "Soon", "Routine"))
    warn  = np.where(f24h, "Critical",
            np.where(f7d & (sev > 0.4), "High",
            np.where(f7d, "Medium",
            np.where(sev > 0.1, "Low", "OK"))))

    # ── DTC ──────────────────────────────────────────────────────────────────
    active_dtcs = []
    error_codes = []
    for i in range(N):
        codes = []
        if sev[i] > 0.3 and fi[i] > 0:
            codes.append(f"{DTC_PREFIX.get(FAILURE_TYPES[fi[i]],'U0000')}-{int(sev[i]*9):02d}")
        if oil_p[i] < 200:   codes.append("P0520")
        if coolant_t[i] > 115: codes.append("P0217")
        if hyd_p[i] < 50:   codes.append("P2290")
        if batt_v[i] < 22:  codes.append("B1001")
        if trans_p[i] < 400: codes.append("P0700")
        codes = list(set(codes))[:4]
        active_dtcs.append("|".join(codes) if codes else "NO_DTC")
        error_codes.append(codes[0] if codes else "NO_DTC")

    # ── Missing value injection (~0.3%) ──────────────────────────────────────
    def mnv(arr, p=0.003):
        mask = rng.uniform(0, 1, N) < p
        result = arr.astype(float)
        result[mask] = np.nan
        return result

    # ── Assemble DataFrame ───────────────────────────────────────────────────
    idle_time = np.where(is_idle, rng.uniform(0, interval_min, N), 0.0)
    mfr_names  = np.array(MANUFACTURERS)[fleet.mfr_idx]
    model_names= np.array(MODELS)[fleet.mfr_idx]
    site_names = np.array([s[0] for s in JOB_SITES])[fleet.site_idx]
    lat        = np.array([JOB_SITES[s][1] for s in fleet.site_idx]) + rng.normal(0, 0.01, N)
    lon        = np.array([JOB_SITES[s][2] for s in fleet.site_idx]) + rng.normal(0, 0.01, N)
    age_years  = np.array([(ts - datetime(fleet.year[i], 1, 1)).days / 365.25
                            for i, ts in enumerate(ts_list)])

    df = pd.DataFrame({
        "Machine_ID":               np.arange(1, N+1),
        "Manufacturer":             mfr_names,
        "Model":                    model_names,
        "Year":                     fleet.year,
        "Engine_Hours":             np.round(fleet.eng_hours, 1),
        "Machine_Age":              np.round(age_years, 2),
        "Serial_Number":            fleet.serial,
        "Firmware_Version":         fleet.firmware,
        "Timestamp":                [t.isoformat() for t in ts_list],
        "Latitude":                 np.round(lat, 5),
        "Longitude":                np.round(lon, 5),
        "Elevation":                np.round(elevation, 1),
        "Ambient_Temperature":      np.round(ambient, 1),
        "Humidity":                 np.round(humidity, 1),
        "Rainfall":                 np.round(rainfall, 2),
        "Dust_Level":               np.round(dust, 1),
        "Terrain_Type":             np.array(TERRAIN_TYPES)[rng.integers(0, len(TERRAIN_TYPES), N)],
        "Slope":                    np.round(slope, 1),
        "Altitude":                 np.round(elevation + rng.normal(0, 3, N), 1),
        "Weather":                  wx_names,
        "Job_Site":                 site_names,
        "Engine_RPM":               np.round(rpm, 0),
        "Fuel_Rate":                np.round(mnv(fuel_rate, 0.004), 2),
        "Fuel_Level":               np.round(fuel_lvl, 1),
        "Engine_Load":              np.round(eng_load, 3),
        "Hydraulic_Load":           np.round(hyd_load, 3),
        "Bucket_Load":              np.round(mnv(bucket_l, 0.005), 2),
        "Travel_Speed":             np.round(speed, 1),
        "Gear":                     np.array(GEARS)[rng.integers(0, len(GEARS), N)],
        "Idle_Time":                np.round(idle_time, 1),
        "PTO_Status":               np.where(rng.uniform(0,1,N) < 0.5, "Active", "Inactive"),
        "Working_Mode":             np.array(WORKING_MODES)[fleet.mode_idx],
        "Operator_ID":              [f"OP{x:04d}" for x in fleet.operator_ids],
        "Operator_Experience":      fleet.op_exp,
        "Shift":                    np.array(SHIFTS)[fleet.shift_idx],
        "Coolant_Temperature":      np.round(mnv(coolant_t), 1),
        "Oil_Temperature":          np.round(mnv(oil_t), 1),
        "Engine_Temperature":       np.round(mnv(eng_t, 0.004), 1),
        "Oil_Pressure":             np.round(mnv(oil_p), 1),
        "Coolant_Pressure":         np.round(mnv(cool_p), 3),
        "Intake_Air_Temperature":   np.round(mnv(iat), 1),
        "Intake_Pressure":          np.round(mnv(int_p), 3),
        "Exhaust_Temperature":      np.round(mnv(exh_t, 0.004), 1),
        "Exhaust_Backpressure":     np.round(mnv(exh_bp), 2),
        "Turbo_Boost":              np.round(mnv(turbo), 3),
        "Fuel_Pressure":            np.round(mnv(fuel_p), 1),
        "Air_Filter_Restriction":   np.round(mnv(air_filt, 0.004), 1),
        "Hydraulic_Pressure":       np.round(mnv(hyd_p), 1),
        "Hydraulic_Temperature":    np.round(mnv(hyd_t), 1),
        "Pump_Efficiency":          np.round(mnv(pump_eff), 3),
        "Pump_Vibration":           np.round(mnv(pump_vib), 2),
        "Pump_Current":             np.round(mnv(pump_cur), 1),
        "Hydraulic_Flow":           np.round(mnv(hyd_flow), 1),
        "Hydraulic_Oil_Level":      np.round(mnv(hyd_oil), 1),
        "Battery_Voltage":          np.round(mnv(batt_v), 2),
        "Battery_Current":          np.round(mnv(batt_i), 1),
        "Alternator_Output":        np.round(mnv(alt_out), 2),
        "ECU_Temperature":          np.round(mnv(ecu_t), 1),
        "Transmission_Temperature": np.round(mnv(trans_t), 1),
        "Transmission_Pressure":    np.round(mnv(trans_p), 1),
        "Brake_Temperature":        np.round(mnv(brake_t, 0.004), 1),
        "Brake_Pressure":           np.round(mnv(brake_p), 1),
        "Tire_Pressure_FL":         np.round(mnv(tp_FL), 1),
        "Tire_Pressure_FR":         np.round(mnv(tp_FR), 1),
        "Tire_Pressure_RL":         np.round(mnv(tp_RL), 1),
        "Tire_Pressure_RR":         np.round(mnv(tp_RR), 1),
        "Tire_Temperature":         np.round(mnv(tire_t), 1),
        "Steering_Angle":           np.round(mnv(steer, 0.002), 1),
        "Suspension_Vibration":     np.round(mnv(susp_vib), 2),
        "Overall_Vibration":        np.round(mnv(ovib), 3),
        "FFT_Peak":                 np.round(mnv(fft_pk), 3),
        "RMS_Vibration":            np.round(mnv(rms_v), 3),
        "Bearing_Temperature":      np.round(mnv(bear_t), 1),
        "Bearing_Vibration":        np.round(mnv(bear_vib), 3),
        "Acoustic_Noise_Level":     np.round(mnv(acoustic), 1),
        "Ultrasonic_Emission":      np.round(mnv(ultrasonic), 1),
        "Last_Service_Days":        np.round(fleet.svc_days, 1),
        "Last_Service_Hours":       np.round(fleet.svc_hours, 1),
        "Lubrication_Status":       np.array(LUBE_STATUSES)[fleet.lube_status],
        "Filter_Age":               np.round(fleet.filter_age, 1),
        "Oil_Age":                  np.round(fleet.oil_age, 1),
        "Previous_Failure_Count":   fleet.prev_failures,
        "Parts_Replaced":           np.array(PARTS_LIST)[fleet.parts_replaced],
        "Warranty_Status":          np.array(WARRANTY_STATS)[fleet.warranty],
        "Active_DTC":               active_dtcs,
        "Warning_Level":            warn,
        "Error_Code":               error_codes,
        "Fault_Category":           np.array([FAULT_CATS.get(f, "No Fault") for f in fail_names]),
        "Failure_Within_24h":       f24h.astype(int),
        "Failure_Within_7d":        f7d.astype(int),
        "Remaining_Useful_Life":    np.round(rul, 1),
        "Maintenance_Action":       maint,
        "Failure_Type":             fail_names,
    })

    return df


# ──────────────────────────────────────────────────────────────────────────────
# MAIN GENERATION LOOP
# ──────────────────────────────────────────────────────────────────────────────

def generate(target_records=10_000_000, n_machines=120, interval_min=5,
             out_dir="output", chunk_size=500_000, seed=42):

    out_dir = Path(out_dir)
    out_dir.mkdir(exist_ok=True)

    fleet      = FleetState(n_machines, seed=seed)
    steps_per  = n_machines               # one batch = one step for all machines = N rows
    steps_need = math.ceil(target_records / steps_per)

    total_rows    = 0
    chunk_idx     = 0
    chunk_buf     = []
    chunk_buf_len = 0
    csv_paths     = []

    print(f"[PFMI-Fast] Target: {target_records:,} rows | {n_machines} machines | {interval_min}-min interval")
    t0 = time.time()

    for step in range(steps_need):
        fleet.step(interval_min)
        batch = build_batch(fleet, interval_min)
        rows_remaining = target_records - total_rows
        if len(batch) > rows_remaining:
            batch = batch.iloc[:rows_remaining]
        chunk_buf.append(batch)
        chunk_buf_len += len(batch)
        total_rows    += len(batch)

        # Flush when chunk is full or we've hit the target
        if chunk_buf_len >= chunk_size or total_rows >= target_records:
            combined = pd.concat(chunk_buf, ignore_index=True)
            path = out_dir / f"wheel_loader_pfmi_chunk_{chunk_idx:04d}.csv"
            combined.to_csv(path, index=False)
            csv_paths.append(str(path))
            chunk_buf     = []
            chunk_buf_len = 0
            chunk_idx    += 1
            elapsed = time.time() - t0
            rate = total_rows / elapsed
            print(f"  Chunk {chunk_idx:04d} | {total_rows:>10,} rows | {rate:>8,.0f} rows/sec")

        if total_rows >= target_records:
            break

    # Merge
    merged = out_dir / "wheel_loader_pfmi_full.csv"
    print(f"\n[PFMI-Fast] Merging {len(csv_paths)} chunks...")
    first = True
    with open(merged, "wb") as fout:
        for p in csv_paths:
            with open(p, "rb") as fin:
                if not first:
                    fin.readline()
                fout.write(fin.read())
            first = False

    size_gb = merged.stat().st_size / 1e9
    print(f"[PFMI-Fast] Merged CSV: {merged}  ({size_gb:.2f} GB)")

    # JSON sample
    sample = pd.read_csv(merged, nrows=1000)
    json_path = out_dir / "wheel_loader_pfmi_sample_1000.json"
    sample.to_json(json_path, orient="records", indent=2)
    print(f"[PFMI-Fast] JSON sample: {json_path}")

    elapsed = time.time() - t0
    print(f"\n[PFMI-Fast] Done in {elapsed:.1f}s ({elapsed/60:.1f} min) -- {total_rows:,} records")
    return str(merged), csv_paths


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--records",  type=int, default=10_000_000)
    parser.add_argument("--machines", type=int, default=120)
    parser.add_argument("--interval", type=int, default=5)
    parser.add_argument("--out",      type=str, default="output")
    parser.add_argument("--chunk",    type=int, default=500_000)
    parser.add_argument("--seed",     type=int, default=42)
    args = parser.parse_args()

    generate(
        target_records=args.records,
        n_machines=args.machines,
        interval_min=args.interval,
        out_dir=args.out,
        chunk_size=args.chunk,
        seed=args.seed,
    )
