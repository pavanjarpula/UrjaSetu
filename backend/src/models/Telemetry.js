const mongoose = require("mongoose");

const telemetrySchema = new mongoose.Schema({
  timestamp: { type: Date, required: true },
  source: { type: String, enum: ["simulated", "sensor"], default: "simulated" },
  chiller_power_kw: { type: Number, default: null },
  evaporator_temp_c: { type: Number, default: null },
  ice_tank_level_pct: { type: Number, default: null },
  ice_tank_state: {
    type: String,
    enum: ["charging", "crystallization", "fully_charged", "discharging", "melted"],
    default: null,
  },
  condenser_inlet_temp_c: { type: Number, default: null },
  hall_id: { type: String, default: null },
  chilled_water_supply_temp_c: { type: Number, default: null },
  chilled_water_return_temp_c: { type: Number, default: null },
});

telemetrySchema.index({ timestamp: -1 });
telemetrySchema.index({ hall_id: 1, timestamp: -1 });

module.exports = mongoose.model("Telemetry", telemetrySchema);
