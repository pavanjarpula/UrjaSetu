import React from "react";

const TARIFF_DATA = {
  import_rate: 8.5,
  export_rate: 4.2,
  currency: "INR",
  unit: "per kWh",
  source: "WBSEDCL Net Metering Tariff 2024-25",
  notes: [
    "Grid import rate applies when solar generation is insufficient",
    "Solar export rate applies under net metering for surplus generation",
    "Differential of ₹4.3/kWh represents savings from solar self-consumption",
    "Tariff subject to annual revision by West Bengal State Electricity Distribution Co.",
  ],
  monthly_rates: [
    { month: "Jan", import: 8.5, export: 4.2 },
    { month: "Feb", import: 8.5, export: 4.2 },
    { month: "Mar", import: 8.5, export: 4.2 },
    { month: "Apr", import: 8.5, export: 4.2 },
    { month: "May", import: 8.5, export: 4.2 },
    { month: "Jun", import: 8.5, export: 4.2 },
    { month: "Jul", import: 8.5, export: 4.2 },
    { month: "Aug", import: 8.5, export: 4.2 },
    { month: "Sep", import: 8.5, export: 4.2 },
    { month: "Oct", import: 8.5, export: 4.2 },
    { month: "Nov", import: 8.5, export: 4.2 },
    { month: "Dec", import: 8.5, export: 4.2 },
  ],
};

export default function TariffPanel({ dailyForecast }) {
  const differential = TARIFF_DATA.import_rate - TARIFF_DATA.export_rate;
  const selfConsumptionValue = dailyForecast?.p50_kwh
    ? (dailyForecast.p50_kwh * differential).toFixed(0)
    : null;

  return (
    <div className="card tariff-card">
      <div className="card-header">
        <h3>Tariff & Economics</h3>
        <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
          {TARIFF_DATA.source}
        </span>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="kpi-card" style={{ textAlign: "center" }}>
          <div className="value" style={{ color: "var(--accent-red)", fontSize: "1.5rem" }}>
            ₹{TARIFF_DATA.import_rate}
          </div>
          <div className="label">Grid Import Rate</div>
        </div>
        <div className="kpi-card" style={{ textAlign: "center" }}>
          <div className="value" style={{ color: "var(--accent-green)", fontSize: "1.5rem" }}>
            ₹{TARIFF_DATA.export_rate}
          </div>
          <div className="label">Solar Export Rate</div>
        </div>
        <div className="kpi-card" style={{ textAlign: "center" }}>
          <div className="value" style={{ color: "var(--accent-solar)", fontSize: "1.5rem" }}>
            ₹{differential}
          </div>
          <div className="label">Differential (Savings)</div>
        </div>
      </div>

      {selfConsumptionValue && (
        <div style={{
          background: "var(--bg-primary)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Today's self-consumption value:{" "}
          </span>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--accent-green)" }}>
            ₹{selfConsumptionValue.toLocaleString()}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            {" "}(vs grid import at ₹{(dailyForecast.p50_kwh * TARIFF_DATA.import_rate).toFixed(0)})
          </span>
        </div>
      )}

      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
        {TARIFF_DATA.notes.map((note, i) => (
          <p key={i} style={{ marginBottom: 4 }}>• {note}</p>
        ))}
      </div>
    </div>
  );
}
