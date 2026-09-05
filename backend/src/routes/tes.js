const express = require("express");
const axios = require("axios");
const TesRun = require("../models/TesRun");
const ForecastDaily = require("../models/ForecastDaily");
const { auth } = require("../middleware/auth");

const router = express.Router();
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8001";

// Get TES sizing for a date
router.get("/sizing", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "Date parameter required" });
    }

    // Check DB first
    let tesRun = await TesRun.findOne({ date: new Date(date) });
    if (tesRun) {
      return res.json({ source: "cache", tes: tesRun });
    }

    // Get from ML service (forecast + TES sizing combined)
    const response = await axios.get(`${ML_SERVICE}/tes/sizing/for-date`, {
      params: { date },
      timeout: 30000,
    });

    const { forecast, tes } = response.data;

    // Save forecast if not cached
    await ForecastDaily.findOneAndUpdate(
      { date: new Date(date) },
      {
        $setOnInsert: {
          date: new Date(date),
          p10_kwh: forecast.p10_kwh,
          p50_kwh: forecast.p50_kwh,
          p90_kwh: forecast.p90_kwh,
        },
      },
      { upsert: true }
    );

    // Save TES run
    tesRun = new TesRun({
      date: new Date(date),
      forecast_used: forecast,
      ice_mass_kg: tes.ice_mass_kg,
      ice_volume_m3: tes.ice_volume_m3,
      coverage_pct: tes.coverage_pct,
      cop_carnot: tes.cop_carnot,
      cop_actual: tes.cop_actual,
      effective_cop: tes.effective_cop,
      slr: tes.slr,
      total_generation_kwh: tes.total_generation_kwh,
      cooling_energy_required_kwh: tes.cooling_energy_required_kwh,
      excess_energy_kwh: tes.excess_energy_kwh,
      charging_window: tes.charging_window,
      charging_hours: tes.charging_hours,
      thermal_lag_minutes: tes.thermal_lag_minutes,
      discharge_schedule: tes.discharge_schedule,
      tier_summary: tes.tier_summary,
    });
    await tesRun.save();

    res.json({ source: "live", tes: tesRun });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent TES runs
router.get("/recent", async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const runs = await TesRun.find()
      .sort({ date: -1 })
      .limit(parseInt(days));

    const coverageTrend = runs.map((r) => ({
      date: r.date,
      coverage_pct: r.coverage_pct,
      ice_mass_kg: r.ice_mass_kg,
      ice_volume_m3: r.ice_volume_m3,
    }));

    res.json({ runs, coverageTrend });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get discharge schedule for a specific date
router.get("/discharge/:date", async (req, res) => {
  try {
    const tesRun = await TesRun.findOne({ date: new Date(req.params.date) });
    if (!tesRun) {
      return res.status(404).json({ error: "No TES run found for this date" });
    }

    res.json({
      date: tesRun.date,
      discharge_schedule: tesRun.discharge_schedule,
      tier_summary: tesRun.tier_summary,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
