const express = require("express");
const Telemetry = require("../models/Telemetry");
const { auth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Get latest telemetry readings
router.get("/latest", async (req, res) => {
  try {
    const { hall_id, limit = 100 } = req.query;

    const filter = {};
    if (hall_id) filter.hall_id = hall_id;

    const readings = await Telemetry.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ readings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get telemetry history
router.get("/history", async (req, res) => {
  try {
    const { hall_id, start, end, metric, limit = 500 } = req.query;

    const filter = {};
    if (hall_id) filter.hall_id = hall_id;
    if (start || end) {
      filter.timestamp = {};
      if (start) filter.timestamp.$gte = new Date(start);
      if (end) filter.timestamp.$lte = new Date(end);
    }

    const readings = await Telemetry.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ readings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ingest telemetry (for future sensor data)
router.post("/ingest", auth, async (req, res) => {
  try {
    const reading = new Telemetry({
      timestamp: new Date(),
      source: req.body.source || "simulated",
      ...req.body,
    });
    await reading.save();
    res.status(201).json({ message: "Telemetry ingested", reading });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate simulated telemetry data
router.post("/simulate", auth, requireAdmin, async (req, res) => {
  try {
    const { date, hours = 24 } = req.body;

    const readings = [];
    const baseDate = new Date(date);

    for (let h = 0; h < hours; h++) {
      const timestamp = new Date(baseDate);
      timestamp.setHours(h, 0, 0, 0);

      const isNight = h < 6 || h >= 20;
      const isCharging = h >= 8 && h <= 17;

      // Determine ice tank state based on time of day
      let ice_tank_state;
      if (h >= 8 && h <= 12) {
        ice_tank_state = "charging";
      } else if (h >= 13 && h <= 15) {
        ice_tank_state = "crystallization";
      } else if (h >= 16 && h <= 17) {
        ice_tank_state = "fully_charged";
      } else if (h >= 20 || h < 6) {
        ice_tank_state = "discharging";
      } else {
        ice_tank_state = "melted";
      }

      const reading = {
        timestamp,
        source: "simulated",
        chiller_power_kw: isCharging ? 200 + Math.random() * 100 : 50 + Math.random() * 30,
        evaporator_temp_c: -8 + Math.random() * 2,
        ice_tank_level_pct: isCharging ? 30 + (h - 8) * 7 : Math.max(10, 90 - (h - 20) * 8),
        ice_tank_state,
        condenser_inlet_temp_c: 30 + Math.random() * 8,
        chilled_water_supply_temp_c: 6 + Math.random() * 1,
        chilled_water_return_temp_c: 12 + Math.random() * 2,
      };

      readings.push(reading);
    }

    await Telemetry.insertMany(readings);
    res.json({ message: `Generated ${readings.length} simulated readings`, count: readings.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
