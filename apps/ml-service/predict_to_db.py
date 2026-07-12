#!/usr/bin/env python3
"""
PFMI ML-to-Database Writeback Pipeline
=======================================
Fetches all equipment and their latest sensor readings from Supabase,
runs ML predictions, and writes results back to the database:
  - Updates equipment.health_score and equipment.status
  - Creates alerts for critical/high severity predictions
  - Stores prediction history in ml_predictions table

Usage:
  python predict_to_db.py --dry-run    # Preview changes without writing
  python predict_to_db.py              # Execute full pipeline

Scheduler:
  Add to cron: */30 * * * * cd /path/to/ml-service && python predict_to_db.py
"""

import argparse
import json
import logging
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8000")

# Thresholds for alert generation
CRITICAL_HEALTH_THRESHOLD = 40  # health_score <= 40 → Critical alert
HIGH_HEALTH_THRESHOLD = 60      # health_score <= 60 → High alert
MEDIUM_HEALTH_THRESHOLD = 75    # health_score <= 75 → Medium alert

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("predict_to_db")


# ---------------------------------------------------------------------------
# Data Classes
# ---------------------------------------------------------------------------
@dataclass
class Equipment:
    """Equipment record from database."""
    id: str
    name: str
    status: str
    health_score: int


@dataclass
class SensorReading:
    """Latest sensor reading for equipment."""
    equipment_id: str
    timestamp: str
    temperature: Optional[float] = None
    vibration: Optional[float] = None
    pressure: Optional[float] = None
    voltage: Optional[float] = None
    rpm: Optional[float] = None
    power_output: Optional[float] = None


@dataclass
class MLPrediction:
    """ML prediction result."""
    equipment_id: str
    health_score: int
    status: str
    rul_hours: float
    rul_days: float
    severity: str
    failure_mode: str
    recommendation: str
    degradation_pct: float
    confidence: float
    sensor_data: Dict[str, Any]


# ---------------------------------------------------------------------------
# Supabase Client
# ---------------------------------------------------------------------------
class SupabaseClient:
    """Simple REST client for Supabase."""

    def __init__(self, url: str, anon_key: str):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": anon_key,
            "Authorization": f"Bearer {anon_key}",
            "Content-Type": "application/json",
        }

    def get(self, table: str, params: Optional[Dict] = None) -> List[Dict]:
        """Fetch records from a table."""
        url = f"{self.url}/rest/v1/{table}"
        try:
            resp = requests.get(url, headers=self.headers, params=params, timeout=10)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error fetching from {table}: {e}")
            logger.error(f"Response: {e.response.text if e.response else 'No response'}")
            raise
        except Exception as e:
            logger.error(f"Error fetching from {table}: {e}")
            raise

    def post(self, table: str, data: Dict) -> Dict:
        """Insert a single record."""
        url = f"{self.url}/rest/v1/{table}"
        resp = requests.post(url, headers=self.headers, json=data, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def patch(self, table: str, eq_id: str, data: Dict) -> Dict:
        """Update a record by id."""
        url = f"{self.url}/rest/v1/{table}?id=eq.{eq_id}"
        resp = requests.patch(url, headers=self.headers, json=data, timeout=10)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# ML Service Client
# ---------------------------------------------------------------------------
def call_ml_predict(sensor_data: Dict[str, float]) -> Dict[str, Any]:
    """
    Call ML service /predict/rul endpoint.
    Returns prediction dict with rul_hours, severity, etc.
    """
    url = f"{ML_SERVICE_URL}/predict/rul"
    payload = {
        "sensors": sensor_data,
        "operating_hours_per_day": 8.0,
        "machine_age_factor": 1.0,
    }
    resp = requests.post(url, json=payload, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------
def fetch_equipment(client: SupabaseClient) -> List[Equipment]:
    """Fetch all equipment from database."""
    logger.info("Fetching equipment from database...")
    rows = client.get("equipment", params={"select": "id,name,status,health_score"})
    equipment = [
        Equipment(
            id=row["id"],
            name=row["name"],
            status=row.get("status", "Healthy"),
            health_score=row.get("health_score", 100),
        )
        for row in rows
    ]
    logger.info(f"Found {len(equipment)} equipment records")
    return equipment


def fetch_latest_sensor_reading(
    client: SupabaseClient, equipment_id: str
) -> Optional[SensorReading]:
    """Fetch the most recent sensor reading for an equipment."""
    # Build URL with proper query params for PostgREST
    url = f"{client.url}/rest/v1/sensor_readings"
    params = {
        "equipment_id": f"eq.{equipment_id}",
        "select": "*",
        "order": "timestamp.desc",
        "limit": "1",
    }
    
    try:
        resp = requests.get(url, headers=client.headers, params=params, timeout=10)
        resp.raise_for_status()
        rows = resp.json()
    except Exception as exc:
        logger.warning(f"Failed to fetch sensor reading for {equipment_id}: {exc}")
        return None
    
    if not rows:
        return None

    row = rows[0]
    return SensorReading(
        equipment_id=row["equipment_id"],
        timestamp=row["timestamp"],
        temperature=row.get("temperature"),
        vibration=row.get("vibration"),
        pressure=row.get("pressure"),
        voltage=row.get("voltage"),
        rpm=row.get("rpm"),
        power_output=row.get("power_output"),
    )


def run_ml_prediction(
    equipment: Equipment, sensor: Optional[SensorReading]
) -> MLPrediction:
    """
    Run ML prediction for equipment using latest sensor data.
    Returns MLPrediction with health_score, status, severity, etc.
    """
    logger.info(f"Running ML prediction for {equipment.id} ({equipment.name})")

    if not sensor:
        logger.warning(f"No sensor data for {equipment.id} - using default prediction")
        # Default healthy state when no sensor data
        return MLPrediction(
            equipment_id=equipment.id,
            health_score=95,
            status="Healthy",
            rul_hours=240.0,
            rul_days=30.0,
            severity="normal",
            failure_mode="none",
            recommendation="No sensor data available. Equipment assumed healthy.",
            degradation_pct=5.0,
            confidence=0.5,
            sensor_data={},
        )

    # Build sensor dict for ML service
    sensor_dict = {}
    if sensor.temperature is not None:
        sensor_dict["temperature"] = sensor.temperature
    if sensor.vibration is not None:
        sensor_dict["vibration"] = sensor.vibration
    if sensor.pressure is not None:
        sensor_dict["pressure"] = sensor.pressure
    if sensor.voltage is not None:
        sensor_dict["voltage"] = sensor.voltage
    if sensor.rpm is not None:
        sensor_dict["rpm"] = sensor.rpm
    if sensor.power_output is not None:
        sensor_dict["power_output"] = sensor.power_output

    try:
        ml_result = call_ml_predict(sensor_dict)

        # Calculate health_score from degradation_pct
        degradation_pct = ml_result.get("degradation_pct", 0.0)
        health_score = max(0, min(100, int(100 - degradation_pct)))

        # Map ML severity to equipment status
        severity = ml_result.get("severity", "normal")
        if severity == "critical":
            status = "Critical"
        elif severity in ("high", "medium"):
            status = "Warning"
        else:
            status = "Healthy"

        return MLPrediction(
            equipment_id=equipment.id,
            health_score=health_score,
            status=status,
            rul_hours=ml_result.get("rul_hours", 240.0),
            rul_days=ml_result.get("rul_days", 30.0),
            severity=severity,
            failure_mode=ml_result.get("failure_mode", "none"),
            recommendation=ml_result.get("recommendation", ""),
            degradation_pct=degradation_pct,
            confidence=ml_result.get("confidence", 0.85),
            sensor_data=sensor_dict,
        )
    except Exception as exc:
        logger.error(f"ML prediction failed for {equipment.id}: {exc}")
        # Return fallback prediction
        return MLPrediction(
            equipment_id=equipment.id,
            health_score=equipment.health_score,  # Keep existing
            status=equipment.status,
            rul_hours=240.0,
            rul_days=30.0,
            severity="normal",
            failure_mode="ml_service_error",
            recommendation=f"ML service unavailable: {exc}",
            degradation_pct=100.0 - equipment.health_score,
            confidence=0.0,
            sensor_data=sensor_dict if sensor_dict else {},
        )


def update_equipment_health(
    client: SupabaseClient, prediction: MLPrediction, dry_run: bool
) -> None:
    """Update equipment table with ML-derived health_score and status."""
    logger.info(
        f"Updating {prediction.equipment_id}: "
        f"health_score={prediction.health_score}, status={prediction.status}"
    )

    if dry_run:
        logger.info(f"[DRY RUN] Would update equipment {prediction.equipment_id}")
        return

    try:
        client.patch(
            "equipment",
            prediction.equipment_id,
            {
                "health_score": prediction.health_score,
                "status": prediction.status,
                "updated_at": datetime.utcnow().isoformat(),
            },
        )
        logger.info(f"✓ Updated equipment {prediction.equipment_id}")
    except Exception as exc:
        logger.error(f"Failed to update equipment {prediction.equipment_id}: {exc}")


def create_alert_if_needed(
    client: SupabaseClient, prediction: MLPrediction, dry_run: bool
) -> None:
    """Create alert if health_score drops below thresholds."""
    health = prediction.health_score

    # Determine alert severity based on health_score
    if health <= CRITICAL_HEALTH_THRESHOLD:
        alert_severity = "Critical"
        message = (
            f"{prediction.failure_mode} detected. "
            f"Health score: {health}%. RUL: {prediction.rul_days:.1f} days. "
            f"{prediction.recommendation}"
        )
    elif health <= HIGH_HEALTH_THRESHOLD:
        alert_severity = "High"
        message = (
            f"Degrading performance detected. "
            f"Health score: {health}%. RUL: {prediction.rul_days:.1f} days. "
            f"{prediction.recommendation}"
        )
    elif health <= MEDIUM_HEALTH_THRESHOLD:
        alert_severity = "Medium"
        message = (
            f"Minor degradation observed. "
            f"Health score: {health}%. Recommend monitoring."
        )
    else:
        # No alert needed - equipment is healthy
        return

    logger.info(
        f"Creating {alert_severity} alert for {prediction.equipment_id}: {message}"
    )

    if dry_run:
        logger.info(f"[DRY RUN] Would create {alert_severity} alert")
        return

    try:
        alert_id = f"ALT-ML-{uuid.uuid4().hex[:8].upper()}"
        client.post(
            "alerts",
            {
                "id": alert_id,
                "equipment_id": prediction.equipment_id,
                "severity": alert_severity,
                "message": message,
                "resolved": False,
                "created_at": datetime.utcnow().isoformat(),
            },
        )
        logger.info(f"✓ Created alert {alert_id}")
    except Exception as exc:
        logger.error(f"Failed to create alert for {prediction.equipment_id}: {exc}")


def store_prediction_history(
    client: SupabaseClient, prediction: MLPrediction, dry_run: bool
) -> None:
    """Store prediction in ml_predictions table for historical trending."""
    logger.info(f"Storing prediction history for {prediction.equipment_id}")

    if dry_run:
        logger.info(f"[DRY RUN] Would store prediction history")
        return

    try:
        client.post(
            "ml_predictions",
            {
                "equipment_id": prediction.equipment_id,
                "health_score": prediction.health_score,
                "rul_hours": prediction.rul_hours,
                "rul_days": prediction.rul_days,
                "severity": prediction.severity,
                "failure_mode": prediction.failure_mode,
                "recommendation": prediction.recommendation,
                "degradation_pct": prediction.degradation_pct,
                "confidence": prediction.confidence,
                "sensor_data": prediction.sensor_data,
                "prediction_source": "ml",
                "prediction_timestamp": datetime.utcnow().isoformat(),
            },
        )
        logger.info(f"✓ Stored prediction history for {prediction.equipment_id}")
    except Exception as exc:
        # Fail silently if RLS blocks writes
        logger.warning(
            f"Could not store prediction history for {prediction.equipment_id}: {exc}"
        )


def run_pipeline(dry_run: bool = False) -> None:
    """
    Main pipeline:
    1. Fetch all equipment
    2. For each equipment, fetch latest sensor reading
    3. Run ML prediction
    4. Update equipment health_score and status
    5. Create alerts if needed
    6. Store prediction history
    """
    logger.info("=" * 60)
    logger.info("PFMI ML-to-Database Writeback Pipeline")
    logger.info("=" * 60)
    logger.info(f"Supabase URL: {SUPABASE_URL}")
    logger.info(f"ML Service URL: {ML_SERVICE_URL}")
    logger.info(f"Dry Run: {dry_run}")
    logger.info("=" * 60)

    # Check configuration
    if not SUPABASE_ANON_KEY or SUPABASE_URL == "https://your-project.supabase.co":
        logger.error(
            "❌ Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
        )
        sys.exit(1)

    # Initialize client
    client = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    # Fetch equipment
    equipment_list = fetch_equipment(client)

    if not equipment_list:
        logger.warning("No equipment found in database. Exiting.")
        return

    # Process each equipment
    predictions = []
    for eq in equipment_list:
        logger.info(f"\n--- Processing {eq.id} ({eq.name}) ---")

        # Fetch latest sensor reading
        sensor = fetch_latest_sensor_reading(client, eq.id)
        if sensor:
            logger.info(f"Latest sensor reading: {sensor.timestamp}")
        else:
            logger.warning(f"No sensor data for {eq.id}")

        # Run ML prediction
        prediction = run_ml_prediction(eq, sensor)
        predictions.append(prediction)

        # Write back to database
        update_equipment_health(client, prediction, dry_run)
        create_alert_if_needed(client, prediction, dry_run)
        store_prediction_history(client, prediction, dry_run)

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("Pipeline Complete")
    logger.info("=" * 60)
    logger.info(f"Total equipment processed: {len(predictions)}")
    logger.info(
        f"Healthy: {sum(1 for p in predictions if p.status == 'Healthy')}"
    )
    logger.info(
        f"Warning: {sum(1 for p in predictions if p.status == 'Warning')}"
    )
    logger.info(
        f"Critical: {sum(1 for p in predictions if p.status == 'Critical')}"
    )
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="PFMI ML-to-Database Writeback Pipeline"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing to database",
    )
    args = parser.parse_args()

    try:
        run_pipeline(dry_run=args.dry_run)
    except KeyboardInterrupt:
        logger.info("\n⚠ Pipeline interrupted by user")
        sys.exit(1)
    except Exception as exc:
        logger.exception(f"❌ Pipeline failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
