"""
LSTM Hourly Solar Generation Training Script
Trains a sequence-to-sequence LSTM: 16 hours of weather -> 16 hours of generation (kWh).

Features (13):
  10 weather: temp_2m, cloud_cover, cloud_cover_low/mid/high, precipitation,
              relative_humidity, shortwave_radiation, dni, diffuse_radiation
   3 temporal: hour_sin, hour_cos, clear_sky_ratio

Architecture:
  Input(16, 13) -> LSTM(96, return_seq) -> Dropout(0.1) -> LSTM(64, return_seq)
  -> TimeDistributed(Dense(8, relu)) -> TimeDistributed(Dense(1, linear))
  Output: (16, 1)
"""

import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import warnings
warnings.filterwarnings("ignore")

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# ─────────────── Config ───────────────
DATASET_DIR = Path(__file__).parent.parent.parent / "dataset"
MODEL_DIR = Path(__file__).parent.parent.parent / "models"
SEQUENCE_LENGTH = 16  # hours 04:00-19:00
RANDOM_SEED = 42
tf.random.set_seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

# 13 features matching what the model will receive at inference
FEATURE_COLUMNS = [
    "temp_2m", "cloud_cover", "cloud_cover_low", "cloud_cover_mid",
    "cloud_cover_high", "precipitation", "relative_humidity",
    "shortwave_radiation", "dni", "diffuse_radiation",
    "hour_sin", "hour_cos", "clear_sky_ratio",
]

TARGET_COLUMN = "Campus_Yield_kWh"


def load_and_merge_data():
    """Load hourly weather + generation, merge on datetime."""
    print("Loading data...")

    weather = pd.read_csv(DATASET_DIR / "hourly_weather_clean.xls")
    weather["datetime"] = pd.to_datetime(weather["datetime"])

    yield_df = pd.read_csv(DATASET_DIR / "IITKGP_Campus_HourlyYield_2025.xls")
    yield_df["Date"] = pd.to_datetime(yield_df["Date"], format="%d-%b-%Y")
    yield_df["Hour"] = yield_df["Hour"].str.split(":").str[0].astype(int)
    yield_df["datetime"] = yield_df["Date"] + pd.to_timedelta(yield_df["Hour"], unit="h")

    merged = pd.merge(
        weather, yield_df[["datetime", "Campus_Yield_kWh"]],
        on="datetime", how="inner"
    )
    merged = merged.sort_values("datetime").reset_index(drop=True)
    print(f"  Merged: {len(merged)} rows ({merged['datetime'].min()} -> {merged['datetime'].max()})")
    return merged


def engineer_features(df):
    """Add temporal features: hour_sin, hour_cos, clear_sky_ratio."""
    df = df.copy()
    hour = df["datetime"].dt.hour
    doy = df["datetime"].dt.dayofyear

    df["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    df["hour_cos"] = np.cos(2 * np.pi * hour / 24)

    # Clear-sky ratio: actual shortwave / max possible (approx 1000 W/m² at equator)
    df["clear_sky_ratio"] = (df["shortwave_radiation"] / 1000.0).clip(0, 1)

    # Zero out generation when sun is down (radiation < 5 W/m²)
    df.loc[df["shortwave_radiation"] < 5, TARGET_COLUMN] = 0.0

    print(f"  Features engineered. Columns: {len(df.columns)}")
    return df


def create_sequences(data, targets, seq_length=16):
    """Create overlapping sequences of `seq_length` hours.

    Each sample: 16 consecutive hours of features -> 16 hours of generation.
    Only daytime hours (04:00-19:00) are included as valid start points.
    """
    X, y = [], []
    for i in range(len(data) - seq_length + 1):
        X.append(data[i : i + seq_length])
        y.append(targets[i : i + seq_length])
    return np.array(X), np.array(y)


def build_model(input_shape):
    """Build LSTM architecture matching the saved model."""
    model = keras.Sequential([
        layers.Input(shape=input_shape),
        layers.LSTM(96, return_sequences=True, name="lstm_2"),
        layers.Dropout(0.1, name="dropout_1"),
        layers.LSTM(64, return_sequences=True, name="lstm_3"),
        layers.TimeDistributed(layers.Dense(8, activation="relu", name="dense_1")),
        layers.TimeDistributed(layers.Dense(1, activation="linear", name="output")),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.005),
        loss="mse",
        metrics=["mae"],
    )
    return model


def evaluate(y_true, y_pred, label=""):
    """Compute and print regression metrics."""
    # Flatten for overall metrics
    y_true_flat = y_true.flatten()
    y_pred_flat = y_pred.flatten()

    # Only evaluate on non-zero targets (daytime hours)
    mask = y_true_flat > 0
    if mask.sum() == 0:
        print(f"  {label}: No non-zero targets to evaluate")
        return {}

    yt = y_true_flat[mask]
    yp = y_pred_flat[mask]

    mae = mean_absolute_error(yt, yp)
    rmse = np.sqrt(mean_squared_error(yt, yp))
    r2 = r2_score(yt, yp)

    # MAPE (avoid division by zero)
    nonzero = yt > 0
    if nonzero.sum() > 0:
        mape = np.mean(np.abs((yt[nonzero] - yp[nonzero]) / yt[nonzero])) * 100
    else:
        mape = float("inf")

    print(f"  {label}MAE={mae:.1f} kWh | RMSE={rmse:.1f} kWh | R²={r2:.3f} | MAPE={mape:.1f}%")
    return {"mae": mae, "rmse": rmse, "r2": r2, "mape": mape}


def main():
    # 1. Load data
    df = load_and_merge_data()
    df = engineer_features(df)

    # 2. Filter to solar hours only (04:00-19:00) for sequence creation
    hour_mask = (df["datetime"].dt.hour >= 4) & (df["datetime"].dt.hour <= 19)
    solar_df = df[hour_mask].reset_index(drop=True)
    print(f"  Solar hours (04:00-19:00): {len(solar_df)} rows")

    # 3. Extract features and targets
    features = solar_df[FEATURE_COLUMNS].values.astype(np.float32)
    targets = solar_df[TARGET_COLUMN].values.astype(np.float32)

    # 4. Scale features
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    # 5. Create sequences (each sample = 16 consecutive solar hours = 1 day)
    X, y = create_sequences(features_scaled, targets, SEQUENCE_LENGTH)
    print(f"  Sequences: X={X.shape}, y={y.shape}")

    # 6. Train/test split (time-series: last 20% as test)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    print(f"  Train: {X_train.shape[0]} days | Test: {X_test.shape[0]} days")

    # 7. Build and train
    model = build_model((SEQUENCE_LENGTH, len(FEATURE_COLUMNS)))
    model.summary()

    print("\nTraining...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=100,
        batch_size=32,
        callbacks=[
            keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-5),
        ],
        verbose=1,
    )

    # 8. Evaluate
    print("\n" + "=" * 60)
    y_pred_train = model.predict(X_train, verbose=0)
    y_pred_test = model.predict(X_test, verbose=0)

    print("Train Set:")
    train_metrics = evaluate(y_train, y_pred_train, "Train ")
    print("Test Set:")
    test_metrics = evaluate(y_test, y_pred_test, "Test  ")

    # 9. Per-hour metrics on test set
    print("\nPer-Hour Test MAPE:")
    for h in range(SEQUENCE_LENGTH):
        yt = y_test[:, h]
        yp = y_pred_test[:, h]
        mask = yt > 0
        if mask.sum() > 0:
            mape = np.mean(np.abs((yt[mask] - yp[mask]) / yt[mask])) * 100
            mae = mean_absolute_error(yt[mask], yp[mask])
            print(f"  Hour {h + 4:02d}:00 — MAPE={mape:.1f}%, MAE={mae:.1f} kWh")
        else:
            print(f"  Hour {h + 4:02d}:00 — no generation")

    # 10. Save model
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_DIR / "lstm_hourly_generation_model.keras"
    model.save(model_path)
    print(f"\nModel saved: {model_path}")

    # 11. Save scaler
    scaler_path = MODEL_DIR / "lstm_scaler.pkl"
    import joblib
    joblib.dump({"scaler": scaler, "features": FEATURE_COLUMNS}, scaler_path)
    print(f"Scaler saved: {scaler_path}")

    # 12. Save metrics
    metrics = {
        "features": FEATURE_COLUMNS,
        "n_features": len(FEATURE_COLUMNS),
        "sequence_length": SEQUENCE_LENGTH,
        "train_days": int(X_train.shape[0]),
        "test_days": int(X_test.shape[0]),
        "train_metrics": train_metrics,
        "test_metrics": test_metrics,
        "architecture": {
            "lstm_1_units": 96,
            "lstm_2_units": 64,
            "dropout": 0.1,
            "dense_units": 8,
            "optimizer": "adam",
            "learning_rate": 0.005,
            "loss": "mse",
        },
    }
    metrics_path = MODEL_DIR / "lstm_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Metrics saved: {metrics_path}")

    # 13. Save feature list for main.py
    feature_list_path = MODEL_DIR / "lstm_feature_list.json"
    with open(feature_list_path, "w") as f:
        json.dump(FEATURE_COLUMNS, f, indent=2)
    print(f"Feature list saved: {feature_list_path}")

    print("\n" + "=" * 60)
    print("DONE. Update main.py LSTM_HOURLY_FEATURES to match:")
    print(f"  {FEATURE_COLUMNS}")


if __name__ == "__main__":
    main()
