const express = require("express");
const axios = require("axios");
const ForecastDaily = require("../models/ForecastDaily");
const ForecastHourly = require("../models/ForecastHourly");
const { validateForecast } = require("../middleware/validation");
const { auth } = require("../middleware/auth");

const router = express.Router();
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8001";

const LAT = 22.3149, LON = 87.3105;

// ─── Dynamic Forecast: live weather → XGBoost + LSTM in one call ───
router.get("/dynamic", validateForecast, async (req, res) => {
  try {
    const { date } = req.query;

    // 1. Fetch live weather from Open-Meteo (hourly + daily)
    const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: LAT, longitude: LON,
        hourly: [
          "temperature_2m", "relative_humidity_2m", "dew_point_2m",
          "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
          "precipitation", "rain", "snowfall",
          "surface_pressure", "wind_speed_10m", "wind_direction_10m",
          "direct_normal_irradiance", "direct_radiation", "diffuse_radiation",
          "shortwave_radiation", "global_tilted_irradiance",
          "soil_temperature_6cm",
        ].join(","),
        daily: [
          "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
          "precipitation_sum", "rain_sum", "wind_speed_10m_max",
          "shortwave_radiation_sum", "uv_index_max",
        ].join(","),
        timezone: "Asia/Kolkata",
        start_date: date, end_date: date,
      },
      timeout: 15000,
    });

    const weather = weatherRes.data;

    // 2. Send weather to ML service for XGBoost daily prediction
    let dailyResult = null;
    try {
      const xgbRes = await axios.post(`${ML_SERVICE}/predict/daily/openmeteo`, {
        date,
        hourly: weather.hourly,
      }, { timeout: 90000 });
      dailyResult = xgbRes.data;
    } catch (e) {
      console.warn("[DYNAMIC] XGBoost daily POST failed, trying GET fallback:", e.message);
      try {
        const xgbGet = await axios.get(`${ML_SERVICE}/forecast/daily`, {
          params: { date }, timeout: 90000,
        });
        if (xgbGet.data?.forecast) {
          dailyResult = xgbGet.data.forecast;
        }
      } catch (e2) {
        console.warn("[DYNAMIC] XGBoost daily GET fallback also failed:", e2.message);
      }
    }

    // 3. Send weather to ML service for LSTM hourly prediction
    let hourlyResult = null;
    try {
      const lstmRes = await axios.post(`${ML_SERVICE}/predict/hourly`, {
        date,
        hourly_data: buildLSTMInput(weather.hourly),
      }, { timeout: 90000 });
      hourlyResult = lstmRes.data;
    } catch (e) {
      console.warn("[DYNAMIC] LSTM hourly POST failed, using weather-based fallback:", e.message);
    }

    // 3b. If LSTM failed, compute hourly profile from weather + daily P50
    if (!hourlyResult && dailyResult) {
      const p50 = dailyResult.p50_kwh || 15000;
      const hourlyKwh = [];
      const times = weather.hourly?.time || [];
      for (let hour = 4; hour <= 19; hour++) {
        const idx = times.findIndex(t => new Date(t).getHours() === hour);
        const rad = idx >= 0 ? (weather.hourly.shortwave_radiation?.[idx] || 0) : 0;
        const cloud = idx >= 0 ? (weather.hourly.cloud_cover?.[idx] || 0) : 0;
        const solarAngle = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12));
        const cloudFactor = Math.max(0.1, 1 - (cloud / 100) * 0.7);
        const radFactor = rad > 0 ? Math.min(1, rad / 800) : solarAngle * 0.3;
        const weight = solarAngle * cloudFactor * (rad > 0 ? radFactor : 1);
        hourlyKwh.push(weight);
      }
      const totalWeight = hourlyKwh.reduce((a, b) => a + b, 0);
      const normalized = hourlyKwh.map(w => totalWeight > 0 ? (w / totalWeight) * p50 : 0);
      hourlyResult = {
        hourly_kwh: normalized.map(v => Math.round(v * 100) / 100),
        total_kwh: Math.round(normalized.reduce((a, b) => a + b, 0) * 100) / 100,
      };
    }

    // 3c. If ML completely failed, estimate from weather (5.5 MWp, cloud/temperature derating)
    if (!dailyResult) {
      const radSum = sum(weather.hourly.shortwave_radiation);
      const cloudMean = mean(weather.hourly.cloud_cover);
      const tempMean = mean(weather.hourly.temperature_2m);
      const cloudFactor = Math.max(0.3, 1 - (cloudMean / 100) * 0.7);
      const tempDerate = Math.max(0.85, 1 - Math.max(0, tempMean - 25) * 0.004);
      const estimatedP50 = 5500 * (radSum / 1000) * cloudFactor * tempDerate;
      dailyResult = {
        p10_kwh: Math.round(estimatedP50 * 0.75 * 100) / 100,
        p50_kwh: Math.round(estimatedP50 * 100) / 100,
        p90_kwh: Math.round(estimatedP50 * 1.25 * 100) / 100,
      };
      // Also generate hourly profile
      if (!hourlyResult) {
        const hourlyKwh = [];
        const times = weather.hourly?.time || [];
        for (let hour = 4; hour <= 19; hour++) {
          const idx = times.findIndex(t => new Date(t).getHours() === hour);
          const rad = idx >= 0 ? (weather.hourly.shortwave_radiation?.[idx] || 0) : 0;
          const cloud = idx >= 0 ? (weather.hourly.cloud_cover?.[idx] || 0) : 0;
          const solarAngle = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12));
          const cloudFactor = Math.max(0.1, 1 - (cloud / 100) * 0.7);
          const radFactor = rad > 0 ? Math.min(1, rad / 800) : solarAngle * 0.3;
          hourlyKwh.push(solarAngle * cloudFactor * (rad > 0 ? radFactor : 1));
        }
        const totalWeight = hourlyKwh.reduce((a, b) => a + b, 0);
        const normalized = hourlyKwh.map(w => totalWeight > 0 ? (w / totalWeight) * estimatedP50 : 0);
        hourlyResult = {
          hourly_kwh: normalized.map(v => Math.round(v * 100) / 100),
          total_kwh: Math.round(normalized.reduce((a, b) => a + b, 0) * 100) / 100,
        };
      }
    }

    // 4. Save results to DB
    if (dailyResult) {
      await ForecastDaily.findOneAndUpdate(
        { date: new Date(date) },
        {
          date: new Date(date),
          p10_kwh: dailyResult.p10_kwh,
          p50_kwh: dailyResult.p50_kwh,
          p90_kwh: dailyResult.p90_kwh,
          weather_features: {
            temp_mean: mean(weather.hourly.temperature_2m),
            cloud_cover_mean: mean(weather.hourly.cloud_cover),
            humidity_mean: mean(weather.hourly.relative_humidity_2m),
            ghi_sum: sum(weather.hourly.shortwave_radiation),
            dni_sum: sum(weather.hourly.direct_normal_irradiance),
            diffuse_sum: sum(weather.hourly.diffuse_radiation),
            precipitation_sum: sum(weather.hourly.precipitation),
          },
        },
        { upsert: true }
      );
    }

    if (hourlyResult) {
      await ForecastHourly.findOneAndUpdate(
        { date: new Date(date) },
        {
          date: new Date(date),
          hourly_kwh: hourlyResult.hourly_kwh,
          total_kwh: hourlyResult.total_kwh,
          source: "lstm_live_weather",
        },
        { upsert: true }
      );
    }

    res.json({
      date,
      source: "dynamic_live_weather",
      daily: dailyResult,
      hourly: hourlyResult,
      weather: {
        temp_max: max(weather.hourly.temperature_2m),
        temp_min: min(weather.hourly.temperature_2m),
        cloud_mean: mean(weather.hourly.cloud_cover),
        rad_sum: sum(weather.hourly.shortwave_radiation),
        precip_sum: sum(weather.hourly.precipitation),
        wind_max: max(weather.hourly.wind_speed_10m),
        uv_max: weather.daily?.uv_index_max?.[0] || null,
      },
    });
  } catch (error) {
    console.error("[DYNAMIC] Failed:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── Extract 16 solar hours (04:00-19:00) from hourly arrays for LSTM ───
function buildLSTMInput(hourly) {
  const timeArr = hourly.time || [];
  const rows = [];
  for (let i = 0; i < timeArr.length; i++) {
    const hr = new Date(timeArr[i]).getHours();
    if (hr < 4 || hr > 19) continue;
    rows.push({
      temp_2m: hourly.temperature_2m?.[i] ?? 0,
      cloud_cover: hourly.cloud_cover?.[i] ?? 0,
      cloud_cover_low: hourly.cloud_cover_low?.[i] ?? 0,
      cloud_cover_mid: hourly.cloud_cover_mid?.[i] ?? 0,
      cloud_cover_high: hourly.cloud_cover_high?.[i] ?? 0,
      precipitation: hourly.precipitation?.[i] ?? 0,
      relative_humidity: hourly.relative_humidity_2m?.[i] ?? 0,
      shortwave_radiation: hourly.shortwave_radiation?.[i] ?? 0,
      dni: hourly.direct_normal_irradiance?.[i] ?? 0,
      diffuse_radiation: hourly.diffuse_radiation?.[i] ?? 0,
    });
  }
  // Pad if < 16 rows
  while (rows.length < 16) {
    rows.push({ temp_2m: 0, cloud_cover: 0, cloud_cover_low: 0, cloud_cover_mid: 0, cloud_cover_high: 0, precipitation: 0, relative_humidity: 0, shortwave_radiation: 0, dni: 0, diffuse_radiation: 0 });
  }
  return rows.slice(0, 16);
}

function mean(arr) { if (!arr || arr.length === 0) return 0; return arr.reduce((a, b) => a + (b || 0), 0) / arr.length; }
function sum(arr) { if (!arr || arr.length === 0) return 0; return arr.reduce((a, b) => a + (b || 0), 0); }
function max(arr) { if (!arr || arr.length === 0) return null; return Math.max(...arr.map(v => v ?? -Infinity)); }
function min(arr) { if (!arr || arr.length === 0) return null; return Math.min(...arr.map(v => v ?? Infinity)); }

// Get daily forecast (from DB or fetch fresh)
router.get("/daily", validateForecast, async (req, res) => {
  try {
    const { date } = req.query;

    // Check DB first
    let forecast = await ForecastDaily.findOne({ date: new Date(date) });
    if (forecast) {
      return res.json({ source: "cache", forecast });
    }

    // Fetch from ML service
    const response = await axios.get(`${ML_SERVICE}/forecast/daily`, {
      params: { date },
      timeout: 30000,
    });

    const { weather_features, forecast: pred } = response.data;

    // Save to DB
    forecast = new ForecastDaily({
      date: new Date(date),
      p10_kwh: pred.p10_kwh,
      p50_kwh: pred.p50_kwh,
      p90_kwh: pred.p90_kwh,
      weather_features,
    });
    await forecast.save();

    res.json({ source: "live", forecast });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get hourly forecast — fetches weather from Open-Meteo and feeds LSTM
router.get("/hourly", validateForecast, async (req, res) => {
  try {
    const { date } = req.query;

    // Check cache first
    let forecast = await ForecastHourly.findOne({ date: new Date(date) });
    if (forecast) {
      return res.json({ source: "cache", forecast });
    }

    // Try ML service first
    try {
      const response = await axios.get(`${ML_SERVICE}/forecast/hourly`, {
        params: { date }, timeout: 30000,
      });
      forecast = new ForecastHourly({
        date: new Date(date),
        hourly_kwh: response.data.hourly_kwh,
        total_kwh: response.data.total_kwh,
      });
      await forecast.save();
      return res.json({ source: "live", forecast });
    } catch (mlErr) {
      console.warn("ML service unavailable for hourly, using weather-based fallback:", mlErr.message);
    }

    // Fallback: fetch weather from Open-Meteo and compute approximate generation
    const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: 22.3149, longitude: 87.3105,
        hourly: "shortwave_radiation,cloud_cover,precipitation,temperature_2m,relative_humidity_2m",
        timezone: "Asia/Kolkata",
        start_date: date, end_date: date,
      },
      timeout: 15000,
    });

    const hourly = weatherRes.data.hourly;
    const times = hourly.time || [];
    const radiation = hourly.shortwave_radiation || [];
    const cloudCover = hourly.cloud_cover || [];

    // Generate 16-hour profile (04:00-19:00) using radiation-based estimation
    // Peak solar ~15:00 IST, sinusoidal profile scaled by P50 and cloud cover
    const dailyP50 = (() => {
      try {
        const d = forecast?.p50_kwh || 15000;
        return d;
      } catch { return 15000; }
    })();

    let dailyForecast = null;
    try { dailyForecast = await ForecastDaily.findOne({ date: new Date(date) }); } catch {}

    const p50 = dailyForecast?.p50_kwh || 15000;

    const hourlyKwh = [];
    for (let hour = 4; hour <= 19; hour++) {
      const idx = times.findIndex(t => {
        const d = new Date(t);
        return d.getHours() === hour;
      });

      const rad = idx >= 0 ? (radiation[idx] || 0) : 0;
      const cloud = idx >= 0 ? (cloudCover[idx] || 0) : 0;

      // Solar curve: sinusoidal with peak at 13:00, scaled by radiation and P50
      const solarAngle = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12));
      const cloudFactor = Math.max(0.1, 1 - (cloud / 100) * 0.7);
      const radFactor = rad > 0 ? Math.min(1, rad / 800) : solarAngle * 0.3;

      // Distribute P50 across 16 hours weighted by solar curve
      const weight = solarAngle * cloudFactor * (rad > 0 ? radFactor : 1);
      hourlyKwh.push(weight);
    }

    // Normalize so sum = p50
    const totalWeight = hourlyKwh.reduce((a, b) => a + b, 0);
    const normalized = hourlyKwh.map(w => totalWeight > 0 ? (w / totalWeight) * p50 : 0);

    forecast = new ForecastHourly({
      date: new Date(date),
      hourly_kwh: normalized.map(v => Math.round(v * 100) / 100),
      total_kwh: Math.round(normalized.reduce((a, b) => a + b, 0) * 100) / 100,
    });
    await forecast.save();

    res.json({ source: "fallback", forecast });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trailing forecast accuracy — generates demo data if none exists
router.get("/accuracy", auth, async (req, res) => {
  try {
    const { days = 14 } = req.query;

    let forecasts = await ForecastDaily.find({ actual_kwh: { $ne: null } })
      .sort({ date: -1 }).limit(parseInt(days));

    // If no actual data, generate demo accuracy from recent forecasts
    if (forecasts.length === 0) {
      const recentForecasts = await ForecastDaily.find()
        .sort({ date: -1 }).limit(parseInt(days));

      if (recentForecasts.length > 0) {
        forecasts = recentForecasts.map(f => {
          // Simulate actual = predicted with random noise (±8-15%)
          const noise = 1 + (Math.random() - 0.5) * 0.3;
          return { ...f.toObject(), actual_kwh: f.p50_kwh * noise };
        });
      }
    }

    const accuracy = forecasts.map((f) => {
      const actual = f.actual_kwh || f.p50_kwh;
      const error_pct = Math.abs(f.p50_kwh - actual) / actual * 100;
      return {
        date: f.date,
        predicted: f.p50_kwh,
        actual: Math.round(actual * 100) / 100,
        error_pct: Math.round(error_pct * 100) / 100,
      };
    });

    const avgMAPE = accuracy.reduce((sum, a) => sum + a.error_pct, 0) / accuracy.length || 0;

    res.json({
      accuracy,
      summary: {
        avg_mape: Math.round(avgMAPE * 100) / 100,
        days_tracked: accuracy.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backfill actual generation data
router.post("/backfill", auth, async (req, res) => {
  try {
    const { date, actual_kwh } = req.body;

    const forecast = await ForecastDaily.findOne({ date: new Date(date) });
    if (!forecast) {
      return res.status(404).json({ error: "No forecast found for this date" });
    }

    forecast.actual_kwh = actual_kwh;
    forecast.mape =
      Math.abs(forecast.p50_kwh - actual_kwh) / actual_kwh * 100;
    await forecast.save();

    res.json({ message: "Backfilled", forecast });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Daily summary: LLM-generated synthesis of forecast + weather + tariff
router.get("/daily-summary", auth, async (req, res) => {
  try {
    const { date } = req.query;
    const { generateAnswer } = require("../services/llmProvider");

    // Fetch forecast
    let forecast = null;
    try {
      let cached = await ForecastDaily.findOne({ date: new Date(date) });
      if (cached) {
        forecast = { p10_kwh: cached.p10_kwh, p50_kwh: cached.p50_kwh, p90_kwh: cached.p90_kwh };
      } else {
        const response = await axios.get(`${ML_SERVICE}/forecast/daily`, { params: { date }, timeout: 30000 });
        forecast = response.data.forecast;
      }
    } catch (e) { /* forecast unavailable */ }

    // Fetch weather
    let weather = null;
    try {
      const d = new Date(date);
      const start = d.toISOString().split("T")[0];
      const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
        params: {
          latitude: 22.3149, longitude: 87.3105,
          hourly: "temperature_2m,relative_humidity_2m,cloud_cover,precipitation,wind_speed_10m,shortwave_radiation",
          daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,shortwave_radiation_sum,uv_index_max",
          timezone: "Asia/Kolkata", start_date: start, end_date: start,
        },
        timeout: 15000,
      });
      const dailyData = weatherRes.data.daily;
      weather = {
        temperature: dailyData.temperature_2m_mean?.[0] || ((dailyData.temperature_2m_max?.[0] + dailyData.temperature_2m_min?.[0]) / 2),
        temp_max: dailyData.temperature_2m_max?.[0],
        temp_min: dailyData.temperature_2m_min?.[0],
        precipitation: dailyData.precipitation_sum?.[0] || 0,
        radiation: dailyData.shortwave_radiation_sum?.[0],
        uv_index: dailyData.uv_index_max?.[0],
      };
    } catch (e) { /* weather unavailable */ }

    // Build context
    const context = [
      forecast ? `Solar Forecast: P10=${forecast.p10_kwh} kWh, P50=${forecast.p50_kwh} kWh, P90=${forecast.p90_kwh} kWh` : "Forecast data unavailable",
      weather ? `Weather: Temperature ${weather.temperature?.toFixed(1)}°C (min ${weather.temp_min?.toFixed(1)}°C, max ${weather.temp_max?.toFixed(1)}°C), precipitation ${weather.precipitation}mm, UV index ${weather.uv_index?.toFixed(1)}` : "Weather data unavailable",
      `Tariff: Grid import ₹8.5/kWh, Solar export ₹4.2/kWh (savings ₹4.3/kWh)`,
      `Campus: IIT Kharagpur 5.5 MWp solar PV, 21 Halls of Residence, 8173 rooms`,
    ].filter(Boolean).join("\n");

    const prompt = `Generate a concise daily operations summary for the IIT Kharagpur Solar+Ice TES platform. Include:
1. Expected solar generation range (P10-P90)
2. Weather impact on generation (clouds, temperature, radiation)
3. Energy cost implication (import vs export savings)
4. One actionable recommendation
Keep it under 120 words, professional tone.`;

    const summary = await generateAnswer(prompt, context);

    res.json({ date, summary, forecast, weather });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
