"""
PFMI RUL Estimation Engine
==========================
Physics-informed Remaining Useful Life estimator.

Strategy
--------
We use a **degradation-rate model**: each sensor has a normal operating range
and a known failure threshold.  The further a reading is outside the normal
band, the faster the machine is consuming its remaining life.

RUL formula (per sensor):
    margin   = (threshold - current) / (threshold - nominal)   # 1.0 = healthy, 0 = at threshold
    rul_hrs  = baseline_hours * margin^stress_exponent

The final RUL is the *minimum* across all sensors (weakest-link principle),
scaled by a confidence-weighted composite degradation score.

This gives a concrete, explainable number like "38 hours until service" rather
than just "anomaly detected" — which is the core value of predictive maintenance.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Sensor parameter table
# Each entry: (nominal, warning_threshold, failure_threshold,
#              baseline_rul_hours, stress_exponent, display_name)
#
# baseline_rul_hours = typical hours from nominal to failure for THIS sensor
# stress_exponent   = > 1 means degradation accelerates (wear); < 1 means
#                     more linear (e.g. temperature)
# ---------------------------------------------------------------------------

@dataclass
class SensorSpec:
    nominal: float          # healthy midpoint value
    warning: float          # threshold where degradation is notable
    failure: float          # threshold considered failure / stop-machine
    baseline_hours: float   # hours from nominal to failure (type-dependent)
    exponent: float         # degradation rate curve shape
    unit: str               # display unit
    direction: str          # "high" = higher is worse, "low" = lower is worse


# Industrial pump / hydraulic machine defaults
# (covers the AnomalySimulator's temperature / vibration / pressure sensors)
SENSOR_SPECS: Dict[str, SensorSpec] = {
    # Temperature (°C) — cooling system
    "temperature": SensorSpec(
        nominal=68.0,  warning=80.0, failure=100.0,
        baseline_hours=240.0, exponent=2.2,
        unit="°C", direction="high",
    ),
    # Vibration (mm/s RMS) — bearing health
    "vibration": SensorSpec(
        nominal=2.2,  warning=5.0,  failure=10.0,
        baseline_hours=300.0, exponent=3.0,
        unit="mm/s", direction="high",
    ),
    # Pressure (bar) — hydraulic circuit
    "pressure": SensorSpec(
        nominal=4.1,  warning=3.0,  failure=1.5,   # too LOW is bad
        baseline_hours=500.0, exponent=1.5,
        unit="bar", direction="low",
    ),
    # Voltage (V) — electrical / motor
    "voltage": SensorSpec(
        nominal=220.0, warning=200.0, failure=180.0,
        baseline_hours=600.0, exponent=1.2,
        unit="V", direction="low",
    ),
    # Generic fallback: process_temp (°C)
    "process_temp": SensorSpec(
        nominal=68.0, warning=80.0, failure=100.0,
        baseline_hours=240.0, exponent=2.2,
        unit="°C", direction="high",
    ),
    # RPM — rotational speed (too high = fatigue)
    "rpm": SensorSpec(
        nominal=1450.0, warning=1700.0, failure=1900.0,
        baseline_hours=800.0, exponent=1.8,
        unit="rpm", direction="high",
    ),
    # Torque (Nm)
    "torque": SensorSpec(
        nominal=25.0, warning=45.0, failure=60.0,
        baseline_hours=400.0, exponent=2.0,
        unit="Nm", direction="high",
    ),
    # Tool wear (minutes of use)
    "tool_wear": SensorSpec(
        nominal=0.0, warning=150.0, failure=240.0,
        baseline_hours=240.0, exponent=1.0,
        unit="min", direction="high",
    ),
}


# ---------------------------------------------------------------------------
# Failure mode classification thresholds
# ---------------------------------------------------------------------------

FAILURE_RULES = [
    # (condition_fn, failure_mode, severity)
    (lambda s: s.get("temperature", 0) > 90 or s.get("process_temp", 0) > 90,
     "thermal_runaway",   "critical"),
    (lambda s: s.get("vibration", 0) > 8,
     "bearing_failure",   "critical"),
    (lambda s: s.get("temperature", 0) > 80 or s.get("process_temp", 0) > 80,
     "overheating",       "high"),
    (lambda s: s.get("vibration", 0) > 5,
     "bearing_wear",      "high"),
    (lambda s: s.get("pressure", 99) < 2.5,
     "hydraulic_loss",    "high"),
    (lambda s: s.get("pressure", 99) < 3.0,
     "pressure_drop",     "medium"),
    (lambda s: s.get("voltage", 999) < 195,
     "voltage_sag",       "medium"),
    (lambda s: s.get("tool_wear", 0) > 200,
     "tool_wear",         "medium"),
]


# ---------------------------------------------------------------------------
# Core RUL computation
# ---------------------------------------------------------------------------

@dataclass
class SensorContribution:
    sensor: str
    current: float
    nominal: float
    failure_threshold: float
    margin_pct: float        # 100 = fully healthy, 0 = at failure threshold
    rul_hours: float         # this sensor's contribution to overall RUL
    unit: str
    is_critical: bool        # at or past warning threshold


@dataclass
class RULResult:
    rul_hours: float                         # final RUL estimate in hours
    rul_days: float                          # convenience: hours / operating_hours_per_day
    confidence: float                        # 0–1 confidence in the estimate
    failure_mode: str                        # dominant predicted failure mode
    severity: str                            # "normal" | "low" | "medium" | "high" | "critical"
    anomaly_detected: bool
    degradation_pct: float                   # 0 = healthy, 100 = at failure
    sensor_breakdown: List[SensorContribution]
    recommendation: str
    operating_hours_per_day: float = 8.0


def estimate_rul(
    sensors: Dict[str, float],
    operating_hours_per_day: float = 8.0,
    machine_age_factor: float = 1.0,         # 1.0 = new, >1.0 = aged machine
) -> RULResult:
    """
    Compute Remaining Useful Life from sensor readings.

    Parameters
    ----------
    sensors : dict
        Sensor name → current reading.  Any subset of SENSOR_SPECS keys.
    operating_hours_per_day : float
        How many hours per day the machine runs (default 8h shift).
    machine_age_factor : float
        Multiplier that reduces RUL for aged machines (>1.0 shortens life).

    Returns
    -------
    RULResult with rul_hours, rul_days, failure_mode, severity, etc.
    """

    contributions: List[SensorContribution] = []

    for sensor_name, reading in sensors.items():
        spec = SENSOR_SPECS.get(sensor_name)
        if spec is None:
            continue

        # Compute margin: 1.0 = at nominal, 0.0 = at failure threshold
        if spec.direction == "high":
            # Higher reading = worse (e.g. temperature, vibration)
            span = spec.failure - spec.nominal
            if span <= 0:
                continue
            deviation = reading - spec.nominal
            margin = 1.0 - max(0.0, min(1.0, deviation / span))
        else:
            # Lower reading = worse (e.g. pressure, voltage)
            span = spec.nominal - spec.failure
            if span <= 0:
                continue
            deviation = spec.nominal - reading
            margin = 1.0 - max(0.0, min(1.0, deviation / span))

        # Apply power-law: degradation accelerates near failure
        # margin=1 → rul=baseline, margin=0 → rul=0
        margin_curved = math.pow(max(margin, 0.0), spec.exponent)
        rul_sensor = spec.baseline_hours * margin_curved / machine_age_factor

        # Is this sensor at or past warning?
        if spec.direction == "high":
            is_critical = reading >= spec.warning
        else:
            is_critical = reading <= spec.warning

        contributions.append(SensorContribution(
            sensor=sensor_name,
            current=reading,
            nominal=spec.nominal,
            failure_threshold=spec.failure,
            margin_pct=round(margin * 100.0, 1),
            rul_hours=round(max(0.0, rul_sensor), 1),
            unit=spec.unit,
            is_critical=is_critical,
        ))

    # If no known sensors, return a safe default
    if not contributions:
        return RULResult(
            rul_hours=240.0,
            rul_days=30.0,
            confidence=0.50,
            failure_mode="unknown",
            severity="normal",
            anomaly_detected=False,
            degradation_pct=0.0,
            sensor_breakdown=[],
            recommendation="No recognised sensors provided — RUL estimate unavailable.",
            operating_hours_per_day=operating_hours_per_day,
        )

    # Weakest-link principle: RUL = minimum across all sensors
    # But also take a weighted composite to smooth one-off spikes
    rul_min = min(c.rul_hours for c in contributions)
    rul_mean = sum(c.rul_hours for c in contributions) / len(contributions)

    # Weight 70% toward the minimum (conservative for safety)
    rul_hours = round(0.70 * rul_min + 0.30 * rul_mean, 1)
    rul_hours = max(0.0, rul_hours)

    # Degradation percentage (0 = new, 100 = failed)
    worst_margin = min(c.margin_pct for c in contributions)
    degradation_pct = round(100.0 - worst_margin, 1)

    # Confidence: higher when multiple sensors agree, lower when only one
    n_critical = sum(1 for c in contributions if c.is_critical)
    base_conf = 0.75 + 0.05 * min(len(contributions), 5)  # more sensors = more confident
    conf_penalty = 0.05 * n_critical  # critical sensors reduce confidence slightly
    confidence = round(min(0.97, max(0.50, base_conf - conf_penalty)), 2)

    # Failure mode detection
    failure_mode = "normal"
    severity = "normal"
    for condition, mode, sev in FAILURE_RULES:
        if condition(sensors):
            failure_mode = mode
            severity = sev
            break  # first match wins (rules ordered by severity)

    anomaly_detected = severity not in ("normal",)

    # Build recommendation
    recommendation = _build_recommendation(
        rul_hours, failure_mode, severity, contributions, operating_hours_per_day
    )

    rul_days = round(rul_hours / operating_hours_per_day, 1)

    return RULResult(
        rul_hours=rul_hours,
        rul_days=rul_days,
        confidence=confidence,
        failure_mode=failure_mode,
        severity=severity,
        anomaly_detected=anomaly_detected,
        degradation_pct=degradation_pct,
        sensor_breakdown=contributions,
        recommendation=recommendation,
        operating_hours_per_day=operating_hours_per_day,
    )


def _build_recommendation(
    rul_hours: float,
    failure_mode: str,
    severity: str,
    contributions: List[SensorContribution],
    hours_per_day: float,
) -> str:
    """Generate a plain-English maintenance recommendation."""
    days = rul_hours / hours_per_day

    if severity == "critical":
        return (
            f"STOP MACHINE — {failure_mode.replace('_', ' ').title()} detected. "
            f"Estimated {rul_hours:.0f} operating hours ({days:.1f} days) remaining. "
            "Schedule immediate inspection."
        )
    elif severity == "high":
        return (
            f"URGENT — {failure_mode.replace('_', ' ').title()} progressing. "
            f"Schedule maintenance within {rul_hours:.0f} hours ({days:.1f} days). "
            "Do not defer beyond next shift."
        )
    elif severity == "medium":
        worst = min(contributions, key=lambda c: c.margin_pct)
        return (
            f"PLAN SERVICE — {failure_mode.replace('_', ' ').title()} detected on "
            f"{worst.sensor} ({worst.current:.1f} {worst.unit}). "
            f"Estimated {rul_hours:.0f} hours ({days:.1f} days) until service required."
        )
    else:
        if rul_hours > 200:
            return f"Machine healthy. Next scheduled service in ~{rul_hours:.0f} hours ({days:.1f} days)."
        else:
            return (
                f"Approaching service interval. "
                f"~{rul_hours:.0f} hours ({days:.1f} days) remaining before recommended maintenance."
            )
