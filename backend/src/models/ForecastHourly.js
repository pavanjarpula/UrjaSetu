const mongoose = require("mongoose");

const forecastHourlySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  hourly_kwh: [{ type: Number }],
  total_kwh: { type: Number, required: true },
  actual_hourly_kwh: [{ type: Number, default: null }],
  created_at: { type: Date, default: Date.now },
});

forecastHourlySchema.index({ date: -1 });

module.exports = mongoose.model("ForecastHourly", forecastHourlySchema);
