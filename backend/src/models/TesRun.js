const mongoose = require("mongoose");

const tesRunSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  forecast_used: {
    p10_kwh: Number,
    p50_kwh: Number,
    p90_kwh: Number,
  },
  ice_mass_kg: { type: Number, required: true },
  ice_volume_m3: { type: Number, required: true },
  coverage_pct: { type: Number, required: true },
  cop_carnot: { type: Number, required: true },
  cop_actual: { type: Number, required: true },
  effective_cop: { type: Number, required: true },
  slr: { type: Number, required: true },
  total_generation_kwh: { type: Number, required: true },
  cooling_energy_required_kwh: { type: Number, required: true },
  excess_energy_kwh: { type: Number, required: true },
  charging_window: { type: String, required: true },
  charging_hours: { type: Number, required: true },
  thermal_lag_minutes: { type: Number, default: 37.5 },
  discharge_schedule: [{
    hall_id: String,
    tier: String,
    num_rooms: Number,
    ice_allocation_kg: Number,
    discharge_kwh: Number,
    start_time: String,
    end_time: String,
  }],
  tier_summary: {
    Large: { halls: Number, rooms: Number, ice_kg: Number, discharge_kwh: Number },
    Medium: { halls: Number, rooms: Number, ice_kg: Number, discharge_kwh: Number },
    Small: { halls: Number, rooms: Number, ice_kg: Number, discharge_kwh: Number },
  },
  created_at: { type: Date, default: Date.now },
});

tesRunSchema.index({ date: -1 });

module.exports = mongoose.model("TesRun", tesRunSchema);
