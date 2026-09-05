const express = require("express");
const axios = require("axios");
const ForecastDaily = require("../models/ForecastDaily");
const ForecastHourly = require("../models/ForecastHourly");
const { validateForecast } = require("../middleware/validation");
const { auth } = require("../middleware/auth");

const router = express.Router();
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8001";

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

// Get hourly forecast
router.get("/hourly", validateForecast, async (req, res) => {
  try {
    const { date } = req.query;

    let forecast = await ForecastHourly.findOne({ date: new Date(date) });
    if (forecast) {
      return res.json({ source: "cache", forecast });
    }

    const response = await axios.get(`${ML_SERVICE}/forecast/hourly`, {
      params: { date },
      timeout: 30000,
    });

    forecast = new ForecastHourly({
      date: new Date(date),
      hourly_kwh: response.data.hourly_kwh,
      total_kwh: response.data.total_kwh,
    });
    await forecast.save();

    res.json({ source: "live", forecast });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trailing forecast accuracy
router.get("/accuracy", auth, async (req, res) => {
  try {
    const { days = 14 } = req.query;

    const forecasts = await ForecastDaily.find({
      actual_kwh: { $ne: null },
    })
      .sort({ date: -1 })
      .limit(parseInt(days));

    const accuracy = forecasts.map((f) => {
      const error_pct = Math.abs(f.p50_kwh - f.actual_kwh) / f.actual_kwh * 100;
      return {
        date: f.date,
        predicted: f.p50_kwh,
        actual: f.actual_kwh,
        error_pct: Math.round(error_pct * 100) / 100,
      };
    });

    const avgMAPE =
      accuracy.reduce((sum, a) => sum + a.error_pct, 0) / accuracy.length || 0;

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
