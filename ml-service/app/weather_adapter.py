"""
Open-Meteo Weather Adapter
Maps forecast API fields to training feature names and aggregates hourly → daily.

CRITICAL: Open-Meteo forecast API uses different field names than the historical/reanalysis
API used for training. This adapter explicitly maps them to avoid silent mismatches.

Forecast API fields → Training columns:
  temperature_2m         → temp_2m
  relative_humidity_2m   → relative_humidity
  direct_normal_irradiance → dni
  shortwave_radiation    → shortwave_radiation
  diffuse_radiation      → diffuse_radiation
  cloud_cover            → cloud_cover
  cloud_cover_low        → cloud_cover_low
  cloud_cover_mid        → cloud_cover_mid
  cloud_cover_high       → cloud_cover_high
  precipitation          → precipitation
"""

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional

# IIT Kharagpur coordinates
LATITUDE = 22.3149
LONGITUDE = 87.3105

# Explicit mapping: forecast API field → training column name
FORECAST_TO_TRAINING = {
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

HOURLY_PARAMS = ",".join(FORECAST_TO_TRAINING.keys())


def fetch_forecast(target_date: str, forecast_days: int = 2) -> dict:
    """Fetch day-ahead forecast from Open-Meteo.

    Args:
        target_date: Date string YYYY-MM-DD
        forecast_days: Number of days to fetch (default 2 to cover day-ahead)

    Returns:
        Raw API response dict with 'hourly' key
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "hourly": HOURLY_PARAMS,
        "forecast_days": forecast_days,
        "timezone": "Asia/Kolkata",
    }

    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def map_forecast_fields(hourly_data: dict) -> dict:
    """Map forecast API field names to training column names.

    Returns a dict with training column names as keys.
    """
    mapped = {}
    for forecast_key, training_key in FORECAST_TO_TRAINING.items():
        if forecast_key in hourly_data:
            mapped[training_key] = hourly_data[forecast_key]
    return mapped


def hourly_to_daily_features(hourly_mapped: dict, target_date: str) -> dict:
    """Aggregate mapped hourly data to daily feature vector for XGBoost.

    Args:
        hourly_mapped: Dict of training column names → hourly value lists
        target_date: The target date string YYYY-MM-DD

    Returns:
        Dict of daily features matching the 25-feature XGBoost input
    """
    df = pd.DataFrame(hourly_mapped)

    # Filter to target date (IST)
    df["datetime"] = pd.to_datetime(hourly_data.get("time", []))
    target_dt = pd.Timestamp(target_date)
    day_mask = df["datetime"].dt.date == target_dt.date()
    day_df = df[day_mask]

    if day_df.empty:
        raise ValueError(f"No hourly data found for {target_date}")

    # Compute daily aggregates matching training feature names
    features = {
        "temp_mean": day_df["temp_2m"].mean(),
        "temp_max": day_df["temp_2m"].max(),
        "temp_min": day_df["temp_2m"].min(),
        "cloud_cover_mean": day_df["cloud_cover"].mean(),
        "humidity_mean": day_df["relative_humidity"].mean(),
        "ghi_sum": day_df["shortwave_radiation"].sum(),
        "dni_sum": day_df["dni"].sum(),
        "diffuse_sum": day_df["diffuse_radiation"].sum(),
        "precipitation_sum": day_df["precipitation"].sum(),
    }

    return features


def fetch_and_prepare_daily(target_date: str) -> dict:
    """Full pipeline: fetch forecast → map fields → aggregate to daily features.

    Returns a dict ready to be passed to the ML service's /predict/daily endpoint.
    """
    raw = fetch_forecast(target_date)
    hourly = raw.get("hourly", {})

    mapped = map_forecast_fields(hourly)

    # Build a proper time index
    times = pd.to_datetime(hourly.get("time", []))
    mapped["time"] = times

    df = pd.DataFrame(mapped)
    target_dt = pd.Timestamp(target_date)
    day_mask = df["time"].dt.date == target_dt.date()
    day_df = df[day_mask]

    if day_df.empty:
        raise ValueError(f"No hourly data for {target_date} in forecast response")

    features = {
        "date": target_date,
        "temp_mean": round(float(day_df["temp_2m"].mean()), 2),
        "temp_max": round(float(day_df["temp_2m"].max()), 2),
        "temp_min": round(float(day_df["temp_2m"].min()), 2),
        "cloud_cover_mean": round(float(day_df["cloud_cover"].mean()), 2),
        "humidity_mean": round(float(day_df["relative_humidity"].mean()), 2),
        "ghi_sum": round(float(day_df["shortwave_radiation"].sum()), 2),
        "dni_sum": round(float(day_df["dni"].sum()), 2),
        "diffuse_sum": round(float(day_df["diffuse_radiation"].sum()), 2),
        "precipitation_sum": round(float(day_df["precipitation"].sum()), 2),
    }

    return features


def fetch_and_prepare_hourly(target_date: str) -> list:
    """Fetch forecast and return 16 hourly records (04:00-19:00) for LSTM input.

    Returns a list of 16 dicts, each with training column names as keys.
    """
    raw = fetch_forecast(target_date)
    hourly = raw.get("hourly", {})

    mapped = map_forecast_fields(hourly)
    times = pd.to_datetime(hourly.get("time", []))

    df = pd.DataFrame(mapped)
    df["time"] = times

    target_dt = pd.Timestamp(target_date)
    day_mask = df["time"].dt.date == target_dt.date()
    day_df = df[day_mask].copy()

    # Filter to 04:00-19:00 (16 hours)
    hour_mask = (day_df["time"].dt.hour >= 4) & (day_df["time"].dt.hour <= 19)
    forecast_df = day_df[hour_mask]

    if len(forecast_df) < 16:
        # Pad with zeros if not enough hours
        while len(forecast_df) < 16:
            forecast_df = pd.concat([forecast_df, pd.DataFrame([{}])], ignore_index=True)

    records = []
    for _, row in forecast_df.head(16).iterrows():
        records.append({
            "temp_2m": float(row.get("temp_2m", 0) or 0),
            "cloud_cover": float(row.get("cloud_cover", 0) or 0),
            "cloud_cover_low": float(row.get("cloud_cover_low", 0) or 0),
            "cloud_cover_mid": float(row.get("cloud_cover_mid", 0) or 0),
            "cloud_cover_high": float(row.get("cloud_cover_high", 0) or 0),
            "precipitation": float(row.get("precipitation", 0) or 0),
            "relative_humidity": float(row.get("relative_humidity", 0) or 0),
            "shortwave_radiation": float(row.get("shortwave_radiation", 0) or 0),
            "dni": float(row.get("dni", 0) or 0),
            "diffuse_radiation": float(row.get("diffuse_radiation", 0) or 0),
        })

    return records
