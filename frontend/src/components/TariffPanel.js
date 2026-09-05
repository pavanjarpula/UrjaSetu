import React from "react";

const TARIFF_DATA = {
  import_rate: 8.5,
  export_rate: 4.2,
  source: "WBSEDCL Net Metering Tariff 2024-25 (IIT Kharagpur region)",
  notes: [
    "Grid import rate applies when solar generation is insufficient",
    "Solar export rate applies under net metering for surplus generation",
    "Differential of ₹4.3/kWh represents savings from solar self-consumption",
    "Tariff subject to annual revision by West Bengal State Electricity Distribution Co.",
  ],
};

export default function TariffPanel({ dailyForecast }) {
  const differential = TARIFF_DATA.import_rate - TARIFF_DATA.export_rate;
  const selfConsumptionValue = dailyForecast?.p50_kwh ? (dailyForecast.p50_kwh * differential).toFixed(0) : null;

  return (
    <div className="card tariff-card mt-6">
      <div className="card-header">
        <div>
          <div className="card-title">💰 Tariff & Economics</div>
          <div className="card-subtitle">{TARIFF_DATA.source}</div>
        </div>
      </div>

      <div className="grid-3 mb-4">
        <div className="kpi-card" style={{ "--kpi-color": "#ef4444", "--kpi-bg": "rgba(239,68,68,0.08)" }}>
          <div className="kpi-icon">🔴</div>
          <div className="kpi-label">Grid Import Rate</div>
          <div className="kpi-value">₹{TARIFF_DATA.import_rate}</div>
          <div className="kpi-sub">per kWh</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "#10b981", "--kpi-bg": "rgba(16,185,129,0.08)" }}>
          <div className="kpi-icon">🟢</div>
          <div className="kpi-label">Solar Export Rate</div>
          <div className="kpi-value">₹{TARIFF_DATA.export_rate}</div>
          <div className="kpi-sub">per kWh</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "#f59e0b", "--kpi-bg": "rgba(245,158,11,0.08)" }}>
          <div className="kpi-icon">⚡</div>
          <div className="kpi-label">Net Savings</div>
          <div className="kpi-value">₹{differential}</div>
          <div className="kpi-sub">per kWh differential</div>
        </div>
      </div>

      {selfConsumptionValue && (
        <div style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, border: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Today's self-consumption value: </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-green)" }}>₹{selfConsumptionValue.toLocaleString()}</span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}> (vs grid import at ₹{(dailyForecast.p50_kwh * TARIFF_DATA.import_rate).toFixed(0)})</span>
        </div>
      )}

      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
        {TARIFF_DATA.notes.map((note, i) => <p key={i} style={{ marginBottom: 3 }}>• {note}</p>)}
      </div>
    </div>
  );
}
