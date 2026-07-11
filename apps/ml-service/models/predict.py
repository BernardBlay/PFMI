# Prediction inference script
from typing import Dict, Tuple

def predict_rul(sensor_readings: Dict[str, float]) -> Tuple[float, bool]:
    """
    Predicts Remaining Useful Life and returns if anomaly is detected.
    """
    # Mock inference using input sensors
    vibration = sensor_readings.get("vibration", 0.5)
    temperature = sensor_readings.get("temperature", 65.0)
    
    anomaly = False
    rul = 120.0
    
    if vibration > 1.8 or temperature > 95.0:
        anomaly = True
        rul = 12.0
    elif vibration > 1.2 or temperature > 80.0:
        rul = 45.0
        
    return rul, anomaly
