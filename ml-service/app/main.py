import os
import json
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import joblib
import warnings

warnings.filterwarnings("ignore")

logger = logging.getLogger("ml-service")
logging.basicConfig(level=logging.INFO)

MODEL_DIR = Path(os.environ.get("MODEL_DIR", str(Path(__file__).parent.parent.parent / "models")))
DATASET_DIR = Path(os.environ.get("DATASET_DIR", str(Path(__file__).parent.parent.parent / "dataset")))

# Feature list from the trained XGBoost model
FEATURE_LIST = [
    "temp_mean", "temp_max", "temp_min", "cloud_cover_mean", "humidity_mean",
    "ghi_sum", "dni_sum", "diffuse_sum", "precipitation_sum",
    "month_sin", "month_cos", "doy_sin", "doy_cos",
    "monsoon_flag", "season_encoded", "day_of_week",
    "lag_1", "lag_2", "lag_7",
    "rolling_3d_mean", "rolling_7d_mean", "rolling_7d_std",
    "ghi_rolling_3d", "cloud_rolling_3d", "gen_trend_3d"
]

# Open-Meteo Forecast API → Training feature name mapping
FORECAST_TO_TRAINING_MAP = {
    "temperature_2m": "temp_2m",
    "relative_humidity_2m": "relative_humidity",
    "direct_normal_irradiance": "dni",
    "shortwave_radiation": "shortwave_radiation",
    "diffuse_radiation": "diffuse_radiation",
    "cloud_cover": "cloud_cover",
    "cloud_cover_low": "cloud_cover_low",
    "cloud_cover_mid": "cloud_cover_mid",
    "cloud_cover_high": "cloud_cover_high",
    "precipitation": "precipitation",
}

# LSTM hourly feature columns (matching training data hourly_weather_clean.xls)
LSTM_HOURLY_FEATURES = [
    "temp_2m", "cloud_cover", "cloud_cover_low", "cloud_cover_mid",
    "cloud_cover_high", "precipitation", "relative_humidity",
    "shortwave_radiation", "dni", "diffuse_radiation"
]

# Global model objects
xgb_p10 = None
xgb_p50 = None
xgb_p90 = None
lstm_model = None
historical_daily = None
historical_hourly = None


def load_models():
    """Load all model artifacts at startup."""
    global xgb_p10, xgb_p50, xgb_p90, lstm_model
    global historical_daily, historical_hourly

    logger.info(f"Loading models from {MODEL_DIR}")

    # Load XGBoost quantile models
    xgb_p10 = joblib.load(MODEL_DIR / "xgb_q10.pkl")
    xgb_p50 = joblib.load(MODEL_DIR / "xgb_q50.pkl")
    xgb_p90 = joblib.load(MODEL_DIR / "xgb_q90.pkl")
    logger.info("XGBoost P10/P50/P90 models loaded")

    # Load LSTM model
    try:
        from tensorflow import keras
        lstm_path = MODEL_DIR / "lstm_hourly_generation_model_tuned.keras"
        if not lstm_path.exists():
            lstm_path = MODEL_DIR / "lstm_hourly_generation_model.keras"
        lstm_model = keras.models.load_model(lstm_path)
        logger.info(f"LSTM model loaded from {lstm_path}")
        logger.info(f"LSTM input shape: {lstm_model.input_shape}, output shape: {lstm_model.output_shape}")
    except Exception as e:
        logger.warning(f"LSTM model load failed: {e}. Hourly predictions will be unavailable.")
        lstm_model = None

    # Load historical data for lag features
    try:
        daily_path = DATASET_DIR / "daily_calibrated.csv"
        if daily_path.exists():
            historical_daily = pd.read_csv(daily_path, parse_dates=["date"])
            historical_daily = historical_daily.sort_values("date").reset_index(drop=True)
            logger.info(f"Historical daily data loaded: {len(historical_daily)} rows")

        hourly_path = DATASET_DIR / "hourly_weather_clean.xls"
        if hourly_path.exists():
            historical_hourly = pd.read_csv(hourly_path, parse_dates=["datetime"])
            historical_hourly = historical_hourly.sort_values("datetime").reset_index(drop=True)
            logger.info(f"Historical hourly data loaded: {len(historical_hourly)} rows")
    except Exception as e:
        logger.warning(f"Historical data load failed: {e}. Lag features will use defaults.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    yield


app = FastAPI(title="Urjasetu ML Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────── Request/Response Models ───────────────

class DailyWeatherInput(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    temp_mean: float
    temp_max: float
    temp_min: float
    cloud_cover_mean: float
    humidity_mean: float
    ghi_sum: float
    dni_sum: float
    diffuse_sum: float
    precipitation_sum: float
    lag_1: Optional[float] = None
    lag_2: Optional[float] = None
    lag_7: Optional[float] = None
    rolling_3d_mean: Optional[float] = None
    rolling_7d_mean: Optional[float] = None
    rolling_7d_std: Optional[float] = None
    ghi_rolling_3d: Optional[float] = None
    cloud_rolling_3d: Optional[float] = None
    gen_trend_3d: Optional[float] = None


class DailyForecastResponse(BaseModel):
    date: str
    p10_kwh: float
    p50_kwh: float
    p90_kwh: float


class HourlyWeatherInput(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    hourly_data: List[dict] = Field(..., description="16 hours of weather data (04:00-19:00)")


class HourlyForecastResponse(BaseModel):
    date: str
    hourly_kwh: List[float]
    total_kwh: float


class OpenMeteoForecastInput(BaseModel):
    """Raw Open-Meteo forecast API response, to be mapped to training features."""
    date: str
    hourly: dict = Field(..., description="Hourly data from Open-Meteo forecast API")


# ─────────────── Helper Functions ───────────────

def engineer_daily_features(row: dict, date_str: str) -> np.ndarray:
    """Convert raw daily weather + lag values into the 25-feature vector."""
    dt = pd.Timestamp(date_str)
    month = dt.month
    doy = dt.dayofyear
    dow = dt.dayofweek

    features = {
        "temp_mean": row["temp_mean"],
        "temp_max": row["temp_max"],
        "temp_min": row["temp_min"],
        "cloud_cover_mean": row["cloud_cover_mean"],
        "humidity_mean": row["humidity_mean"],
        "ghi_sum": row["ghi_sum"],
        "dni_sum": row["dni_sum"],
        "diffuse_sum": row["diffuse_sum"],
        "precipitation_sum": row["precipitation_sum"],
        "month_sin": np.sin(2 * np.pi * month / 12),
        "month_cos": np.cos(2 * np.pi * month / 12),
        "doy_sin": np.sin(2 * np.pi * doy / 365),
        "doy_cos": np.cos(2 * np.pi * doy / 365),
        "monsoon_flag": 1 if month in [6, 7, 8, 9] else 0,
        "season_encoded": (month % 12 + 3) // 3 % 4,
        "day_of_week": dow,
        "lag_1": row.get("lag_1", 0),
        "lag_2": row.get("lag_2", 0),
        "lag_7": row.get("lag_7", 0),
        "rolling_3d_mean": row.get("rolling_3d_mean", 0),
        "rolling_7d_mean": row.get("rolling_7d_mean", 0),
        "rolling_7d_std": row.get("rolling_7d_std", 0),
        "ghi_rolling_3d": row.get("ghi_rolling_3d", 0),
        "cloud_rolling_3d": row.get("cloud_rolling_3d", 0),
        "gen_trend_3d": row.get("gen_trend_3d", 0),
    }

    return np.array([[features[f] for f in FEATURE_LIST]])


def map_forecast_to_training(hourly_data: dict) -> pd.DataFrame:
    """Map Open-Meteo forecast API fields to training feature names."""
    mapped = {}
    for forecast_key, training_key in FORECAST_TO_TRAINING_MAP.items():
        if forecast_key in hourly_data:
            mapped[training_key] = hourly_data[forecast_key]

    df = pd.DataFrame(mapped)
    return df


# ─────────────── API Endpoints ───────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": {
            "xgb_p10": xgb_p10 is not None,
            "xgb_p50": xgb_p50 is not None,
            "xgb_p90": xgb_p90 is not None,
            "lstm": lstm_model is not None,
        }
    }


@app.post("/predict/daily", response_model=DailyForecastResponse)
async def predict_daily(input_data: DailyWeatherInput):
    """Predict P10/P50/P90 daily solar generation (kWh)."""
    if not all([xgb_p10, xgb_p50, xgb_p90]):
        raise HTTPException(status_code=503, detail="XGBoost models not loaded")

    row = input_data.model_dump()
    X = engineer_daily_features(row, input_data.date)

    p10 = float(xgb_p10.predict(X)[0])
    p50 = float(xgb_p50.predict(X)[0])
    p90 = float(xgb_p90.predict(X)[0])

    # Ensure P10 <= P50 <= P90
    p10, p50, p90 = sorted([p10, p50, p90])

    return DailyForecastResponse(
        date=input_data.date,
        p10_kwh=round(p10, 2),
        p50_kwh=round(p50, 2),
        p90_kwh=round(p90, 2),
    )


@app.post("/predict/daily/openmeteo")
async def predict_daily_from_openmeteo(input_data: OpenMeteoForecastInput):
    """Accept raw Open-Meteo forecast data, map fields, predict daily generation."""
    if not all([xgb_p10, xgb_p50, xgb_p90]):
        raise HTTPException(status_code=503, detail="XGBoost models not loaded")

    hourly_df = map_forecast_to_training(input_data.hourly)

    # Aggregate hourly to daily features
    row = {
        "temp_mean": hourly_df["temp_2m"].mean(),
        "temp_max": hourly_df["temp_2m"].max(),
        "temp_min": hourly_df["temp_2m"].min(),
        "cloud_cover_mean": hourly_df["cloud_cover"].mean(),
        "humidity_mean": hourly_df["relative_humidity"].mean(),
        "ghi_sum": hourly_df["shortwave_radiation"].sum(),
        "dni_sum": hourly_df["dni"].sum(),
        "diffuse_sum": hourly_df["diffuse_radiation"].sum(),
        "precipitation_sum": hourly_df["precipitation"].sum(),
    }

    X = engineer_daily_features(row, input_data.date)

    p10 = float(xgb_p10.predict(X)[0])
    p50 = float(xgb_p50.predict(X)[0])
    p90 = float(xgb_p90.predict(X)[0])

    p10, p50, p90 = sorted([p10, p50, p90])

    return DailyForecastResponse(
        date=input_data.date,
        p10_kwh=round(p10, 2),
        p50_kwh=round(p50, 2),
        p90_kwh=round(p90, 2),
    )


@app.post("/predict/hourly", response_model=HourlyForecastResponse)
async def predict_hourly(input_data: HourlyWeatherInput):
    """Predict 16-hour (04:00-19:00) generation profile using LSTM."""
    if lstm_model is None:
        raise HTTPException(status_code=503, detail="LSTM model not loaded")

    if len(input_data.hourly_data) != 16:
        raise HTTPException(status_code=400, detail="Exactly 16 hourly records required (04:00-19:00)")

    # Build feature matrix
    features = []
    for h in input_data.hourly_data:
        row = [
            h.get("temp_2m", 0),
            h.get("cloud_cover", 0),
            h.get("cloud_cover_low", 0),
            h.get("cloud_cover_mid", 0),
            h.get("cloud_cover_high", 0),
            h.get("precipitation", 0),
            h.get("relative_humidity", 0),
            h.get("shortwave_radiation", 0),
            h.get("dni", 0),
            h.get("diffuse_radiation", 0),
        ]
        features.append(row)

    X = np.array([features])  # shape: (1, 16, 10)
    logger.info(f"LSTM input shape: {X.shape}")

    try:
        predictions = lstm_model.predict(X, verbose=0)
        hourly_kwh = predictions[0].tolist()
    except Exception as e:
        logger.error(f"LSTM prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"LSTM prediction failed: {str(e)}")

    return HourlyForecastResponse(
        date=input_data.date,
        hourly_kwh=[round(v, 2) for v in hourly_kwh],
        total_kwh=round(sum(hourly_kwh), 2),
    )


@app.get("/model/info")
async def model_info():
    """Return model metadata."""
    return {
        "daily_xgboost": {
            "features": FEATURE_LIST,
            "n_features": len(FEATURE_LIST),
            "metrics": {
                "test_mape": 16.12,
                "test_r2": 0.71,
                "monsoon_mape": 20.70,
            },
            "quantile_metrics": {
                "p50_mape": 16.91,
                "coverage_80pct": 80.0,
            },
        },
        "hourly_lstm": {
            "input_features": LSTM_HOURLY_FEATURES,
            "input_shape": [16, 10],
            "output_shape": [16],
            "forecast_window": "04:00-19:00 (16 hours)",
        },
        "field_mapping": FORECAST_TO_TRAINING_MAP,
    }


# ─────────────── Weather Forecast Endpoints ───────────────

@app.get("/forecast/daily")
async def get_daily_forecast(date: str):
    """Fetch Open-Meteo forecast, map fields, and predict daily generation."""
    from app.weather_adapter import fetch_and_prepare_daily

    try:
        features = fetch_and_prepare_daily(date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")

    if not all([xgb_p10, xgb_p50, xgb_p90]):
        raise HTTPException(status_code=503, detail="XGBoost models not loaded")

    X = engineer_daily_features(features, date)
    p10 = float(xgb_p10.predict(X)[0])
    p50 = float(xgb_p50.predict(X)[0])
    p90 = float(xgb_p90.predict(X)[0])
    p10, p50, p90 = sorted([p10, p50, p90])

    return {
        "date": date,
        "weather_features": features,
        "forecast": {
            "p10_kwh": round(p10, 2),
            "p50_kwh": round(p50, 2),
            "p90_kwh": round(p90, 2),
        }
    }


@app.get("/forecast/hourly")
async def get_hourly_forecast(date: str):
    """Fetch Open-Meteo forecast and predict 16-hour generation profile."""
    from app.weather_adapter import fetch_and_prepare_hourly

    try:
        hourly_data = fetch_and_prepare_hourly(date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")

    if lstm_model is None:
        raise HTTPException(status_code=503, detail="LSTM model not loaded")

    features = []
    for h in hourly_data:
        features.append([
            h.get("temp_2m", 0), h.get("cloud_cover", 0),
            h.get("cloud_cover_low", 0), h.get("cloud_cover_mid", 0),
            h.get("cloud_cover_high", 0), h.get("precipitation", 0),
            h.get("relative_humidity", 0), h.get("shortwave_radiation", 0),
            h.get("dni", 0), h.get("diffuse_radiation", 0),
        ])

    X = np.array([features])
    predictions = lstm_model.predict(X, verbose=0)
    hourly_kwh = predictions[0].tolist()

    return {
        "date": date,
        "hourly_kwh": [round(v, 2) for v in hourly_kwh],
        "total_kwh": round(sum(hourly_kwh), 2),
    }


# ─────────────── TES Sizing Endpoints ───────────────

@app.post("/tes/sizing")
async def run_tes_sizing_endpoint(input_data: dict):
    """Run the full Ice TES sizing engine."""
    from app.tes_engine import TESInput, run_tes_sizing

    tes_input = TESInput(**input_data)
    result = run_tes_sizing(tes_input)
    return result.model_dump()


@app.get("/tes/sizing/for-date")
async def get_tes_for_date(date: str):
    """Fetch forecast + run TES sizing in one call."""
    from app.weather_adapter import fetch_and_prepare_daily
    from app.tes_engine import TESInput, run_tes_sizing

    # Get forecast
    try:
        features = fetch_and_prepare_daily(date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather fetch failed: {str(e)}")

    if not all([xgb_p10, xgb_p50, xgb_p90]):
        raise HTTPException(status_code=503, detail="XGBoost models not loaded")

    X = engineer_daily_features(features, date)
    p10 = float(xgb_p10.predict(X)[0])
    p50 = float(xgb_p50.predict(X)[0])
    p90 = float(xgb_p90.predict(X)[0])
    p10, p50, p90 = sorted([p10, p50, p90])

    # Run TES sizing
    tes_input = TESInput(
        date=date,
        p10_kwh=round(p10, 2),
        p50_kwh=round(p50, 2),
        p90_kwh=round(p90, 2),
    )
    tes_result = run_tes_sizing(tes_input)

    return {
        "forecast": {"p10_kwh": round(p10, 2), "p50_kwh": round(p50, 2), "p90_kwh": round(p90, 2)},
        "tes": tes_result.model_dump(),
    }


# ─────────────── Embedding Endpoint ───────────────

class EmbedRequest(BaseModel):
    text: str

class EmbedBatchRequest(BaseModel):
    texts: List[str]

# Lazy-load embedding model
_embedder = None

def get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model loaded")
    return _embedder


@app.post("/embed")
async def embed_text(req: EmbedRequest):
    """Embed a single text string using sentence-transformers."""
    model = get_embedder()
    embedding = model.encode([req.text])[0]
    return {"embedding": embedding.tolist(), "dimensions": len(embedding)}


@app.post("/embed/batch")
async def embed_batch(req: EmbedBatchRequest):
    """Embed multiple text strings."""
    model = get_embedder()
    embeddings = model.encode(req.texts)
    return {
        "embeddings": [e.tolist() for e in embeddings],
        "dimensions": embeddings.shape[1],
        "count": len(embeddings),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
