# Prediction inference script for Grinder Machine (LSTM + RF Hybrid)
import os
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Tuple
import tensorflow as tf

# Paths to trained model artifacts
MODEL_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
LSTM_MODEL_PATH = os.path.join(MODEL_DIR, "grinder_lstm.keras")
METADATA_PATH = os.path.join(MODEL_DIR, "lstm_metadata.pkl")
RF_MODEL_PATH = os.path.join(MODEL_DIR, "grinder_model.pkl")

# Baseline normal values for 21 sensor channels
BASELINES = {
    "Vibration_X_RMS": 1.35,
    "Vibration_X_Peak": 3.375,
    "Vibration_Y_RMS": 1.10,
    "Vibration_Y_Peak": 2.64,
    "Vibration_Z_RMS": 1.60,
    "Vibration_Z_Peak": 4.16,
    "Acoustic_Emission_RMS": 0.95,
    "Throughput_Rate_Avg": 350.0,
    "Rotational_Speed_Avg": 12.5,
    "Gyratory_Clamping_Pressure": 32.0,
    "Tramp_Release_Hydraulic_Pressure": 130.0,
    "Lubrication_Oil_Pressure": 4.8,
    "Lubrication_Oil_Temp": 52.0,
    "Lube_Flow_Rate": 140.0,
    "Lube_Filter_Differential_Pressure": 0.45,
    "Metal_Debris_Particle_Count": 90.0,
    "Oil_Moisture_Avg": 130.0,
    "Oil_Viscosity_Avg": 68.0,
    "Lube_Tank_Level": 91.0,
    "Main_Motor_Current": 250.0,
    "Main_Motor_Winding_Temp": 68.5
}

# Global in-memory cache for models and sequence history
_lstm_model = None
_metadata = None
_rf_model_payload = None
HISTORY_CACHE = {}

def load_models_and_metadata():
    global _lstm_model, _metadata, _rf_model_payload
    
    # 1. Load LSTM Metadata
    if _metadata is None:
        if os.path.exists(METADATA_PATH):
            try:
                with open(METADATA_PATH, "rb") as f:
                    _metadata = pickle.load(f)
                print(f"Loaded LSTM metadata from {METADATA_PATH}")
            except Exception as e:
                print(f"Error loading LSTM metadata: {e}")
                
    # 2. Load LSTM Keras model
    if _lstm_model is None:
        if os.path.exists(LSTM_MODEL_PATH):
            try:
                _lstm_model = tf.keras.models.load_model(LSTM_MODEL_PATH)
                print(f"Loaded LSTM model from {LSTM_MODEL_PATH}")
            except Exception as e:
                print(f"Error loading LSTM model: {e}")
                
    # 3. Load Random Forest Classifier
    if _rf_model_payload is None:
        if os.path.exists(RF_MODEL_PATH):
            try:
                with open(RF_MODEL_PATH, "rb") as f:
                    _rf_model_payload = pickle.load(f)
                print(f"Loaded Random Forest model from {RF_MODEL_PATH}")
            except Exception as e:
                print(f"Error loading RF model: {e}")

def map_sensors(sensor_readings: Dict[str, float]) -> Dict[str, float]:
    mapped = BASELINES.copy()
    
    # Direct case-insensitive key matching
    lower_readings = {k.lower().replace("_", "").replace(" ", ""): v for k, v in sensor_readings.items()}
    
    for feature in BASELINES.keys():
        f_key = feature.lower().replace("_", "").replace(" ", "")
        if f_key in lower_readings:
            mapped[feature] = lower_readings[f_key]
            
    # Aliases mapping
    if "vibration" in lower_readings:
        v_val = lower_readings["vibration"]
        for suffix in ["X_RMS", "Y_RMS", "Z_RMS"]:
            f_name = f"Vibration_{suffix}"
            if f_name.lower().replace("_", "") not in lower_readings:
                mapped[f_name] = v_val
                
    if "temperature" in lower_readings:
        t_val = lower_readings["temperature"]
        if "lubricationoiltemp" not in lower_readings:
            mapped["Lubrication_Oil_Temp"] = t_val
        if "mainmotorwindingtemp" not in lower_readings:
            mapped["Main_Motor_Winding_Temp"] = t_val + 16.5
            
    if "temp" in lower_readings:
        t_val = lower_readings["temp"]
        if "lubricationoiltemp" not in lower_readings:
            mapped["Lubrication_Oil_Temp"] = t_val
        if "mainmotorwindingtemp" not in lower_readings:
            mapped["Main_Motor_Winding_Temp"] = t_val + 16.5

    if "pressure" in lower_readings:
        p_val = lower_readings["pressure"]
        if "lubricationoilpressure" not in lower_readings:
            mapped["Lubrication_Oil_Pressure"] = p_val
            
    return mapped

def predict_rul(sensor_readings: Dict[str, float]) -> Tuple[float, bool, str]:
    """
    Predicts Remaining Useful Life (RUL) using the trained LSTM model (16 output categories)
    and predicts failure type using the Random Forest classifier.
    
    Returns:
        Tuple of (predicted_rul_hours, anomaly_detected, predicted_failure_type)
    """
    load_models_and_metadata()
    
    # Fallback to rule-based logic if LSTM model is missing
    if _lstm_model is None or _metadata is None:
        vibration = sensor_readings.get("vibration", 1.35)
        temperature = sensor_readings.get("temperature", 52.0)
        
        anomaly = False
        rul = 120.0
        failure_type = "none"
        
        if vibration > 4.0 or temperature > 80.0:
            anomaly = True
            rul = 12.0
            failure_type = "seal_leak"
        elif vibration > 2.5 or temperature > 65.0:
            rul = 45.0
            failure_type = "multiple"
            
        return rul, anomaly, failure_type

    try:
        # 1. Map raw inputs to 21 features
        mapped_data = map_sensors(sensor_readings)
        features = _metadata["features"]
        
        # 2. Convert to 1-row DataFrame for scaling
        df_row = pd.DataFrame([mapped_data])[features]
        scaled_row = _metadata["scaler"].transform(df_row)[0]
        
        # 3. Handle sliding sequence window (seq_length = 15)
        equipment_id = sensor_readings.get("equipment_id", sensor_readings.get("session_id", "grinder"))
        equipment_id = str(equipment_id)
        
        if equipment_id not in HISTORY_CACHE:
            HISTORY_CACHE[equipment_id] = []
            
        HISTORY_CACHE[equipment_id].append(scaled_row)
        print(f"DEBUG: HISTORY_CACHE key '{equipment_id}' length is: {len(HISTORY_CACHE[equipment_id])}")
        
        # Cap history to seq_length
        seq_length = _metadata["seq_length"]
        if len(HISTORY_CACHE[equipment_id]) > seq_length:
            HISTORY_CACHE[equipment_id].pop(0)
            
        # Pad sequence if history is too short
        current_history = HISTORY_CACHE[equipment_id]
        if len(current_history) < seq_length:
            needed = seq_length - len(current_history)
            # Pad by replicating the first available reading
            first_reading = current_history[0]
            padding = [first_reading for _ in range(needed)]
            sequence = padding + current_history
        else:
            sequence = current_history
            
        # Reshape to sequence input: (1, seq_length, features)
        X_input = np.array([sequence])
        
        # 4. Predict binned RUL using LSTM
        preds = _lstm_model.predict(X_input, verbose=0)[0]
        pred_class = int(np.argmax(preds))
        
        # Translate predicted bin back to hours
        bin_edges = _metadata["bin_edges"]
        lower_bound = bin_edges[pred_class]
        upper_bound = bin_edges[pred_class + 1]
        predicted_rul = float((lower_bound + upper_bound) / 2.0)
        
        # 5. Predict failure type using RF model if available, else fall back to threshold mapping
        predicted_failure = "none"
        if _rf_model_payload is not None:
            df_rf_input = pd.DataFrame([mapped_data])[features]
            predicted_failure = str(_rf_model_payload["fail_model"].predict(df_rf_input)[0])
        else:
            # Fallback heuristic
            if mapped_data["Vibration_Z_Peak"] > 7.0:
                predicted_failure = "crusher_liner"
            elif mapped_data["Lubrication_Oil_Temp"] > 65.0:
                predicted_failure = "seal_leak"
                
        # Determine anomaly flag (abnormal failure state or critical RUL)
        anomaly = predicted_failure != "none" or predicted_rul < 100.0
        
        return round(predicted_rul, 2), anomaly, predicted_failure
        
    except Exception as e:
        print(f"LSTM model inference error: {e}")
        return 120.0, False, "none"

if __name__ == "__main__":
    print("\n--- STANDALONE MODEL TEST ---")
    rul, anomaly, ftype = predict_rul(BASELINES)
    print(f"Input: Normal Baseline Telemetry")
    print(f"Predicted RUL: {rul} hours")
    print(f"Anomaly Detected: {anomaly}")
    print(f"Failure Classification: {ftype}\n")


