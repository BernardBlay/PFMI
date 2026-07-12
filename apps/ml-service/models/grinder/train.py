# Training script for RUL (Remaining Useful Life) LSTM modeling on Grinder Machine
import os
import pickle
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dropout, Dense

def train_grinder_lstm():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    data_path = os.path.join(base_dir, "data", "raw", "grinder_telemetry.csv")
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at {data_path}. Please run generate_data.py first.")
        
    print(f"Loading dataset from {data_path}...")
    df = pd.read_csv(data_path)
    
    features = [
        "Vibration_X_RMS", "Vibration_X_Peak",
        "Vibration_Y_RMS", "Vibration_Y_Peak",
        "Vibration_Z_RMS", "Vibration_Z_Peak",
        "Acoustic_Emission_RMS",
        "Throughput_Rate_Avg", "Rotational_Speed_Avg",
        "Gyratory_Clamping_Pressure",
        "Tramp_Release_Hydraulic_Pressure", "Lubrication_Oil_Pressure",
        "Lubrication_Oil_Temp", "Lube_Flow_Rate",
        "Lube_Filter_Differential_Pressure",
        "Metal_Debris_Particle_Count", "Oil_Moisture_Avg",
        "Oil_Viscosity_Avg", "Lube_Tank_Level",
        "Main_Motor_Current", "Main_Motor_Winding_Temp"
    ]
    
    # 1. Standardize Features
    print("Standardizing features...")
    scaler = StandardScaler()
    df_scaled_features = pd.DataFrame(scaler.fit_transform(df[features]), columns=features)
    
    # Keep operational session identifiers and continuous RUL target
    df_scaled_features["session_id"] = df["session_id"]
    df_scaled_features["hour_in_session"] = df["hour_in_session"]
    df_scaled_features["rul_hours"] = df["rul_hours"]
    
    # 2. Bin target RUL into 16 categories (0-15)
    print("Binning RUL hours into 16 categories...")
    # Get 16 category bins and store bin boundaries
    rul_binned, bin_edges = pd.cut(df["rul_hours"], bins=16, labels=False, retbins=True)
    df_scaled_features["rul_binned"] = rul_binned
    
    # 3. Construct sequences (seq_length = 15)
    seq_length = 15
    print(f"Structuring data into sequence windows of size {seq_length}...")
    
    X_seq = []
    y_seq = []
    
    for session_id, group in df_scaled_features.groupby("session_id"):
        group = group.sort_values("hour_in_session")
        group_feats = group[features].values
        group_targets = group["rul_binned"].values
        
        for i in range(seq_length, len(group)):
            # Slide window
            X_seq.append(group_feats[i - seq_length:i])
            # Target is binned RUL class at current time step
            y_seq.append(group_targets[i - 1])
            
    X_seq = np.array(X_seq)
    y_seq = np.array(y_seq)
    
    print(f"Dataset sequenced. Shape: {X_seq.shape}")
    
    # Split into train/validation sets (80% train, 20% val)
    train_size = int(len(X_seq) * 0.8)
    indices = np.random.permutation(len(X_seq))
    train_idx, val_idx = indices[:train_size], indices[train_size:]
    
    X_train, y_train = X_seq[train_idx], y_seq[train_idx]
    X_val, y_val = X_seq[val_idx], y_seq[val_idx]
    
    # 4. Build the requested LSTM network
    print("Compiling LSTM Model architecture...")
    model = Sequential([
        LSTM(128, return_sequences=True, input_shape=(seq_length, len(features))),
        Dropout(0.3),
        LSTM(64),
        Dropout(0.3),
        Dense(32, activation="relu"),
        Dense(16, activation="softmax")
    ])
    
    model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )
    
    model.summary()
    
    # 5. Train Model
    print("Training LSTM network...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=10,
        batch_size=64,
        verbose=1
    )
    
    # 6. Save Artifacts
    artifacts_dir = os.path.join(os.path.dirname(__file__), "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)
    
    # Save TensorFlow Keras model
    keras_path = os.path.join(artifacts_dir, "grinder_lstm.keras")
    model.save(keras_path)
    print(f"LSTM model saved successfully to {keras_path}")
    
    # Save standard scaler, feature lists, and bin edges for predictions mapping
    metadata = {
        "features": features,
        "scaler": scaler,
        "bin_edges": bin_edges,
        "seq_length": seq_length
    }
    
    metadata_path = os.path.join(artifacts_dir, "lstm_metadata.pkl")
    with open(metadata_path, "wb") as f:
        pickle.dump(metadata, f)
    print(f"LSTM metadata saved successfully to {metadata_path}")

if __name__ == "__main__":
    train_grinder_lstm()


