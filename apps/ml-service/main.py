from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict
from model.predict import predict_rul
from ocr import run_ocr

app = FastAPI(title="PFMI ML Prediction Service", version="1.0.0")

class SensorData(BaseModel):
    sensors: Dict[str, float]

@app.get("/")
def read_root():
    return {"status": "online", "service": "PFMI ML Service"}

@app.post("/predict")
def predict(data: SensorData):
    try:
        rul, anomaly = predict_rul(data.sensors)
        return {
            "remainingUsefulLife": rul,
            "anomalyDetected": anomaly,
            "confidence": 0.92
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ocr")
def ocr_pipeline(image_path: str):
    try:
        text = run_ocr(image_path)
        return {"extracted_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
