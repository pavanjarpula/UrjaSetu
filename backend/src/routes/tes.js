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
    let forecast, tes;
    try {
      const response = await axios.get(`${ML_SERVICE}/tes/sizing/for-date`, {
        params: { date },
        timeout: 90000,
      });
      forecast = response.data.forecast;
      tes = response.data.tes;
    } catch (mlErr) {
      console.warn("[TES] ML service unavailable, using weather-based estimate:", mlErr.message);

      // Fallback: estimate from weather
      const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
        params: {
          latitude: 22.3149, longitude: 87.3105,
          daily: "shortwave_radiation_sum,temperature_2m_max,temperature_2m_min",
          timezone: "Asia/Kolkata", start_date: date, end_date: date,
        },
        timeout: 15000,
      });
      const wd = weatherRes.data.daily;
      const radSum = wd.shortwave_radiation_sum?.[0] || 4000;
      const tempMax = wd.temperature_2m_max?.[0] || 33;
      const cloudFactor = Math.max(0.3, 1 - (radSum / 8000) * 0.3);
      const tempDerate = Math.max(0.85, 1 - Math.max(0, tempMax - 25) * 0.004);
      const p50 = Math.round(5500 * (radSum / 1000) * cloudFactor * tempDerate * 100) / 100;
      forecast = { p10_kwh: Math.round(p50 * 0.75 * 100) / 100, p50_kwh: p50, p90_kwh: Math.round(p50 * 1.25 * 100) / 100 };

      const excessEnergy = p50 * 0.35;
      const iceMassKg = Math.round(excessEnergy / 0.107 * 100) / 100;
      const iceVolumeM3 = Math.round(iceMassKg / 917 * 1000) / 1000;
      const coolingRequired = Math.round(p50 * 0.45 * 100) / 100;
      const coveragePct = Math.min(100, Math.round(excessEnergy / coolingRequired * 10000) / 100);

      const HALLS = [
        { id: "B R Ambedkar Hall", tier: "Large", rooms: 1392 },
        { id: "Lalbahadur Sastry Hall", tier: "Large", rooms: 1300 },
        { id: "Madan Mohan Malviya Hall", tier: "Large", rooms: 1180 },
        { id: "Patel Hall", tier: "Large", rooms: 1050 },
        { id: "Lala Lajpat Rai Hall", tier: "Large", rooms: 900 },
        { id: "Azad Hall", tier: "Medium", rooms: 590 },
        { id: "JC Bose Hall", tier: "Medium", rooms: 520 },
        { id: "Nehru Hall", tier: "Medium", rooms: 490 },
        { id: "Rajendra Prasad Hall", tier: "Medium", rooms: 460 },
        { id: "Vidyasagar Hall", tier: "Medium", rooms: 440 },
        { id: "Megnad Saha Hall", tier: "Medium", rooms: 420 },
        { id: "BC Roy Hall", tier: "Medium", rooms: 400 },
        { id: "Radha Krishnan Hall", tier: "Medium", rooms: 380 },
        { id: "Homi Bhabha Hall", tier: "Small", rooms: 330 },
        { id: "Sir Ashutosh Mukherjee Hall", tier: "Small", rooms: 300 },
        { id: "Gokhale Hall", tier: "Small", rooms: 260 },
        { id: "Sarojini Naidu Hall", tier: "Small", rooms: 250 },
        { id: "Mother Teresa Hall", tier: "Small", rooms: 240 },
        { id: "Zakir Hussain Hall", tier: "Small", rooms: 220 },
        { id: "Rani Laxmibai Hall", tier: "Small", rooms: 200 },
        { id: "Sister Nivedita Hall", tier: "Small", rooms: 183 },
      ];
      const totalRooms = HALLS.reduce((s, h) => s + h.rooms, 0);
      const dischargeSchedule = HALLS.map(h => {
        const share = h.rooms / totalRooms;
        return {
          hall_id: h.id, tier: h.tier, num_rooms: h.rooms,
          ice_allocation_kg: Math.round(iceMassKg * share * 100) / 100,
          discharge_kwh: Math.round(excessEnergy * share * 100) / 100,
          start_time: "20:00", end_time: "06:00",
        };
      });

      tes = {
        ice_mass_kg: iceMassKg, ice_volume_m3: iceVolumeM3,
        coverage_pct: coveragePct, cop_carnot: 12.5, cop_actual: 2.8, effective_cop: 2.5,
        slr: 0.45, total_generation_kwh: p50, cooling_energy_required_kwh: coolingRequired,
        excess_energy_kwh: excessEnergy, charging_window: "11:00-17:00", charging_hours: 6,
        thermal_lag_minutes: 37.5, discharge_schedule: dischargeSchedule,
        tier_summary: {
          Large: { ice_kg: Math.round(iceMassKg * 0.55 * 100) / 100, discharge_kwh: Math.round(excessEnergy * 0.55 * 100) / 100, rooms: 5822 },
          Medium: { ice_kg: Math.round(iceMassKg * 0.3 * 100) / 100, discharge_kwh: Math.round(excessEnergy * 0.3 * 100) / 100, rooms: 3700 },
          Small: { ice_kg: Math.round(iceMassKg * 0.15 * 100) / 100, discharge_kwh: Math.round(excessEnergy * 0.15 * 100) / 100, rooms: 2306 },
        },
      };
    }

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
