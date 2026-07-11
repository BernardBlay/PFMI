"""
PFMI ML Prediction Service
==========================
Serves predictions for all machine classes:
  - Bulldozer   (XGBoost)  → /predict/bulldozer
  - Haul Truck  (LSTM)     → /predict/truck
  - Generic     (XGBoost)  → /predict/generic
  - Wheel Loader (RF/XGB)  → /predict/wheel-loader
  - Legacy mock            → /predict
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("pfmi.ml-service")

# ---------------------------------------------------------------------------
# Base paths (relative to this file)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
PFMI_MODELS_DIR = BASE_DIR / "pfmi" / "models"  # wheel-loader

# ---------------------------------------------------------------------------
# Global holders — populated at startup
# ---------------------------------------------------------------------------
_bulldozer: dict[str, Any] = {}      # model, meta
_truck: dict[str, Any] = {}          # model, scaler, label_encoder
_generic: dict[str, Any] = {}        # model, meta
_wheel_loader: dict[str, Any] = {}   # failure_24h, failure_7d, failure_type
_drill: dict[str, Any] = {}          # model, scaler_mean, scaler_std

MODEL_STATUS: dict[str, str] = {
    "bulldozer": "not_loaded",
    "truck": "not_loaded",
    "generic": "not_loaded",
    "wheel_loader": "not_loaded",
    "drill": "not_loaded",
}

# ---------------------------------------------------------------------------
# Lazy / conditional imports
# ---------------------------------------------------------------------------
try:
    import numpy as np
except ImportError:
    np = None  # type: ignore[assignment]
    logger.warning("numpy not installed — ML predictions will fail")

try:
    import joblib
except ImportError:
    joblib = None  # type: ignore[assignment]
    logger.warning("joblib not installed — joblib model loading will fail")


def _load_keras_model(path: Path):
    """Try tf.keras first, fall back to keras standalone."""
    try:
        from tensorflow.keras.models import load_model  # type: ignore[import]
        return load_model(str(path))
    except Exception:
        pass
    try:
        from keras.models import load_model as load_model_k  # type: ignore[import]
        return load_model_k(str(path))
    except Exception as exc:
        raise ImportError(f"Cannot load Keras model: {exc}") from exc


# ---------------------------------------------------------------------------
# Model loaders (all wrapped in try/except)
# ---------------------------------------------------------------------------

def _load_bulldozer() -> None:
    """Load XGBoost bulldozer model + meta.json."""
    global _bulldozer
    version_dir = MODELS_DIR / "bulldozer" / "v1"
    meta_path = version_dir / "meta.json"
    model_path = version_dir / "model.joblib"

    try:
        if not meta_path.exists() or not model_path.exists():
            raise FileNotFoundError(f"Missing files in {version_dir}")
        meta = json.loads(meta_path.read_text())
        model = joblib.load(model_path)
        _bulldozer = {"model": model, "meta": meta}
        MODEL_STATUS["bulldozer"] = "loaded"
        logger.info("✓ Bulldozer model loaded (version=%s)", meta.get("model_version"))
    except Exception as exc:
        MODEL_STATUS["bulldozer"] = f"error: {exc}"
        logger.warning("✗ Bulldozer model NOT loaded: %s", exc)


def _load_truck() -> None:
    """Load Keras LSTM model + scaler + label encoder for haul trucks."""
    global _truck
    truck_dir = MODELS_DIR / "truck_ai_model"
    model_path = truck_dir / "model.keras"
    scaler_path = truck_dir / "scaler.pkl"
    encoder_path = truck_dir / "label_encoder.pkl"

    try:
        if not model_path.exists():
            raise FileNotFoundError(f"model.keras not found in {truck_dir}")
        if not scaler_path.exists():
            raise FileNotFoundError(f"scaler.pkl not found in {truck_dir}")
        if not encoder_path.exists():
            raise FileNotFoundError(f"label_encoder.pkl not found in {truck_dir}")

        # Register custom loss before loading
        import tensorflow as tf

        def weighted_ce(y_true, y_pred):
            return tf.keras.losses.sparse_categorical_crossentropy(y_true, y_pred)

        model = tf.keras.models.load_model(str(model_path), custom_objects={"weighted_ce": weighted_ce})

        scaler = joblib.load(scaler_path)
        label_encoder = joblib.load(encoder_path)

        _truck = {
            "model": model,
            "scaler": scaler,
            "label_encoder": label_encoder,
        }
        MODEL_STATUS["truck"] = "loaded"
        logger.info("✓ Haul-truck LSTM model loaded")
    except Exception as exc:
        MODEL_STATUS["truck"] = f"error: {exc}"
        logger.warning("✗ Haul-truck model NOT loaded: %s", exc)


def _load_generic() -> None:
    """Load XGBoost generic industrial model + meta.json."""
    global _generic
    version_dir = MODELS_DIR / "generic" / "v1"
    meta_path = version_dir / "meta.json"
    model_path = version_dir / "model.joblib"

    try:
        if not meta_path.exists() or not model_path.exists():
            raise FileNotFoundError(f"Missing files in {version_dir}")
        meta = json.loads(meta_path.read_text())
        model = joblib.load(model_path)
        _generic = {"model": model, "meta": meta}
        MODEL_STATUS["generic"] = "loaded"
        logger.info("✓ Generic model loaded (version=%s)", meta.get("model_version"))
    except Exception as exc:
        MODEL_STATUS["generic"] = f"error: {exc}"
        logger.warning("✗ Generic model NOT loaded: %s", exc)


def _load_wheel_loader() -> None:
    """Load wheel-loader RF/XGB pkl models from pfmi/models/ if they exist."""
    global _wheel_loader
    try:
        if not PFMI_MODELS_DIR.exists():
            raise FileNotFoundError(f"Wheel-loader models dir not found: {PFMI_MODELS_DIR}")

        loaded: dict[str, Any] = {}
        for pkl_name in ("failure_24h", "failure_7d", "failure_type"):
            pkl_path = PFMI_MODELS_DIR / f"{pkl_name}.pkl"
            if pkl_path.exists():
                loaded[pkl_name] = joblib.load(pkl_path)
                logger.info("  → wheel-loader sub-model '%s' loaded", pkl_name)
            else:
                logger.warning("  → wheel-loader sub-model '%s' not found", pkl_name)

        if not loaded:
            raise FileNotFoundError("No wheel-loader pkl models found")

        _wheel_loader = loaded
        MODEL_STATUS["wheel_loader"] = f"loaded ({len(loaded)} sub-models)"
        logger.info("✓ Wheel-loader models loaded: %s", list(loaded.keys()))
    except Exception as exc:
        MODEL_STATUS["wheel_loader"] = f"error: {exc}"
        logger.warning("✗ Wheel-loader models NOT loaded: %s", exc)


def _load_drill() -> None:
    """Load Keras LSTM drill-rig model + scaler params."""
    global _drill
    drill_dir = MODELS_DIR / "drill_model"
    model_path = drill_dir / "best_lstm_model.keras"
    scaler_path = drill_dir / "scaler_params.npz"

    try:
        if not model_path.exists():
            raise FileNotFoundError(f"best_lstm_model.keras not found in {drill_dir}")
        if not scaler_path.exists():
            raise FileNotFoundError(f"scaler_params.npz not found in {drill_dir}")

        import tensorflow as tf
        model = tf.keras.models.load_model(str(model_path))
        scaler_data = np.load(str(scaler_path))

        _drill = {
            "model": model,
            "scaler_mean": scaler_data["mean"],
            "scaler_std": scaler_data["std"],
        }
        MODEL_STATUS["drill"] = "loaded"
        logger.info("✓ Drill-rig LSTM model loaded")
    except Exception as exc:
        MODEL_STATUS["drill"] = f"error: {exc}"
        logger.warning("✗ Drill-rig model NOT loaded: %s", exc)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

# Legacy
class SensorData(BaseModel):
    sensors: Dict[str, float]


# Bulldozer
class BulldozerRequest(BaseModel):
    sensors: Dict[str, float] = Field(
        ...,
        description="Sensor readings keyed by feature name (see meta.json for list)",
    )


class BulldozerResponse(BaseModel):
    health_state: str
    health_confidence: float
    failure_mode: str
    failure_mode_confidence: float
    reliable: bool


# Haul Truck  (matches README spec exactly)
class TelemetrySample(BaseModel):
    payload_t: float
    grade_pct: float
    road_quality: float
    ambient_temp_c: float
    vibration_g: float
    hub_oil_temp_c: float
    case_drain_flow_pct: float
    system_pressure_bar: float
    strut_pressure_left_bar: float
    strut_pressure_right_bar: float
    brake_oil_temp_c: float
    brake_stroke_mm: float
    crankcase_pressure_kpa: float
    egt_c: float
    winding_temp_c: float


TRUCK_SENSOR_ORDER = [
    "payload_t", "grade_pct", "road_quality", "ambient_temp_c",
    "vibration_g", "hub_oil_temp_c",
    "case_drain_flow_pct", "system_pressure_bar",
    "strut_pressure_left_bar", "strut_pressure_right_bar",
    "brake_oil_temp_c", "brake_stroke_mm",
    "crankcase_pressure_kpa", "egt_c", "winding_temp_c",
]


class TruckPredictRequest(BaseModel):
    truck_id: str
    truck_model: str = ""
    window: List[TelemetrySample]


class TruckPrediction(BaseModel):
    class_: str = Field(..., alias="class")
    probabilities: Dict[str, float]
    rul_trips: float

    class Config:
        populate_by_name = True


class TruckPredictResponse(BaseModel):
    status: str
    truck_id: str
    prediction: TruckPrediction


# Generic
class GenericRequest(BaseModel):
    sensors: Dict[str, float]


class GenericResponse(BaseModel):
    prediction: str
    confidence: float
    failure_modes: List[str]


# Wheel Loader
class WheelLoaderRequest(BaseModel):
    sensors: Dict[str, float]


class WheelLoaderResponse(BaseModel):
    failure_24h: Optional[Dict[str, Any]] = None
    failure_7d: Optional[Dict[str, Any]] = None
    failure_type: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="PFMI ML Prediction Service",
    version="2.0.0",
    description="Unified prediction service for Bulldozer, Haul Truck, Generic Industrial, and Wheel Loader models.",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup event — load all models
# ---------------------------------------------------------------------------
@app.on_event("startup")
def load_all_models():
    logger.info("=" * 60)
    logger.info("Loading ML models …")
    logger.info("=" * 60)

    _load_bulldozer()
    _load_truck()
    _load_generic()
    _load_wheel_loader()
    _load_drill()

    loaded_count = sum(1 for s in MODEL_STATUS.values() if s.startswith("loaded"))
    logger.info("=" * 60)
    logger.info("Model loading complete: %d / %d loaded", loaded_count, len(MODEL_STATUS))
    for name, status in MODEL_STATUS.items():
        logger.info("  %-15s → %s", name, status)
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# Legacy import (kept for /predict fallback)
# ---------------------------------------------------------------------------
try:
    from models.predict import predict_rul
except ImportError:
    predict_rul = None  # type: ignore[assignment]
    logger.warning("Legacy predict_rul not importable")

try:
    from ocr import run_ocr, extract_structured_logs
except ImportError:
    run_ocr = None  # type: ignore[assignment]
    extract_structured_logs = None  # type: ignore[assignment]
    logger.warning("OCR module not importable")


# ===================================================================
# ENDPOINTS
# ===================================================================

@app.get("/")
def read_root():
    return {"status": "online", "service": "PFMI ML Service", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------
@app.get("/health")
def health_check():
    loaded_count = sum(1 for s in MODEL_STATUS.values() if s.startswith("loaded"))
    return {
        "status": "healthy" if loaded_count > 0 else "degraded",
        "models_loaded": loaded_count,
        "models_total": len(MODEL_STATUS),
        "details": MODEL_STATUS,
    }


# ---------------------------------------------------------------------------
# GET /models
# ---------------------------------------------------------------------------
@app.get("/models")
def list_models():
    models_info: list[dict[str, Any]] = []

    # Bulldozer
    if _bulldozer:
        meta = _bulldozer["meta"]
        models_info.append({
            "category": "bulldozer",
            "type": "XGBoost",
            "version": meta.get("model_version"),
            "features": meta.get("features", []),
            "derived": meta.get("derived", []),
            "failure_modes": meta.get("failure_modes", []),
            "threshold": meta.get("threshold"),
            "metrics": meta.get("metrics", {}),
            "reliable_modes": meta.get("reliable_modes", []),
            "status": MODEL_STATUS["bulldozer"],
        })

    # Truck
    if _truck:
        models_info.append({
            "category": "truck",
            "type": "Keras LSTM",
            "version": "truck-lstm-v1",
            "features": TRUCK_SENSOR_ORDER,
            "failure_modes": ["normal", "wear", "failure"],
            "window_size": 30,
            "outputs": ["damage_class (3-class)", "rul_trips (regression)"],
            "status": MODEL_STATUS["truck"],
        })

    # Generic
    if _generic:
        meta = _generic["meta"]
        models_info.append({
            "category": "generic",
            "type": "XGBoost",
            "version": meta.get("model_version"),
            "features": meta.get("features", []),
            "derived": meta.get("derived", []),
            "failure_modes": meta.get("failure_modes", []),
            "threshold": meta.get("threshold"),
            "metrics": meta.get("metrics", {}),
            "status": MODEL_STATUS["generic"],
        })

    # Wheel Loader
    if _wheel_loader:
        models_info.append({
            "category": "wheel_loader",
            "type": "RF / XGBoost",
            "version": "wheel-loader-v1",
            "sub_models": list(_wheel_loader.keys()),
            "status": MODEL_STATUS["wheel_loader"],
        })

    # Drill Rig
    if _drill:
        models_info.append({
            "category": "drill",
            "type": "Keras LSTM",
            "version": "drill-lstm-v1",
            "features": DRILL_SENSOR_COLS,
            "failure_modes": DRILL_FAILURE_TYPES,
            "health_components": DRILL_HEALTH_NAMES,
            "window_size": 24,
            "outputs": ["7x component health (3-class)", "rul_hours (regression)", "failure_type (9-class)"],
            "status": MODEL_STATUS["drill"],
        })

    return {
        "count": len(models_info),
        "models": models_info,
    }


# ---------------------------------------------------------------------------
# POST /predict  (legacy — now delegates to bulldozer)
# ---------------------------------------------------------------------------
@app.post("/predict")
def predict_legacy(data: SensorData):
    """Legacy endpoint — delegates to bulldozer if loaded, else returns not-ready."""
    if not _bulldozer:
        raise HTTPException(status_code=503, detail="No model loaded for /predict. Use /predict/bulldozer, /predict/truck, etc.")
    try:
        bulldozer_req = BulldozerRequest(sensors=data.sensors)
        result = predict_bulldozer(bulldozer_req)
        return {
            "remainingUsefulLife": None,
            "anomalyDetected": result.health_state != "normal",
            "health_state": result.health_state,
            "health_confidence": result.health_confidence,
            "failure_mode": result.failure_mode,
            "failure_mode_confidence": result.failure_mode_confidence,
            "reliable": result.reliable,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# POST /predict/bulldozer
# ---------------------------------------------------------------------------
@app.post("/predict/bulldozer", response_model=BulldozerResponse)
def predict_bulldozer(data: BulldozerRequest):
    if not _bulldozer:
        raise HTTPException(status_code=503, detail="Bulldozer model not loaded")

    model_dict = _bulldozer["model"]  # dict with keys: health_state_model, failure_mode_model
    meta = _bulldozer["meta"]
    features = meta["features"]
    derived_names = meta.get("derived", [])
    failure_modes = meta["failure_modes"]
    reliable_modes = meta.get("reliable_modes", [])
    mode_threshold = meta.get("mode_confidence_threshold", 0.5)
    health_states = meta.get("targets", {}).get("health_state", ["normal", "degrading", "imminent_failure"])

    # Unpack sub-models
    if isinstance(model_dict, dict):
        health_model = model_dict.get("health_state_model")
        failure_model = model_dict.get("failure_mode_model")
    else:
        health_model = model_dict
        failure_model = model_dict

    if health_model is None or failure_model is None:
        raise HTTPException(status_code=500, detail="Bulldozer sub-models missing from model.joblib")

    # Build feature vector
    try:
        import xgboost as xgb
        raw_values = {f: data.sensors.get(f, 0.0) for f in features}
        derived_values = _compute_bulldozer_derived(raw_values, derived_names)
        feature_names = features + derived_names
        values = [raw_values[f] for f in features] + [derived_values.get(d, 0.0) for d in derived_names]
        arr = np.array(values, dtype=np.float64).reshape(1, -1)
        dmatrix = xgb.DMatrix(arr, feature_names=feature_names)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Feature construction error: {exc}")

    try:
        hs_probs = health_model.predict(dmatrix)   # (1, 3)
        fm_probs = failure_model.predict(dmatrix)  # (1, 6)

        hs_idx = int(np.argmax(hs_probs[0]))
        fm_idx = int(np.argmax(fm_probs[0]))

        health_state = health_states[hs_idx] if hs_idx < len(health_states) else "unknown"
        failure_mode = failure_modes[fm_idx] if fm_idx < len(failure_modes) else "unknown"
        hs_conf   = float(hs_probs[0][hs_idx])
        fm_conf   = float(fm_probs[0][fm_idx])
        reliable  = failure_mode in reliable_modes and fm_conf >= mode_threshold

        return BulldozerResponse(
            health_state=health_state,
            health_confidence=round(hs_conf, 4),
            failure_mode=failure_mode,
            failure_mode_confidence=round(fm_conf, 4),
            reliable=reliable,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Bulldozer inference error: {exc}")


def _compute_bulldozer_derived(raw: dict, derived_names: list) -> dict:
    """Compute derived features from raw sensor readings for the bulldozer."""
    d: dict[str, float] = {}

    if "crest_factor_engine" in derived_names:
        rms = raw.get("Vibration_Engine_RMS", 1.0)
        d["crest_factor_engine"] = raw.get("Vibration_Engine_Peak", 0.0) / rms if rms != 0 else 0.0

    if "crest_factor_undercarriage" in derived_names:
        rms = raw.get("Vibration_Undercarriage_RMS", 1.0)
        d["crest_factor_undercarriage"] = raw.get("Vibration_Undercarriage_Peak", 0.0) / rms if rms != 0 else 0.0

    if "hydraulic_efficiency" in derived_names:
        impl = raw.get("Hydraulic_Pressure_Implement", 1.0)
        d["hydraulic_efficiency"] = (impl - raw.get("Return_Pressure", 0.0)) / impl if impl != 0 else 0.0

    if "thermal_margin" in derived_names:
        d["thermal_margin"] = 110.0 - raw.get("Engine_Coolant_Temp", 0.0)

    if "specific_fuel" in derived_names:
        load = raw.get("Engine_Load_Factor", 1.0)
        d["specific_fuel"] = raw.get("Fuel_Consumption_Rate", 0.0) / load if load != 0 else 0.0

    if "load_per_pull" in derived_names:
        pull = raw.get("Drawbar_Pull_Force", 1.0)
        d["load_per_pull"] = raw.get("Engine_Load_Factor", 0.0) / pull if pull != 0 else 0.0

    return d


# ---------------------------------------------------------------------------
# POST /predict/truck
# ---------------------------------------------------------------------------
@app.post("/predict/truck")
def predict_truck(req: TruckPredictRequest):
    if not _truck:
        raise HTTPException(status_code=503, detail="Haul-truck model not loaded")

    if len(req.window) < 2:
        raise HTTPException(status_code=400, detail="window must contain at least 2 samples")
    seq_len = len(req.window)

    try:
        # Convert to numpy array (30, 15)
        rows = []
        for sample in req.window:
            row = [getattr(sample, f) for f in TRUCK_SENSOR_ORDER]
            rows.append(row)
        window = np.array(rows, dtype=np.float32)  # (N, 15)

        # Standardise
        scaler = _truck["scaler"]
        flat = window.reshape(-1, 15)               # (N, 15)
        scaled = scaler.transform(flat)             # (N, 15)
        scaled = scaled.reshape(1, seq_len, 15)     # (1, N, 15)

        # Predict
        model = _truck["model"]
        damage_probs, rul_val = model.predict(scaled, verbose=0)
        # damage_probs: (1, 3) — softmax over [normal, wear, failure]
        # rul_val:      (1, 1) — regression output

        label_encoder = _truck["label_encoder"]
        class_idx = int(np.argmax(damage_probs[0]))
        class_name = label_encoder.inverse_transform([class_idx])[0]

        return {
            "status": "ok",
            "truck_id": req.truck_id,
            "prediction": {
                "class": class_name,
                "probabilities": {
                    "normal":  round(float(damage_probs[0][0]), 4),
                    "wear":    round(float(damage_probs[0][1]), 4),
                    "failure": round(float(damage_probs[0][2]), 4),
                },
                "rul_trips": round(float(rul_val[0][0]), 1),
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Truck inference error: {exc}")


# ---------------------------------------------------------------------------
# POST /predict/generic
# ---------------------------------------------------------------------------
@app.post("/predict/generic", response_model=GenericResponse)
def predict_generic(data: GenericRequest):
    if not _generic:
        raise HTTPException(status_code=503, detail="Generic model not loaded")

    model_obj = _generic["model"]
    meta = _generic["meta"]
    features = meta["features"]
    derived_names = meta.get("derived", [])
    failure_modes = meta["failure_modes"]
    threshold = meta["threshold"]

    try:
        import xgboost as xgb

        # Unpack dict if needed
        if isinstance(model_obj, dict):
            booster = next(iter(model_obj.values()))
        else:
            booster = model_obj

        # Use only raw features (generic model was trained without derived)
        raw_values = {f: data.sensors.get(f, 0.0) for f in features}
        values = [raw_values[f] for f in features]
        arr = np.array(values, dtype=np.float64).reshape(1, -1)

        if hasattr(booster, "predict"):
            dmatrix = xgb.DMatrix(arr, feature_names=features)
            proba = booster.predict(dmatrix)[0]
            pred_idx = int(np.argmax(proba))
            confidence = float(np.max(proba))
        else:
            pred_idx = 0
            confidence = 0.0

        prediction = failure_modes[pred_idx] if pred_idx < len(failure_modes) else "unknown"

        return GenericResponse(
            prediction=prediction,
            confidence=round(confidence, 4),
            failure_modes=failure_modes,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generic inference error: {exc}")


def _compute_generic_derived(raw: dict, derived_names: list) -> dict:
    """Compute derived features for the generic (AI4I-style) model."""
    d: dict[str, float] = {}

    if "power_w" in derived_names:
        d["power_w"] = raw.get("rpm", 0.0) * raw.get("torque", 0.0) * 2.0 * 3.14159 / 60.0

    if "temp_diff" in derived_names:
        d["temp_diff"] = raw.get("process_temp", 0.0) - raw.get("air_temp", 0.0)

    if "wear_x_torque" in derived_names:
        d["wear_x_torque"] = raw.get("tool_wear", 0.0) * raw.get("torque", 0.0)

    return d


DRILL_SENSOR_COLS = [
    "Vibration_X_RMS", "Vibration_X_Peak", "Vibration_Y_RMS", "Vibration_Y_Peak",
    "Vibration_Z_RMS", "Vibration_Z_Peak", "Acoustic_Emission_RMS",
    "Penetration_Rate_Avg", "Rotation_Speed_Avg", "Feed_Pressure_Avg",
    "Hydraulic_Pressure_Avg", "Hydraulic_Return_Pressure_Avg",
    "Hydraulic_Oil_Temp_Avg", "Flow_Rate_Avg",
    "Differential_Pressure_Filter_Avg", "Oil_Particle_Count_Avg",
    "Oil_Moisture_Avg", "Oil_Viscosity_Avg", "Tank_Level_End",
    "Drive_Motor_Current_Avg", "Motor_Winding_Temp_Avg",
]

DRILL_HEALTH_NAMES = [
    "drill_bit", "striker_bar", "drill_rod", "coupling_sleeve",
    "hydraulic_seal", "hydraulic_hose", "filter",
]

DRILL_HEALTH_LABELS = ["healthy", "degraded", "imminent_failure"]

DRILL_FAILURE_TYPES = [
    "none", "drill_bit", "striker_bar", "drill_rod",
    "coupling_sleeve", "seal_leak", "hose_burst", "filter_clog", "multiple",
]


class DrillRequest(BaseModel):
    sensors: Dict[str, float] = Field(
        ...,
        description="21 sensor readings for the hydraulic drill rig. See /models for full list.",
    )
    window: Optional[List[Dict[str, float]]] = Field(
        default=None,
        description="Optional sequence of hourly readings (up to 24 hours). If omitted, a single reading is replicated 24×.",
    )


class DrillComponentHealth(BaseModel):
    component: str
    label: str
    class_id: int
    confidence: float
    probabilities: Dict[str, float]


class DrillResponse(BaseModel):
    health: List[DrillComponentHealth]
    rul_hours: float
    failure_type: str
    failure_type_confidence: float
    failure_type_probs: Dict[str, float]


# ---------------------------------------------------------------------------
# POST /predict/wheel-loader
# ---------------------------------------------------------------------------
@app.post("/predict/wheel-loader", response_model=WheelLoaderResponse)
def predict_wheel_loader(data: WheelLoaderRequest):
    if not _wheel_loader:
        raise HTTPException(status_code=503, detail="Wheel-loader models not loaded")

    results: dict[str, Any] = {}

    try:
        sensor_keys = sorted(data.sensors.keys())
        X = np.array([[data.sensors[k] for k in sensor_keys]], dtype=np.float64)

        for model_name, model_obj in _wheel_loader.items():
            try:
                pred = model_obj.predict(X)
                try:
                    proba = model_obj.predict_proba(X)[0]
                    results[model_name] = {
                        "prediction": int(pred[0]) if hasattr(pred[0], "__int__") else str(pred[0]),
                        "confidence": round(float(np.max(proba)), 4),
                        "probabilities": {str(i): round(float(p), 4) for i, p in enumerate(proba)},
                    }
                except Exception:
                    results[model_name] = {
                        "prediction": int(pred[0]) if hasattr(pred[0], "__int__") else str(pred[0]),
                        "confidence": None,
                    }
            except Exception as exc:
                results[model_name] = {"error": str(exc)}

        return WheelLoaderResponse(**results)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Wheel-loader inference error: {exc}")


# ---------------------------------------------------------------------------
# POST /predict/drill
# ---------------------------------------------------------------------------
@app.post("/predict/drill", response_model=DrillResponse)
def predict_drill(data: DrillRequest):
    if not _drill:
        raise HTTPException(status_code=503, detail="Drill-rig model not loaded")

    model = _drill["model"]
    mean = _drill["scaler_mean"]
    std  = _drill["scaler_std"]

    # Build sensor array from request
    try:
        values = [float(data.sensors.get(c, 0.0)) for c in DRILL_SENSOR_COLS]
        arr = np.array(values, dtype=np.float32)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Sensor value error: {exc}")

    # If a window is provided, use it; otherwise replicate the single reading 24×
    try:
        if data.window and len(data.window) > 0:
            window_arr = np.array([
                [float(row.get(c, 0.0)) for c in DRILL_SENSOR_COLS]
                for row in data.window
            ], dtype=np.float32)
            n = window_arr.shape[0]
            if n >= 24:
                seq_raw = window_arr[-24:]
            else:
                pad = np.tile(window_arr[0:1], (24 - n, 1))
                seq_raw = np.vstack([pad, window_arr])
        else:
            seq_raw = np.tile(arr, (24, 1))

        # Normalize
        seq = (seq_raw - mean) / np.maximum(std, 1e-6)
        seq = seq.reshape(1, 24, 21)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Window construction error: {exc}")

    # Predict
    try:
        preds = model.predict(seq, verbose=0)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Drill inference error: {exc}")

    # Parse health outputs (first 7 heads)
    health_results: list[DrillComponentHealth] = []
    for i, name in enumerate(DRILL_HEALTH_NAMES):
        probs = preds[i][0]
        cls_id = int(np.argmax(probs))
        health_results.append(DrillComponentHealth(
            component=name,
            label=DRILL_HEALTH_LABELS[cls_id],
            class_id=cls_id,
            confidence=round(float(probs[cls_id]), 4),
            probabilities={
                DRILL_HEALTH_LABELS[j]: round(float(probs[j]), 4)
                for j in range(3)
            },
        ))

    # RUL (8th output)
    rul_norm = float(preds[7][0][0])
    rul_hours = round(max(0.0, rul_norm) * 2000.0, 1)

    # Failure type (9th output)
    ft_probs = preds[8][0]
    ft_cls = int(np.argmax(ft_probs))
    ft_label = DRILL_FAILURE_TYPES[ft_cls]
    ft_conf = round(float(ft_probs[ft_cls]), 4)
    ft_all = {DRILL_FAILURE_TYPES[j]: round(float(ft_probs[j]), 4) for j in range(len(DRILL_FAILURE_TYPES))}

    return DrillResponse(
        health=health_results,
        rul_hours=rul_hours,
        failure_type=ft_label,
        failure_type_confidence=ft_conf,
        failure_type_probs=ft_all,
    )


# ---------------------------------------------------------------------------
# POST /ocr  (legacy)
# ---------------------------------------------------------------------------
@app.post("/ocr")
def ocr_pipeline(image_path: str):
    if run_ocr is None or extract_structured_logs is None:
        raise HTTPException(status_code=503, detail="OCR module not available")
    try:
        text = run_ocr(image_path)
        structured = extract_structured_logs(text)
        return {
            "raw_text": text,
            "structured_data": structured,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
