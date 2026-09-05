const mongoose = require("mongoose");

const forecastDailySchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  p10_kwh: { type: Number, required: true },
  p50_kwh: { type: Number, required: true },
  p90_kwh: { type: Number, required: true },
  actual_kwh: { type: Number, default: null },
  weather_features: {
    temp_mean: Number,
    temp_max: Number,
    temp_min: Number,
    cloud_cover_mean: Number,
    humidity_mean: Number,
    ghi_sum: Number,
    dni_sum: Number,
    diffuse_sum: Number,
    precipitation_sum: Number,
  },
  mape: { type: Number, default: null },
  created_at: { type: Date, default: Date.now },
});

forecastDailySchema.index({ date: -1 });

module.exports = mongoose.model("ForecastDaily", forecastDailySchema);
