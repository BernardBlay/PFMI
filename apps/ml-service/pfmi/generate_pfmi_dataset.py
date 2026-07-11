"""
PFMI Synthetic Dataset Generator
Predictive Failure/Maintenance Intelligence for Wheel Loaders
Simulates IoT sensor data from Cat 950GC, Volvo L120H, Komatsu WA380, Hyundai HL960
"""

import numpy as np
import pandas as pd
import json
import math
import random
import hashlib
import os
import time
from datetime import datetime, timedelta
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────────

CONFIG = {
    "target_records":    10_000_000,
    "num_machines":      120,
    "interval_minutes":  5,          # sensor sampling interval
    "output_dir":        "output",
    "chunk_size":        500_000,    # rows per CSV chunk
    "random_seed":       42,
}

np.random.seed(CONFIG["random_seed"])
random.seed(CONFIG["random_seed"])

# ──────────────────────────────────────────────────────────────────────────────
# MACHINE CATALOGUE
# ──────────────────────────────────────────────────────────────────────────────

MACHINES = [
    {"manufacturer": "Caterpillar", "model": "950GC",  "hp": 185, "bucket_cap": 3.1},
    {"manufacturer": "Volvo",       "model": "L120H",  "hp": 195, "bucket_cap": 3.4},
    {"manufacturer": "Komatsu",     "model": "WA380",  "hp": 171, "bucket_cap": 2.8},
    {"manufacturer": "Hyundai",     "model": "HL960",  "hp": 194, "bucket_cap": 3.2},
]

FIRMWARE_VERSIONS = {
    "Caterpillar": ["CAT-FW-3.1.2", "CAT-FW-3.2.0", "CAT-FW-3.3.1"],
    "Volvo":       ["VCE-FW-4.0.5", "VCE-FW-4.1.0", "VCE-FW-4.2.3"],
    "Komatsu":     ["KOM-FW-2.8.1", "KOM-FW-2.9.0", "KOM-FW-3.0.2"],
    "Hyundai":     ["HCE-FW-5.1.0", "HCE-FW-5.2.1", "HCE-FW-5.3.0"],
}

JOB_SITES = [
    ("Copper Ridge Mine",       -23.55, -46.63, 850,  "Mining"),
    ("Port Authority Yard",      1.35,  103.81, 15,   "Port"),
    ("Highland Quarry",         51.50,   -0.12, 320,  "Quarry"),
    ("Desert Sand Fill",        24.87,   67.01, 45,   "Construction"),
    ("Arctic Aggregate",        64.15,  -21.94, 110,  "Quarry"),
    ("Tropical Bauxite Site",   -5.79,  -35.20, 30,   "Mining"),
    ("Mountain Road Project",   45.42,    6.85, 1900, "Construction"),
    ("Coastal Reclamation",     22.28,  114.15, 5,    "Construction"),
    ("Iron Ore Station",        -22.90,  -43.17,200,  "Mining"),
    ("Urban Development East",  40.71,  -74.00, 10,   "Construction"),
]

TERRAIN_TYPES = ["Flat", "Gravel", "Rocky", "Muddy", "Sandy", "Compacted", "Steep", "Uneven"]
WEATHER_TYPES = ["Clear", "Cloudy", "Rain", "Heavy Rain", "Dust Storm", "Fog", "Snow", "Hot & Dry"]
WORKING_MODES = ["Digging", "Loading", "Traveling", "Dumping", "Idle", "Grading", "Stockpiling"]
GEAR_OPTIONS  = [1, 2, 3, 4, "N", "R"]
SHIFTS        = ["Day", "Night", "Swing"]
OPERATORS     = [f"OP{str(i).zfill(4)}" for i in range(1, 81)]
FAILURE_TYPES = [
    "Hydraulic Pump Failure", "Bearing Wear", "Engine Overheating",
    "Fuel System Failure", "Turbo Failure", "Transmission Failure",
    "Brake Failure", "Tire Failure", "Electrical Failure",
    "Cooling System Failure", "Sensor Failure", "No Failure",
]

FAULT_CATEGORIES = ["Mechanical", "Hydraulic", "Electrical", "Thermal", "None"]


# ──────────────────────────────────────────────────────────────────────────────
# MACHINE STATE CLASS
# ──────────────────────────────────────────────────────────────────────────────

class WheelLoaderState:
    """Tracks degradation, maintenance history, and failure progression for one machine."""

    def __init__(self, machine_id, spec, site):
        self.machine_id   = machine_id
        self.spec         = spec
        self.site         = site
        self.year         = random.randint(2015, 2023)
        self.engine_hours = random.uniform(500, 18000)
        self.serial       = f"{spec['manufacturer'][:3].upper()}-{machine_id:04d}-{random.randint(100000,999999)}"
        self.firmware     = random.choice(FIRMWARE_VERSIONS[spec["manufacturer"]])
        self.operator     = random.choice(OPERATORS)
        self.op_exp       = random.randint(1, 25)          # years

        # Degradation state  (0=new, 1=failed)
        self.bearing_wear          = random.uniform(0.0, 0.3)
        self.hydraulic_pump_health = random.uniform(0.7, 1.0)
        self.turbo_health          = random.uniform(0.7, 1.0)
        self.transmission_health   = random.uniform(0.7, 1.0)
        self.cooling_health        = random.uniform(0.7, 1.0)
        self.brake_health          = random.uniform(0.7, 1.0)
        self.tire_wear             = [random.uniform(0.0, 0.4) for _ in range(4)]  # FL FR RL RR

        # Maintenance tracking
        self.last_service_days     = random.randint(0, 90)
        self.last_service_hours    = random.uniform(0, 500)
        self.lube_status           = random.choice(["Good", "Fair", "Poor"])
        self.filter_age_hours      = random.uniform(0, 500)
        self.oil_age_hours         = random.uniform(0, 500)
        self.prev_failure_count    = random.randint(0, 8)
        self.parts_replaced        = random.choice(["Nothing", "Filters", "Belts", "Pump", "Bearings", "Tires"])
        self.warranty              = random.choice(["Active", "Expired"])

        # Active failure being simulated
        self.active_failure        = "No Failure"
        self.failure_countdown     = 0    # minutes until failure
        self.failure_severity      = 0.0  # 0→1 degradation factor for current failure arc
        self.dtc_list              = []
        self.warning_level         = "None"

        # Operator shift
        self.shift = random.choice(SHIFTS)
        self.shift_change_counter  = random.randint(0, 480)

        # Working mode
        self.working_mode = random.choice(WORKING_MODES)
        self.mode_counter = random.randint(0, 30)

    # ── Maintenance reset ───────────────────────────────────────────────────
    def apply_maintenance(self):
        """Simulate a maintenance event resetting relevant degradation."""
        self.last_service_days  = 0
        self.last_service_hours = 0
        self.filter_age_hours   = 0
        self.oil_age_hours      = 0
        self.lube_status        = "Good"
        self.parts_replaced     = random.choice(["Filters", "Oil", "Belts", "Bearings", "Pump"])
        self.prev_failure_count += (1 if self.active_failure != "No Failure" else 0)

        # Partial health recovery depending on what was replaced
        if "Bearing" in self.parts_replaced:
            self.bearing_wear = random.uniform(0.0, 0.05)
        if "Pump" in self.parts_replaced:
            self.hydraulic_pump_health = random.uniform(0.85, 1.0)
        self.cooling_health  = min(1.0, self.cooling_health + 0.15)
        self.brake_health    = min(1.0, self.brake_health   + 0.10)
        self.active_failure  = "No Failure"
        self.failure_countdown = 0
        self.failure_severity  = 0.0
        self.dtc_list          = []
        self.warning_level     = "None"

    # ── Step forward one time interval ─────────────────────────────────────
    def step(self, minutes, ambient_temp, load_factor):
        """Advance degradation by `minutes` of operation."""
        ops_hours = minutes / 60.0

        # Natural degradation (load-accelerated)
        accel = 1.0 + load_factor * 1.5
        self.bearing_wear          = min(1.0, self.bearing_wear          + ops_hours * 0.00008 * accel)
        self.hydraulic_pump_health = max(0.0, self.hydraulic_pump_health - ops_hours * 0.00005 * accel)
        self.turbo_health          = max(0.0, self.turbo_health          - ops_hours * 0.00004 * accel)
        self.transmission_health   = max(0.0, self.transmission_health   - ops_hours * 0.00003 * accel)
        self.cooling_health        = max(0.0, self.cooling_health        - ops_hours * 0.00003 * (1 + (ambient_temp - 25) / 50))
        self.brake_health          = max(0.0, self.brake_health          - ops_hours * 0.00004 * accel)
        self.tire_wear             = [min(1.0, w + ops_hours * 0.00006 * accel) for w in self.tire_wear]
        self.engine_hours         += ops_hours
        self.last_service_hours   += ops_hours
        self.filter_age_hours     += ops_hours
        self.oil_age_hours        += ops_hours
        self.last_service_days    += minutes / 1440.0

        # Decide if a new failure arc should start
        if self.active_failure == "No Failure":
            self._maybe_start_failure()

        # Advance active failure countdown
        if self.active_failure != "No Failure" and self.failure_countdown > 0:
            self.failure_countdown -= minutes
            self.failure_severity   = max(0.0, 1.0 - self.failure_countdown / self._failure_window())

        # Shift changes
        self.shift_change_counter -= minutes
        if self.shift_change_counter <= 0:
            self.shift = random.choice(SHIFTS)
            self.shift_change_counter = random.randint(420, 540)
            self.operator = random.choice(OPERATORS)

        # Working mode changes
        self.mode_counter -= minutes
        if self.mode_counter <= 0:
            self.working_mode = random.choice(WORKING_MODES)
            self.mode_counter = random.randint(5, 60)

        # Service trigger (every ~500 hours or 90 days)
        if self.last_service_hours > random.uniform(480, 560) or self.last_service_days > random.uniform(85, 95):
            if random.random() < 0.7:   # 70% chance maintenance happens on schedule
                self.apply_maintenance()

        # Update oil lube status
        if self.oil_age_hours < 150:
            self.lube_status = "Good"
        elif self.oil_age_hours < 350:
            self.lube_status = "Fair"
        else:
            self.lube_status = "Poor"

    def _failure_window(self):
        """Minutes of degradation before the failure hits."""
        return {
            "Hydraulic Pump Failure": 4320,
            "Bearing Wear":           8640,
            "Engine Overheating":     2880,
            "Fuel System Failure":    1440,
            "Turbo Failure":          5760,
            "Transmission Failure":   7200,
            "Brake Failure":          4320,
            "Tire Failure":           2160,
            "Electrical Failure":     1440,
            "Cooling System Failure": 2880,
            "Sensor Failure":         720,
            "No Failure":             0,
        }.get(self.active_failure, 4320)

    def _maybe_start_failure(self):
        """Stochastically trigger a failure arc based on component health."""
        candidates = []
        if self.bearing_wear > 0.55:
            candidates.append(("Bearing Wear", (self.bearing_wear - 0.55) * 0.05))
        if self.hydraulic_pump_health < 0.45:
            candidates.append(("Hydraulic Pump Failure", (0.45 - self.hydraulic_pump_health) * 0.06))
        if self.turbo_health < 0.45:
            candidates.append(("Turbo Failure", (0.45 - self.turbo_health) * 0.04))
        if self.transmission_health < 0.40:
            candidates.append(("Transmission Failure", (0.40 - self.transmission_health) * 0.05))
        if self.cooling_health < 0.45:
            candidates.append(("Cooling System Failure", (0.45 - self.cooling_health) * 0.04))
        if self.cooling_health < 0.35:
            candidates.append(("Engine Overheating", (0.35 - self.cooling_health) * 0.05))
        if self.brake_health < 0.40:
            candidates.append(("Brake Failure", (0.40 - self.brake_health) * 0.04))
        if max(self.tire_wear) > 0.70:
            candidates.append(("Tire Failure", (max(self.tire_wear) - 0.70) * 0.06))
        # Low-probability random failures
        if random.random() < 0.00008:
            candidates.append(("Electrical Failure", 0.002))
        if random.random() < 0.00006:
            candidates.append(("Fuel System Failure", 0.002))
        if random.random() < 0.00005:
            candidates.append(("Sensor Failure", 0.003))

        if not candidates:
            return

        total = sum(p for _, p in candidates)
        r = random.random() * total
        cumulative = 0
        for failure, prob in candidates:
            cumulative += prob
            if r <= cumulative:
                self.active_failure    = failure
                self.failure_countdown = self._failure_window()
                self.failure_severity  = 0.0
                break


# ──────────────────────────────────────────────────────────────────────────────
# SENSOR READING FUNCTIONS
# ──────────────────────────────────────────────────────────────────────────────

def _noise(scale=1.0):
    return np.random.normal(0, scale)

def _clamp(val, lo, hi):
    return max(lo, min(hi, val))

def _maybe_nan(val, p_missing=0.003):
    """Randomly inject missing values."""
    if random.random() < p_missing:
        return np.nan
    return val

def build_record(state: WheelLoaderState, ts: datetime, interval_min: int) -> dict:
    """Generate one sensor record for the given machine state and timestamp."""
    site    = state.site
    spec    = state.spec
    sev     = state.failure_severity   # 0=healthy, 1=about to fail
    failure = state.active_failure

    # ── Environment ─────────────────────────────────────────────────────────
    month          = ts.month
    seasonal_bias  = 10 * math.sin((month - 6) * math.pi / 6)   # warmer in summer
    base_temp      = {"Mining": 30, "Port": 27, "Quarry": 22, "Construction": 25}.get(site[4], 25)
    ambient_temp   = _clamp(base_temp + seasonal_bias + _noise(5), -20, 55)
    humidity       = _clamp(random.gauss(60, 20), 5, 100)
    dust_level     = _clamp(random.gauss(35, 15), 0, 100)
    terrain        = random.choice(TERRAIN_TYPES)
    slope          = _clamp(_noise(8), -30, 30)

    # Derive weather from ambient conditions
    if humidity > 85:
        wx = "Rain"
    elif ambient_temp > 40 and dust_level > 60:
        wx = "Dust Storm"
    elif ambient_temp < 0:
        wx = "Snow"
    else:
        wx = random.choice(["Clear", "Cloudy", "Clear", "Clear"])

    rainfall = max(0, _noise(2)) if wx in ["Rain", "Heavy Rain"] else 0

    # ── Operating state ──────────────────────────────────────────────────────
    is_idle = state.working_mode == "Idle"
    rpm_base     = _clamp(random.gauss(780, 40), 700, 900) if is_idle else _clamp(random.gauss(1900, 150), 1400, 2300)
    engine_load  = _clamp(random.gauss(0.3 if is_idle else 0.72, 0.15), 0.05, 1.0)
    bucket_load  = _clamp(random.gauss(0 if is_idle else spec["bucket_cap"] * 0.75, 0.4), 0, spec["bucket_cap"])
    hyd_load     = _clamp(engine_load * 0.65 + _noise(0.08), 0.05, 1.0)
    travel_speed = _clamp(random.gauss(0 if is_idle else 14, 4), 0, 38)
    fuel_rate    = _clamp(engine_load * 22 + _noise(2), 2, 32)   # L/hr
    fuel_level   = _clamp(random.gauss(65, 20), 5, 100)

    # ── Engine sensors ───────────────────────────────────────────────────────
    # Baseline temps rise with load; failures push them higher
    cooling_factor = 1.0 + (1.0 - state.cooling_health) * 0.4

    coolant_temp   = _clamp(70 + engine_load * 30 + ambient_temp * 0.3 + cooling_factor * 10
                            + (sev * 35 if failure in ("Engine Overheating", "Cooling System Failure") else 0)
                            + _noise(2), 60, 130)
    oil_temp       = _clamp(coolant_temp + 8 + engine_load * 10 + _noise(2), 65, 145)
    eng_temp       = _clamp(coolant_temp + 5 + _noise(3), 65, 140)
    oil_press      = _clamp(380 - engine_load * 40 - state.bearing_wear * 60
                            - (sev * 120 if failure == "Engine Overheating" else 0) + _noise(10), 120, 500)
    coolant_press  = _clamp(1.4 - (1.0 - state.cooling_health) * 0.5 + _noise(0.05), 0.5, 2.2)
    intake_air_t   = _clamp(ambient_temp + 20 + engine_load * 10 + _noise(3), 15, 80)
    intake_press   = _clamp(1.2 + engine_load * 0.3 + _noise(0.05), 0.9, 2.0)
    exhaust_temp   = _clamp(350 + engine_load * 150 + (sev * 200 if failure == "Turbo Failure" else 0) + _noise(10), 200, 750)
    exhaust_bp     = _clamp(3 + engine_load * 2 + (sev * 8 if failure == "Turbo Failure" else 0) + _noise(0.3), 1, 15)
    turbo_boost    = _clamp(1.5 + engine_load * 0.8 - (sev * 0.9 if failure == "Turbo Failure" else 0) + _noise(0.05), 0.5, 3.0)
    fuel_press     = _clamp(550 - (sev * 250 if failure == "Fuel System Failure" else 0) + _noise(15), 50, 700)
    air_filter_r   = _clamp(state.filter_age_hours / 5 + dust_level * 0.3 + _noise(2), 0, 100)

    # ── Hydraulic system ─────────────────────────────────────────────────────
    hyd_press      = _clamp(250 * hyd_load - (sev * 150 if failure == "Hydraulic Pump Failure" else 0) + _noise(8), 20, 380)
    hyd_temp       = _clamp(45 + hyd_load * 40 + ambient_temp * 0.2 + cooling_factor * 5
                            + (sev * 30 if failure == "Hydraulic Pump Failure" else 0) + _noise(3), 30, 120)
    pump_eff       = _clamp(state.hydraulic_pump_health - (sev * 0.5 if failure == "Hydraulic Pump Failure" else 0) + _noise(0.02), 0.1, 1.0)
    pump_vib       = _clamp(1.5 + (1 - pump_eff) * 8 + _noise(0.2), 0.5, 15)
    pump_current   = _clamp(engine_load * 45 + _noise(2), 5, 80)
    hyd_flow       = _clamp(pump_eff * hyd_load * 120 + _noise(3), 0, 160)
    hyd_oil_lvl    = _clamp(85 - (1.0 - pump_eff) * 20 + _noise(2), 20, 100)

    # ── Electrical ───────────────────────────────────────────────────────────
    batt_v         = _clamp(24.5 - (sev * 4 if failure == "Electrical Failure" else 0) + _noise(0.3), 18, 30)
    batt_i         = _clamp(engine_load * 80 + _noise(5), -10, 200)
    alt_out        = _clamp(28 - (sev * 6 if failure == "Electrical Failure" else 0) + _noise(0.5), 10, 32)
    ecu_temp       = _clamp(55 + engine_load * 10 + ambient_temp * 0.1 + _noise(2), 40, 95)

    # ── Mechanical ───────────────────────────────────────────────────────────
    trans_temp     = _clamp(75 + engine_load * 30 + (sev * 40 if failure == "Transmission Failure" else 0) + _noise(3), 55, 145)
    trans_press    = _clamp(1600 - (sev * 800 if failure == "Transmission Failure" else 0) + _noise(30), 200, 2200)
    brake_temp     = _clamp(80 + engine_load * 50 + (sev * 120 if failure == "Brake Failure" else 0) + _noise(5), 40, 350)
    brake_press    = _clamp(120 - (sev * 60 if failure == "Brake Failure" else 0) + _noise(5), 10, 180)

    def tire_psi(wear, pos_sev=0):
        return _clamp(105 - wear * 30 - pos_sev * 40 + _noise(2), 20, 130)

    tire_fail_sev = sev if failure == "Tire Failure" else 0
    tpFL = tire_psi(state.tire_wear[0], tire_fail_sev * (1 if random.random() < 0.5 else 0))
    tpFR = tire_psi(state.tire_wear[1])
    tpRL = tire_psi(state.tire_wear[2], tire_fail_sev * (1 if random.random() < 0.5 else 0))
    tpRR = tire_psi(state.tire_wear[3])
    tire_temp      = _clamp(35 + engine_load * 20 + ambient_temp * 0.2 + _noise(3), 25, 100)
    steer_angle    = _clamp(_noise(15), -55, 55)
    susp_vib       = _clamp(1.0 + engine_load * 2 + abs(slope) * 0.05 + _noise(0.2), 0.5, 12)

    # ── Condition Monitoring ─────────────────────────────────────────────────
    # Bearing wear drives vibration
    bearing_factor = 1.0 + state.bearing_wear * 5 + (sev * 3 if failure == "Bearing Wear" else 0)
    overall_vib    = _clamp(1.2 * bearing_factor + engine_load * 1.5 + _noise(0.15), 0.5, 25)
    rms_vib        = _clamp(overall_vib * 0.7 + _noise(0.1), 0.3, 18)
    fft_peak       = _clamp(overall_vib * 1.3 + _noise(0.2), 0.5, 30)
    bearing_temp   = _clamp(65 + state.bearing_wear * 40 + (sev * 50 if failure == "Bearing Wear" else 0) + _noise(2), 50, 160)
    bearing_vib    = _clamp(overall_vib * 0.85 + _noise(0.1), 0.3, 20)
    acoustic_noise = _clamp(72 + engine_load * 12 + overall_vib * 1.5 + _noise(2), 60, 110)
    ultrasonic     = _clamp(state.bearing_wear * 50 + (sev * 30 if failure == "Bearing Wear" else 0) + _noise(3), 0, 100)

    # ── Labels ───────────────────────────────────────────────────────────────
    mins_to_fail    = state.failure_countdown if state.active_failure != "No Failure" else 99999
    fail_24h        = int(0 < mins_to_fail <= 1440)
    fail_7d         = int(0 < mins_to_fail <= 10080)
    rul             = round(mins_to_fail / 60, 1) if mins_to_fail < 99999 else None  # hours
    maintenance_act = "Urgent" if fail_24h else ("Soon" if fail_7d else "Routine")

    # ── DTC generation ───────────────────────────────────────────────────────
    dtcs = _generate_dtcs(failure, sev, oil_press, coolant_temp, hyd_press, batt_v, trans_press)
    warn_level = "Critical" if fail_24h else ("High" if fail_7d and sev > 0.4 else ("Medium" if fail_7d else "Low" if sev > 0.1 else "OK"))

    # ── Assemble record ──────────────────────────────────────────────────────
    r = {
        # Machine info
        "Machine_ID":            state.machine_id,
        "Manufacturer":          spec["manufacturer"],
        "Model":                 spec["model"],
        "Year":                  state.year,
        "Engine_Hours":          round(state.engine_hours, 1),
        "Machine_Age":           round((ts - datetime(state.year, 1, 1)).days / 365.25, 2),
        "Serial_Number":         state.serial,
        "Firmware_Version":      state.firmware,

        # GPS & Environment
        "Timestamp":             ts.isoformat(),
        "Latitude":              round(site[1] + _noise(0.01), 5),
        "Longitude":             round(site[2] + _noise(0.01), 5),
        "Elevation":             round(site[3] + _noise(5), 1),
        "Ambient_Temperature":   round(ambient_temp, 1),
        "Humidity":              round(humidity, 1),
        "Rainfall":              round(rainfall, 2),
        "Dust_Level":            round(dust_level, 1),
        "Terrain_Type":          terrain,
        "Slope":                 round(slope, 1),
        "Altitude":              round(site[3] + _noise(3), 1),
        "Weather":               wx,
        "Job_Site":              site[0],

        # Operating state
        "Engine_RPM":            round(rpm_base + _noise(30), 0),
        "Fuel_Rate":             round(_maybe_nan(fuel_rate, 0.004), 2),
        "Fuel_Level":            round(fuel_level, 1),
        "Engine_Load":           round(engine_load, 3),
        "Hydraulic_Load":        round(hyd_load, 3),
        "Bucket_Load":           round(_maybe_nan(bucket_load, 0.005), 2),
        "Travel_Speed":          round(travel_speed, 1),
        "Gear":                  random.choice(GEAR_OPTIONS),
        "Idle_Time":             round(random.uniform(0, interval_min) if is_idle else 0, 1),
        "PTO_Status":            random.choice(["Active", "Inactive"]),
        "Working_Mode":          state.working_mode,
        "Operator_ID":           state.operator,
        "Operator_Experience":   state.op_exp,
        "Shift":                 state.shift,

        # Engine sensors
        "Coolant_Temperature":   round(_maybe_nan(coolant_temp, 0.003), 1),
        "Oil_Temperature":       round(_maybe_nan(oil_temp,     0.003), 1),
        "Engine_Temperature":    round(_maybe_nan(eng_temp,     0.004), 1),
        "Oil_Pressure":          round(_maybe_nan(oil_press,    0.003), 1),
        "Coolant_Pressure":      round(_maybe_nan(coolant_press,0.003), 3),
        "Intake_Air_Temperature":round(_maybe_nan(intake_air_t, 0.003), 1),
        "Intake_Pressure":       round(_maybe_nan(intake_press, 0.003), 3),
        "Exhaust_Temperature":   round(_maybe_nan(exhaust_temp, 0.004), 1),
        "Exhaust_Backpressure":  round(_maybe_nan(exhaust_bp,   0.003), 2),
        "Turbo_Boost":           round(_maybe_nan(turbo_boost,  0.003), 3),
        "Fuel_Pressure":         round(_maybe_nan(fuel_press,   0.003), 1),
        "Air_Filter_Restriction":round(_maybe_nan(air_filter_r, 0.004), 1),

        # Hydraulic system
        "Hydraulic_Pressure":    round(_maybe_nan(hyd_press,    0.003), 1),
        "Hydraulic_Temperature": round(_maybe_nan(hyd_temp,     0.003), 1),
        "Pump_Efficiency":       round(_maybe_nan(pump_eff,     0.003), 3),
        "Pump_Vibration":        round(_maybe_nan(pump_vib,     0.003), 2),
        "Pump_Current":          round(_maybe_nan(pump_current, 0.003), 1),
        "Hydraulic_Flow":        round(_maybe_nan(hyd_flow,     0.003), 1),
        "Hydraulic_Oil_Level":   round(_maybe_nan(hyd_oil_lvl,  0.003), 1),

        # Electrical
        "Battery_Voltage":       round(_maybe_nan(batt_v,   0.003), 2),
        "Battery_Current":       round(_maybe_nan(batt_i,   0.003), 1),
        "Alternator_Output":     round(_maybe_nan(alt_out,  0.003), 2),
        "ECU_Temperature":       round(_maybe_nan(ecu_temp, 0.003), 1),

        # Mechanical
        "Transmission_Temperature": round(_maybe_nan(trans_temp,  0.003), 1),
        "Transmission_Pressure":    round(_maybe_nan(trans_press, 0.003), 1),
        "Brake_Temperature":     round(_maybe_nan(brake_temp,  0.004), 1),
        "Brake_Pressure":        round(_maybe_nan(brake_press, 0.003), 1),
        "Tire_Pressure_FL":      round(_maybe_nan(tpFL, 0.003), 1),
        "Tire_Pressure_FR":      round(_maybe_nan(tpFR, 0.003), 1),
        "Tire_Pressure_RL":      round(_maybe_nan(tpRL, 0.003), 1),
        "Tire_Pressure_RR":      round(_maybe_nan(tpRR, 0.003), 1),
        "Tire_Temperature":      round(_maybe_nan(tire_temp, 0.003), 1),
        "Steering_Angle":        round(_maybe_nan(steer_angle, 0.002), 1),
        "Suspension_Vibration":  round(_maybe_nan(susp_vib, 0.003), 2),

        # Condition monitoring
        "Overall_Vibration":     round(_maybe_nan(overall_vib,    0.003), 3),
        "FFT_Peak":              round(_maybe_nan(fft_peak,        0.003), 3),
        "RMS_Vibration":         round(_maybe_nan(rms_vib,         0.003), 3),
        "Bearing_Temperature":   round(_maybe_nan(bearing_temp,    0.003), 1),
        "Bearing_Vibration":     round(_maybe_nan(bearing_vib,     0.003), 3),
        "Acoustic_Noise_Level":  round(_maybe_nan(acoustic_noise,  0.003), 1),
        "Ultrasonic_Emission":   round(_maybe_nan(ultrasonic,      0.003), 1),

        # Maintenance history
        "Last_Service_Days":     round(state.last_service_days, 1),
        "Last_Service_Hours":    round(state.last_service_hours, 1),
        "Lubrication_Status":    state.lube_status,
        "Filter_Age":            round(state.filter_age_hours, 1),
        "Oil_Age":               round(state.oil_age_hours, 1),
        "Previous_Failure_Count":state.prev_failure_count,
        "Parts_Replaced":        state.parts_replaced,
        "Warranty_Status":       state.warranty,

        # Diagnostics
        "Active_DTC":            "|".join(dtcs) if dtcs else "NO_DTC",
        "Warning_Level":         warn_level if warn_level != "None" else "OK",
        "Error_Code":            dtcs[0] if dtcs else "NO_DTC",
        "Fault_Category":        _fault_category(failure),

        # Labels
        "Failure_Within_24h":   fail_24h,
        "Failure_Within_7d":    fail_7d,
        "Remaining_Useful_Life": rul,
        "Maintenance_Action":    maintenance_act,
        "Failure_Type":          state.active_failure,
    }

    return r


def _generate_dtcs(failure, sev, oil_p, coolant_t, hyd_p, batt_v, trans_p):
    codes = []
    if sev > 0.3:
        dtc_map = {
            "Hydraulic Pump Failure":  f"P2290-{int(sev*9):02d}",
            "Bearing Wear":            f"C0500-{int(sev*9):02d}",
            "Engine Overheating":      f"P0217-{int(sev*9):02d}",
            "Fuel System Failure":     f"P0087-{int(sev*9):02d}",
            "Turbo Failure":           f"P0234-{int(sev*9):02d}",
            "Transmission Failure":    f"P0700-{int(sev*9):02d}",
            "Brake Failure":           f"C0110-{int(sev*9):02d}",
            "Tire Failure":            f"C1110-{int(sev*9):02d}",
            "Electrical Failure":      f"B1000-{int(sev*9):02d}",
            "Cooling System Failure":  f"P0128-{int(sev*9):02d}",
            "Sensor Failure":          f"U0100-{int(sev*9):02d}",
        }
        if failure in dtc_map:
            codes.append(dtc_map[failure])
    # secondary threshold-based codes
    if oil_p < 200:  codes.append("P0520")
    if coolant_t > 115: codes.append("P0217")
    if hyd_p < 50:   codes.append("P2290")
    if batt_v < 22:  codes.append("B1001")
    if trans_p < 400: codes.append("P0700")
    return list(set(codes))[:4]   # max 4 active codes


def _fault_category(failure):
    mapping = {
        "Hydraulic Pump Failure": "Hydraulic",
        "Bearing Wear": "Mechanical",
        "Engine Overheating": "Thermal",
        "Fuel System Failure": "Mechanical",
        "Turbo Failure": "Mechanical",
        "Transmission Failure": "Mechanical",
        "Brake Failure": "Mechanical",
        "Tire Failure": "Mechanical",
        "Electrical Failure": "Electrical",
        "Cooling System Failure": "Thermal",
        "Sensor Failure": "Electrical",
        "No Failure": "No Fault",
    }
    return mapping.get(failure, "No Fault")


# ──────────────────────────────────────────────────────────────────────────────
# MAIN GENERATION LOOP
# ──────────────────────────────────────────────────────────────────────────────

def generate(cfg=CONFIG):
    out_dir = Path(cfg["output_dir"])
    out_dir.mkdir(exist_ok=True)

    n_machines  = cfg["num_machines"]
    interval    = cfg["interval_minutes"]
    target      = cfg["target_records"]
    chunk_size  = cfg["chunk_size"]

    # Build machines
    machines = []
    for mid in range(1, n_machines + 1):
        spec = MACHINES[(mid - 1) % len(MACHINES)]
        site = JOB_SITES[(mid - 1) % len(JOB_SITES)]
        machines.append(WheelLoaderState(mid, spec, site))

    # Spread machines across different starting times over ~3 years
    base_times = [datetime(2022, 1, 1) + timedelta(days=random.randint(0, 30)) for _ in machines]

    total_written = 0
    chunk_idx     = 0
    buffer        = []
    csv_paths     = []

    print(f"[PFMI Generator] Target: {target:,} records | Machines: {n_machines} | Interval: {interval} min")
    t0 = time.time()

    while total_written < target:
        for i, state in enumerate(machines):
            if total_written >= target:
                break

            ts         = base_times[i]
            load_fac   = random.uniform(0.3, 0.9)
            ambient_t  = 25 + 10 * math.sin((ts.month - 6) * math.pi / 6)

            state.step(interval, ambient_t, load_fac)
            rec = build_record(state, ts, interval)
            buffer.append(rec)
            base_times[i] = ts + timedelta(minutes=interval)
            total_written += 1

        # Flush chunk
        if len(buffer) >= chunk_size:
            path = out_dir / f"wheel_loader_pfmi_chunk_{chunk_idx:04d}.csv"
            df   = pd.DataFrame(buffer[:chunk_size])
            df.to_csv(path, index=False)
            csv_paths.append(str(path))
            buffer = buffer[chunk_size:]
            chunk_idx += 1
            elapsed = time.time() - t0
            rate = total_written / elapsed
            print(f"  Chunk {chunk_idx:04d} written | {total_written:>10,} rows | {rate:,.0f} rows/sec")

    # Flush remainder
    if buffer:
        path = out_dir / f"wheel_loader_pfmi_chunk_{chunk_idx:04d}.csv"
        pd.DataFrame(buffer).to_csv(path, index=False)
        csv_paths.append(str(path))
        print(f"  Final chunk written | {total_written:,} rows total")

    # ── Merge all chunks into single CSV (or keep chunked for large sets)
    merged_path = out_dir / "wheel_loader_pfmi_full.csv"
    print(f"\n[PFMI] Merging {len(csv_paths)} chunks -> {merged_path}")
    first = True
    with open(merged_path, "wb") as fout:
        for p in csv_paths:
            with open(p, "rb") as fin:
                if not first:
                    fin.readline()   # skip header on subsequent chunks
                fout.write(fin.read())
            first = False

    print(f"[PFMI] Merged CSV: {merged_path}  ({merged_path.stat().st_size / 1e9:.2f} GB)")

    # ── Small JSON sample (first 1000 rows)
    sample_df   = pd.read_csv(merged_path, nrows=1000)
    json_path   = out_dir / "wheel_loader_pfmi_sample_1000.json"
    sample_df.to_json(json_path, orient="records", indent=2)
    print(f"[PFMI] JSON sample: {json_path}")

    total_elapsed = time.time() - t0
    print(f"\n[PFMI] Done in {total_elapsed:.1f}s — {total_written:,} records generated.")
    return merged_path, csv_paths


# ──────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    generate()
