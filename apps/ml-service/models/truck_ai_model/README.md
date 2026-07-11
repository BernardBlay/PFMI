# Mining Haul Truck Telemetry — Prediction API

## POST /predict

### Input: TelemetrySample (one row)

```json
{
  "payload_t": 350.0,
  "grade_pct": 2.1,
  "road_quality": 1,
  "ambient_temp_c": 32.0,
  "vibration_g": 0.12,
  "hub_oil_temp_c": 68.0,
  "case_drain_flow_pct": 4.2,
  "system_pressure_bar": 210.0,
  "strut_pressure_left_bar": 145.3,
  "strut_pressure_right_bar": 140.1,
  "brake_oil_temp_c": 72.5,
  "brake_stroke_mm": 3.1,
  "crankcase_pressure_kpa": 0.45,
  "egt_c": 415.0,
  "winding_temp_c": 0.0
}
```

All 15 fields are `float` and **required**. Set `winding_temp_c` to `0.0` for diesel-mechanical trucks (CAT 789, CAT 793).

### Input: PredictRequest (full payload)

Send **30 consecutive telemetry samples** from the same truck, sorted oldest to newest:

```json
{
  "truck_id": "HT-042",
  "truck_model": "CAT_793",
  "window": [
    {
      "payload_t": 342.0,
      "grade_pct": 1.8,
      "road_quality": 1,
      "ambient_temp_c": 32.0,
      "vibration_g": 0.10,
      "hub_oil_temp_c": 67.1,
      "case_drain_flow_pct": 4.0,
      "system_pressure_bar": 208.0,
      "strut_pressure_left_bar": 144.1,
      "strut_pressure_right_bar": 139.8,
      "brake_oil_temp_c": 71.0,
      "brake_stroke_mm": 3.0,
      "crankcase_pressure_kpa": 0.42,
      "egt_c": 402.0,
      "winding_temp_c": 0.0
    },
    {
      "payload_t": 345.0,
      "grade_pct": 1.9,
      "road_quality": 1,
      "ambient_temp_c": 32.0,
      "vibration_g": 0.11,
      "hub_oil_temp_c": 67.5,
      "case_drain_flow_pct": 4.1,
      "system_pressure_bar": 209.0,
      "strut_pressure_left_bar": 144.5,
      "strut_pressure_right_bar": 139.9,
      "brake_oil_temp_c": 71.4,
      "brake_stroke_mm": 3.0,
      "crankcase_pressure_kpa": 0.43,
      "egt_c": 405.0,
      "winding_temp_c": 0.0
    }
  ]
}
```

The `window` array must contain **exactly 30** of these objects (truncated to 2 above for brevity).

### Output

```json
{
  "status": "ok",
  "truck_id": "HT-042",
  "prediction": {
    "class": "wear",
    "probabilities": {
      "normal": 0.02,
      "wear": 0.87,
      "failure": 0.11
    },
    "rul_trips": 23.5
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `class` | string | `"normal"` / `"wear"` / `"failure"` |
| `probabilities` | object | Confidence per class (sums to 1.0) |
| `rul_trips` | float | Estimated remaining trips before failure (0–50) |

### Validation

| Check | HTTP | Message |
|-------|------|---------|
| `window` length ≠ 30 | 400 | `"window must contain exactly 30 samples"` |
| Missing any of the 15 fields | 400 | `"missing field: {name}"` |
| Non-numeric value | 400 | `"{field} must be numeric"` |
| Duplicate or non-consecutive timestamps | 400 | `"window timestamps must be consecutive"` |

---

## FastAPI Implementation

```python
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from tensorflow.keras.models import load_model

SENSOR_ORDER = [
    "payload_t", "grade_pct", "road_quality", "ambient_temp_c",
    "vibration_g", "hub_oil_temp_c",
    "case_drain_flow_pct", "system_pressure_bar",
    "strut_pressure_left_bar", "strut_pressure_right_bar",
    "brake_oil_temp_c", "brake_stroke_mm",
    "crankcase_pressure_kpa", "egt_c", "winding_temp_c",
]

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

class PredictRequest(BaseModel):
    truck_id: str
    truck_model: str
    window: list[TelemetrySample]  # must be exactly 30

class PredictResponse(BaseModel):
    status: str
    truck_id: str
    prediction: dict

# Load artifacts at startup
model = load_model("model.keras")
scaler = joblib.load("scaler.pkl")
label_encoder = joblib.load("label_encoder.pkl")

app = FastAPI()

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if len(req.window) != 30:
        raise HTTPException(400, "window must contain exactly 30 samples")

    # Convert TelemetrySample objects → numpy array (30, 15)
    rows = []
    for sample in req.window:
        row = [getattr(sample, f) for f in SENSOR_ORDER]
        rows.append(row)
    window = np.array(rows, dtype=np.float32)     # (30, 15)

    # Standardise using pre-fitted scaler
    flat = window.reshape(-1, 15)                 # (30, 15)
    scaled = scaler.transform(flat)               # (30, 15)
    scaled = scaled.reshape(1, 30, 15)            # (1, 30, 15)

    # Predict
    damage_probs, rul_val = model.predict(scaled, verbose=0)
    # damage_probs: (1, 3)   → softmax over [normal, wear, failure]
    # rul_val:      (1, 1)   → regression output

    class_idx = int(np.argmax(damage_probs[0]))
    class_name = label_encoder.inverse_transform([class_idx])[0]

    return PredictResponse(
        status="ok",
        truck_id=req.truck_id,
        prediction={
            "class": class_name,
            "probabilities": {
                "normal": round(float(damage_probs[0][0]), 4),
                "wear":   round(float(damage_probs[0][1]), 4),
                "failure":round(float(damage_probs[0][2]), 4),
            },
            "rul_trips": round(float(rul_val[0][0]), 1),
        },
    )
```

### Startup

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Place `model.keras`, `scaler.pkl`, and `label_encoder.pkl` in the same directory as `main.py`.
