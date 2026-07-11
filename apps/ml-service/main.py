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
PFMI_MODELS_DIR = BASE_DIR.parent.parent / "pfmi" / "models"  # wheel-loader

# ---------------------------------------------------------------------------
# Global holders — populated at startup
# ---------------------------------------------------------------------------
_bulldozer: dict[str, Any] = {}      # model, meta
_truck: dict[str, Any] = {}          # model, scaler, label_encoder
_generic: dict[str, Any] = {}        # model, meta
_wheel_loader: dict[str, Any] = {}   # failure_24h, failure_7d, failure_type

MODEL_STATUS: dict[str, str] = {
    "bulldozer": "not_loaded",
    "truck": "not_loaded",
    "generic": "not_loaded",
    "wheel_loader": "not_loaded",
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

        model = _load_keras_model(model_path)
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

    return {
        "count": len(models_info),
        "models": models_info,
    }


# ---------------------------------------------------------------------------
# POST /predict  (legacy fallback)
# ---------------------------------------------------------------------------
@app.post("/predict")
def predict_legacy(data: SensorData):
    if predict_rul is None:
        raise HTTPException(status_code=503, detail="Legacy predict module not available")
    try:
        rul, anomaly = predict_rul(data.sensors)
        return {
            "remainingUsefulLife": rul,
            "anomalyDetected": anomaly,
            "confidence": 0.92,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# POST /predict/bulldozer
# ---------------------------------------------------------------------------
@app.post("/predict/bulldozer", response_model=BulldozerResponse)
def predict_bulldozer(data: BulldozerRequest):
    if not _bulldozer:
        raise HTTPException(status_code=503, detail="Bulldozer model not loaded")

    model = _bulldozer["model"]
    meta = _bulldozer["meta"]
    features = meta["features"]
    derived_names = meta.get("derived", [])
    failure_modes = meta["failure_modes"]
    threshold = meta["threshold"]
    reliable_modes = meta.get("reliable_modes", [])
    mode_threshold = meta.get("mode_confidence_threshold", 0.5)
    health_states = meta.get("targets", {}).get("health_state", ["normal", "degrading", "imminent_failure"])

    # Build feature vector
    try:
        raw_values = {f: data.sensors.get(f, 0.0) for f in features}

        # Compute derived features if model expects them
        derived_values = _compute_bulldozer_derived(raw_values, derived_names)

        feature_names = features + derived_names
        values = [raw_values[f] for f in features] + [derived_values.get(d, 0.0) for d in derived_names]

        X = np.array(values, dtype=np.float64).reshape(1, -1)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Feature construction error: {exc}")

    try:
        # The bulldozer model is a multi-output XGBoost; predict returns
        # health_state index and failure_mode index (or probabilities).
        raw_pred = model.predict(X)

        # Attempt to get probabilities
        try:
            probas = model.predict_proba(X)
        except Exception:
            probas = None

        # Parse output — depends on model structure
        if hasattr(raw_pred, "shape") and len(raw_pred.shape) == 2 and raw_pred.shape[1] >= 2:
            # Multi-output: col 0 = health_state idx, col 1 = failure_mode idx
            hs_idx = int(raw_pred[0, 0])
            fm_idx = int(raw_pred[0, 1])
        else:
            hs_idx = int(raw_pred[0]) if len(raw_pred) > 0 else 0
            fm_idx = 0

        health_state = health_states[hs_idx] if hs_idx < len(health_states) else "unknown"
        failure_mode = failure_modes[fm_idx] if fm_idx < len(failure_modes) else "unknown"

        # Confidence from probabilities
        hs_conf = 0.0
        fm_conf = 0.0
        if probas is not None:
            if isinstance(probas, list) and len(probas) >= 2:
                # Multi-output: list of arrays
                hs_conf = float(np.max(probas[0][0]))
                fm_conf = float(np.max(probas[1][0]))
            elif hasattr(probas, "shape"):
                hs_conf = float(np.max(probas[0]))
                fm_conf = hs_conf  # single-output fallback

        reliable = failure_mode in reliable_modes and fm_conf >= mode_threshold

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

    if len(req.window) != 30:
        raise HTTPException(status_code=400, detail="window must contain exactly 30 samples")

    try:
        # Convert to numpy array (30, 15)
        rows = []
        for sample in req.window:
            row = [getattr(sample, f) for f in TRUCK_SENSOR_ORDER]
            rows.append(row)
        window = np.array(rows, dtype=np.float32)  # (30, 15)

        # Standardise
        scaler = _truck["scaler"]
        flat = window.reshape(-1, 15)               # (30, 15)
        scaled = scaler.transform(flat)             # (30, 15)
        scaled = scaled.reshape(1, 30, 15)          # (1, 30, 15)

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

    model = _generic["model"]
    meta = _generic["meta"]
    features = meta["features"]
    derived_names = meta.get("derived", [])
    failure_modes = meta["failure_modes"]
    threshold = meta["threshold"]

    try:
        raw_values = {f: data.sensors.get(f, 0.0) for f in features}

        # Compute derived features for generic model
        derived_values = _compute_generic_derived(raw_values, derived_names)

        values = [raw_values[f] for f in features] + [derived_values.get(d, 0.0) for d in derived_names]
        X = np.array(values, dtype=np.float64).reshape(1, -1)

        # Predict
        try:
            proba = model.predict_proba(X)[0]
            pred_idx = int(np.argmax(proba))
            confidence = float(np.max(proba))
        except Exception:
            raw_pred = model.predict(X)
            pred_idx = int(raw_pred[0])
            confidence = 1.0 if pred_idx == 0 else threshold

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
