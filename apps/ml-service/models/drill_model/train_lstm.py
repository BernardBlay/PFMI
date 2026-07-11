#!/usr/bin/env python3
"""
Multi-task LSTM for Predictive Maintenance on Hydraulic Drill Rig Data.

Architecture:
  Input (24h x 21 sensors) -> Masking(-1.0) -> LSTM(128, return_seq) -> Dropout(0.3)
  -> LSTM(64) -> Dropout(0.3) -> Dense(64, ReLU) + BatchNorm -> 3 heads

Heads:
  A -- Component Health: 7 x 3-class softmax (healthy/degraded/imminent)
  B -- RUL Regression: 1 output, MSE
  C -- Failure Type: 9-class softmax

Total Loss = 2.0-L_health + 0.5-L_rul + 1.0-L_failtype
"""

import os
import warnings
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.utils.class_weight import compute_class_weight

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
warnings.filterwarnings("ignore")

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model, Input

# ---- Constants ----------------------------------------------------------------------------------------------------------------------------
CSV_PATH = "synthetic_drill_rig_dataset.csv"
WINDOW_SIZE = 24       # hours per sequence
STRIDE = 6             # step between sequence starts
MASK_VALUE = -1.0      # sentinel for sensor dropout
BATCH_SIZE = 64
EPOCHS = 40
PATIENCE = 10
LEARNING_RATE = 0.001

# Column definitions (must match dataset)
SENSOR_COLS = [
    "Vibration_X_RMS", "Vibration_X_Peak", "Vibration_Y_RMS", "Vibration_Y_Peak",
    "Vibration_Z_RMS", "Vibration_Z_Peak", "Acoustic_Emission_RMS",
    "Penetration_Rate_Avg", "Rotation_Speed_Avg", "Feed_Pressure_Avg",
    "Hydraulic_Pressure_Avg", "Hydraulic_Return_Pressure_Avg",
    "Hydraulic_Oil_Temp_Avg", "Flow_Rate_Avg",
    "Differential_Pressure_Filter_Avg", "Oil_Particle_Count_Avg",
    "Oil_Moisture_Avg", "Oil_Viscosity_Avg", "Tank_Level_End",
    "Drive_Motor_Current_Avg", "Motor_Winding_Temp_Avg",
]

HEALTH_COLS = [
    "drill_bit_health", "striker_bar_health", "drill_rod_health",
    "coupling_sleeve_health", "hydraulic_seal_health",
    "hydraulic_hose_health", "filter_health",
]

FAILURE_TYPES = [
    "none", "drill_bit", "striker_bar", "drill_rod",
    "coupling_sleeve", "seal_leak", "hose_burst", "filter_clog", "multiple",
]

META_COLS = ["session_id", "hour_in_session", "failure_type", "rul_hours"]


# ---- Data Loading ----------------------------------------------------------------------------------------------------------------------
def load_and_split(sess_train=(0, 1, 2, 3, 4, 5), sess_val=(6, 7), sess_test=(8, 9)):
    """Load CSV, split by session_id, return raw DataFrames."""
    df = pd.read_csv(CSV_PATH)
    print(f"Loaded {len(df)} rows, {len(df['session_id'].unique())} sessions")
    print(f"  Health dist: {df[HEALTH_COLS].apply(pd.Series.value_counts).to_dict()}")

    train_df = df[df["session_id"].isin(sess_train)].copy()
    val_df   = df[df["session_id"].isin(sess_val)].copy()
    test_df  = df[df["session_id"].isin(sess_test)].copy()

    print(f"  Train: sessions {sess_train} -> {len(train_df)} rows")
    print(f"  Val:   sessions {sess_val} -> {len(val_df)} rows")
    print(f"  Test:  sessions {sess_test} -> {len(test_df)} rows")
    return train_df, val_df, test_df


# ---- Sequence Builder --------------------------------------------------------------------------------------------------------------
def build_sequences(df, scaler=None, fit_scaler=False):
    """
    Build (X, y_health, y_rul, y_failtype) from a DataFrame.
    Sequences are built per-session (no cross-session leakage).
    Sensor values replaced with MASK_VALUE where they are 0.0 (dropout sentinel)
    or near-zero (stuck sensor).

    Returns:
        X: (n_seqs, WINDOW_SIZE, 21)
        y_health: (n_seqs, 7) -- integer labels 0/1/2
        y_rul: (n_seqs, 1)
        y_failtype: (n_seqs,)
    """
    X_list, yh_list, yr_list, yf_list = [], [], [], []

    # Encode failure type
    le = LabelEncoder()
    le.fit(FAILURE_TYPES)

    # Fit or apply scaler
    if fit_scaler:
        scaler = StandardScaler()
        scaler.fit(df[SENSOR_COLS].values)

    for sid, grp in df.groupby("session_id"):
        grp = grp.sort_values("hour_in_session")
        sensors = grp[SENSOR_COLS].values.astype(np.float32)
        sensors = scaler.transform(sensors)

        # Mask: replace 0.0 values (dropout sentinel) with MASK_VALUE
        # Also catch "stuck" sensor values -- values that are exactly equal
        # to the previous timestep 3+ times in a row
        for c in range(sensors.shape[1]):
            col = sensors[:, c]
            # Detect repeated identical values (stuck sensor)
            for i in range(2, len(col)):
                if col[i] == col[i-1] == col[i-2] and col[i] == col[i-3]:
                    col[i] = MASK_VALUE
            # Detect zeros (dropouts)
            col[col == 0.0] = MASK_VALUE

        health = grp[HEALTH_COLS].fillna(0).values.astype(np.int32)
        rul = grp["rul_hours"].fillna(0).values.astype(np.float32) / 2000.0  # normalize to 0-1
        failtype = le.transform(grp["failure_type"].fillna("none"))

        n = len(sensors)
        for start in range(0, n - WINDOW_SIZE, STRIDE):
            end = start + WINDOW_SIZE
            X_list.append(sensors[start:end])
            # Target: label at the LAST hour of the window (prediction target)
            yh_list.append(health[end - 1])
            yr_list.append(max(0, rul[end - 1]))  # clamp negative RUL to 0
            yf_list.append(failtype[end - 1])

    X = np.stack(X_list, axis=0).astype(np.float32)
    y_health = np.stack(yh_list, axis=0).astype(np.int32)
    y_rul = np.stack(yr_list, axis=0).astype(np.float32).reshape(-1, 1)
    y_failtype = np.stack(yf_list, axis=0).astype(np.int32)

    if fit_scaler:
        return X, y_health, y_rul, y_failtype, scaler, le
    return X, y_health, y_rul, y_failtype


# ---- Model ------------------------------------------------------------------------------------------------------------------------------------
def build_model(input_shape=(WINDOW_SIZE, 21)):
    """Masking -> LSTM(128) -> Dropout -> LSTM(64) -> Dropout -> Bottleneck -> 3 heads."""

    # ---- Input + Masking ------------------------------------------------------------------------------------------------
    inp = Input(shape=input_shape, name="sensor_input")
    x = layers.Masking(mask_value=MASK_VALUE, name="masking")(inp)

    # ---- LSTM Stack ----------------------------------------------------------------------------------------------------------
    x = layers.LSTM(128, return_sequences=True, dropout=0.3,
                    recurrent_dropout=0.0, name="lstm_1")(x)
    x = layers.LSTM(64, return_sequences=False, dropout=0.3,
                    recurrent_dropout=0.0, name="lstm_2")(x)

    # ---- Shared Bottleneck --------------------------------------------------------------------------------------------
    x = layers.Dense(64, activation="relu", name="bottleneck")(x)
    x = layers.BatchNormalization(name="bn")(x)

    # ---- Head A: Component Health (7 x 3-class) ------------------------------------------------
    health_outputs = []
    for i, name in enumerate(HEALTH_COLS):
        h = layers.Dense(16, activation="relu", name=f"health_{name}_hidden")(x)
        h = layers.Dense(3, activation="softmax", name=f"health_{name}")(h)
        health_outputs.append(h)

    # ---- Head B: RUL Regression ----------------------------------------------------------------------------------
    rul_out = layers.Dense(32, activation="relu", name="rul_hidden")(x)
    rul_out = layers.Dense(1, activation="linear", name="rul")(rul_out)

    # ---- Head C: Failure Type (9-class) ------------------------------------------------------------------
    ft_out = layers.Dense(32, activation="relu", name="failtype_hidden")(x)
    ft_out = layers.Dense(len(FAILURE_TYPES), activation="softmax", name="failure_type")(ft_out)

    # ---- Combined Model --------------------------------------------------------------------------------------------------
    model = Model(inputs=inp, outputs=health_outputs + [rul_out, ft_out],
                  name="drill_rig_lstm")

    # Losses: health heads weighted 2.0, RUL 0.5, failtype 1.0
    losses = {}
    loss_weights = {}
    for name in HEALTH_COLS:
        losses[f"health_{name}"] = "sparse_categorical_crossentropy"
        loss_weights[f"health_{name}"] = 2.0
    losses["rul"] = "mse"
    loss_weights["rul"] = 1.0
    losses["failure_type"] = "sparse_categorical_crossentropy"
    loss_weights["failure_type"] = 1.0

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss=losses,
        loss_weights=loss_weights,
        metrics={
            **{f"health_{name}": ["accuracy"] for name in HEALTH_COLS},
            "rul": ["mae"],
            "failure_type": ["accuracy"],
        },
    )

    return model


# ---- Training ------------------------------------------------------------------------------------------------------------------------------
def train(model, X_train, y_train, X_val, y_val):
    """Train with class weights, early stopping, LR scheduler."""

    # Build target dict for multi-output model
    y_train_dict = {}
    y_val_dict = {}
    for i, name in enumerate(HEALTH_COLS):
        y_train_dict[f"health_{name}"] = y_train["health"][:, i]
        y_val_dict[f"health_{name}"] = y_val["health"][:, i]
    y_train_dict["rul"] = y_train["rul"]
    y_val_dict["rul"] = y_val["rul"]
    y_train_dict["failure_type"] = y_train["failtype"]
    y_val_dict["failure_type"] = y_val["failtype"]

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=PATIENCE,
            restore_best_weights=True, verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=5,
            min_lr=1e-6, verbose=1
        ),
        keras.callbacks.ModelCheckpoint(
            "best_lstm_model.keras", monitor="val_loss",
            save_best_only=True, verbose=1
        ),
    ]

    history = model.fit(
        X_train, y_train_dict,
        validation_data=(X_val, y_val_dict),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1,
    )

    return history


# ---- Evaluation --------------------------------------------------------------------------------------------------------------------------
def evaluate(model, X_test, y_test, le):
    """Print per-head metrics."""
    y_test_dict = {}
    for i, name in enumerate(HEALTH_COLS):
        y_test_dict[f"health_{name}"] = y_test["health"][:, i]
    y_test_dict["rul"] = y_test["rul"]
    y_test_dict["failure_type"] = y_test["failtype"]

    results = model.evaluate(X_test, y_test_dict, verbose=0, return_dict=True)

    print("\n" + "=" * 60)
    print("TEST SET RESULTS")
    print("=" * 60)

    # Health heads
    print("\n---- Component Health (lossv acc^) ----")
    for name in HEALTH_COLS:
        loss_key = f"health_{name}_loss"
        acc_key = f"health_{name}_accuracy"
        print(f"  {name:25s}  loss={results.get(loss_key, 0):.4f}  acc={results.get(acc_key, 0):.3f}")

    print(f"\n---- RUL Regression ----")
    print(f"  loss (MSE, normalized)={results.get('rul_loss', 0):.4f}  MAE={results.get('rul_mae', 0)*2000:.1f} hours")

    print(f"\n---- Failure Type ----")
    print(f"  loss={results.get('failure_type_loss', 0):.4f}  acc={results.get('failure_type_accuracy', 0):.3f}")

    # ---- Detailed per-component classification report ----------------------------------------
    print("\n---- Per-Component Classification Report ----")
    preds = model.predict(X_test, verbose=0)
    health_preds = preds[:7]  # first 7 outputs are health heads
    health_true = y_test["health"]

    for i, name in enumerate(HEALTH_COLS):
        yt = health_true[:, i]
        yp = np.argmax(health_preds[i], axis=1)

        # Per-class precision/recall
        for cls_id, cls_name in enumerate(["healthy", "degraded", "imminent"]):
            tp = np.sum((yp == cls_id) & (yt == cls_id))
            fp = np.sum((yp == cls_id) & (yt != cls_id))
            fn = np.sum((yp != cls_id) & (yt == cls_id))
            prec = tp / (tp + fp + 1e-8)
            rec = tp / (tp + fn + 1e-8)
            f1 = 2 * prec * rec / (prec + rec + 1e-8)
            support = np.sum(yt == cls_id)
            if support > 0:
                print(f"  {name:25s} {cls_name:10s}  P={prec:.3f}  R={rec:.3f}  F1={f1:.3f}  N={support}")

    # ---- RUL error distribution ----------------------------------------------------------------------------------
    rul_preds = preds[7]  # 8th output is RUL
    # Denormalize RUL (model outputs 0-1, scale back to hours)
    rul_errors = np.abs(rul_preds.flatten() * 2000.0 - y_test["rul"].flatten() * 2000.0)
    print(f"\n---- RUL Error Distribution ----")
    print(f"  MAE:  {np.mean(rul_errors):.1f} hours")
    print(f"  RMSE: {np.sqrt(np.mean(rul_errors**2)):.1f} hours")
    print(f"  Median error: {np.median(rul_errors):.1f} hours")
    print(f"  P90 error:    {np.percentile(rul_errors, 90):.1f} hours")

    # ---- Failure type confusion ----------------------------------------------------------------------------------
    ft_preds = preds[8]  # 9th output is failure type
    ft_true = y_test["failtype"]
    ft_pred_class = np.argmax(ft_preds, axis=1)
    acc = np.mean(ft_pred_class == ft_true)
    print(f"\n---- Failure Type Accuracy: {acc:.3f} ----")

    # Show most common confusions
    from collections import Counter
    confusions = Counter()
    for t, p in zip(ft_true, ft_pred_class):
        if t != p:
            confusions[(le.inverse_transform([t])[0], le.inverse_transform([p])[0])] += 1
    if confusions:
        print("  Top confusions:")
        for (true, pred), count in confusions.most_common(8):
            print(f"    {true:20s} -> {pred:20s}  ({count}x)")

    return results


# ---- Main --------------------------------------------------------------------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("LSTM Predictive Maintenance -- Drill Rig")
    print(f"Window={WINDOW_SIZE}h  Stride={STRIDE}h  MaskValue={MASK_VALUE}")
    print("=" * 60)

    # 1. Load data
    train_df, val_df, test_df = load_and_split()

    # 2. Build sequences (fit scaler on train only)
    print("\nBuilding sequences...")
    X_train, yh_train, yr_train, yf_train, scaler, le = build_sequences(
        train_df, fit_scaler=True
    )
    X_val, yh_val, yr_val, yf_val = build_sequences(val_df, scaler=scaler)
    X_test, yh_test, yr_test, yf_test = build_sequences(test_df, scaler=scaler)

    print(f"  Train: {X_train.shape[0]} sequences")
    print(f"  Val:   {X_val.shape[0]} sequences")
    print(f"  Test:  {X_test.shape[0]} sequences")

    # Show label distribution in train
    for i, name in enumerate(HEALTH_COLS):
        vals, counts = np.unique(yh_train[:, i], return_counts=True)
        dist = dict(zip(vals, counts))
        print(f"  {name}: {dist}")

    # 3. Build model
    print("\nBuilding model...")
    model = build_model()
    model.summary()

    # 4. Train
    print("\nTraining...")
    y_train = {"health": yh_train, "rul": yr_train, "failtype": yf_train}
    y_val = {"health": yh_val, "rul": yr_val, "failtype": yf_val}
    y_test = {"health": yh_test, "rul": yr_test, "failtype": yf_test}

    history = train(model, X_train, y_train, X_val, y_val)

    # 5. Evaluate
    evaluate(model, X_test, y_test, le)

    # 6. Save final model and scaler
    model.save("lstm_model.keras")
    np.savez("scaler_params.npz",
             mean=scaler.mean_.astype(np.float32),
             std=scaler.scale_.astype(np.float32))
    print("\nModel saved to lstm_model.keras, scaler saved to scaler_params.npz")

    return model, history


if __name__ == "__main__":
    main()
