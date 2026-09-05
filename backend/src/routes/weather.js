const express = require("express");
const axios = require("axios");
const { auth } = require("../middleware/auth");

const router = express.Router();

const LAT = 22.3149;
const LON = 87.3105;

router.get("/", auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date parameter required" });

    const d = new Date(date);
    const start = d.toISOString().split("T")[0];
    const end = start;

    const response = await axios.get("https://api.open-meteo.com/v1/forecast", {
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
        start_date: start,
        end_date: end,
      },
      timeout: 15000,
    });

    res.json({
      date,
      hourly: response.data.hourly,
      daily: response.data.daily,
      latitude: LAT, longitude: LON,
      timezone: response.data.timezone,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
