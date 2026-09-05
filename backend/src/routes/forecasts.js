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

// Daily summary: LLM-generated synthesis of forecast + TES + tariff
router.get("/daily-summary", auth, async (req, res) => {
  try {
    const { date } = req.query;
    const { generateAnswer } = require("../services/llmProvider");

    // Fetch forecast
    let forecast = await ForecastDaily.findOne({ date: new Date(date) });
    if (!forecast) {
      try {
        const response = await axios.get(`${ML_SERVICE}/forecast/daily`, {
          params: { date },
          timeout: 30000,
        });
        forecast = {
          date: new Date(date),
          p10_kwh: response.data.forecast.p10_kwh,
          p50_kwh: response.data.forecast.p50_kwh,
          p90_kwh: response.data.forecast.p90_kwh,
        };
      } catch (e) {
        return res.status(500).json({ error: "Failed to fetch forecast" });
      }
    }

    // Fetch TES sizing
    let tes = null;
    try {
      const tesResponse = await axios.get(`${ML_SERVICE}/tes/sizing/for-date`, {
        params: { date },
        timeout: 30000,
      });
      tes = tesResponse.data.tes;
    } catch (e) {
      // TES may not be available
    }

    // Build context for LLM
    const context = [
      `Solar Forecast for ${date}: P10=${forecast.p10_kwh} kWh, P50=${forecast.p50_kwh} kWh, P90=${forecast.p90_kwh} kWh`,
      tes ? `Ice TES Sizing: ${tes.ice_mass_kg} kg ice, ${tes.coverage_pct}% night coverage, COP=${tes.cop_actual}` : "TES data not available",
      `Tariff: Grid import rate ₹8.5/kWh, Solar export rate ₹4.2/kWh (net metering differential ₹4.3/kWh)`,
      `Campus: IIT Kharagpur 5.5 MWp solar PV, 21 Halls of Residence, 8173 rooms`,
    ].join("\n");

    const prompt = `Generate a concise daily operations summary for the IIT Kharagpur Solar+Ice TES platform. Include:
1. Expected solar generation range
2. Ice storage readiness
3. Energy cost implication (import vs export)
4. One actionable recommendation

Keep it under 150 words, professional tone.`;

    const summary = await generateAnswer(prompt, context);

    res.json({
      date,
      summary,
      forecast: {
        p10_kwh: forecast.p10_kwh,
        p50_kwh: forecast.p50_kwh,
        p90_kwh: forecast.p90_kwh,
      },
      tes: tes ? {
        ice_mass_kg: tes.ice_mass_kg,
        coverage_pct: tes.coverage_pct,
        cop_actual: tes.cop_actual,
      } : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
