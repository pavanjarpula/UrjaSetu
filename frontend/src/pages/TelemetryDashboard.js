import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { getTelemetryLatest, simulateTelemetry } from "../api/client";

const METRICS = [
  { key: "chiller_power_kw", label: "Chiller Power", unit: "kW", color: "#f59e0b", icon: "⚡" },
  { key: "evaporator_temp_c", label: "Evaporator Temp", unit: "°C", color: "#38bdf8", icon: "🌡️" },
  { key: "ice_tank_level_pct", label: "Ice Tank Level", unit: "%", color: "#22c55e", icon: "🧊" },
  { key: "chilled_water_supply_temp_c", label: "CHW Supply Temp", unit: "°C", color: "#a78bfa", icon: "💧" },
  { key: "chilled_water_return_temp_c", label: "CHW Return Temp", unit: "°C", color: "#ef4444", icon: "💧" },
];

const ICE_STATES = {
  charging: { color: "#22c55e", label: "Charging", bg: "rgba(34,197,94,0.12)" },
  crystallization: { color: "#38bdf8", label: "Crystallizing", bg: "rgba(56,189,248,0.12)" },
  fully_charged: { color: "#f59e0b", label: "Fully Charged", bg: "rgba(245,158,11,0.12)" },
  discharging: { color: "#a78bfa", label: "Discharging", bg: "rgba(167,139,250,0.12)" },
  melted: { color: "#ef4444", label: "Melted", bg: "rgba(239,68,68,0.12)" },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
};

export default function TelemetryDashboard() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => { loadTelemetry(); }, []);

  const loadTelemetry = async () => {
    setLoading(true);
    try {
      const data = await getTelemetryLatest(null, 200);
      setReadings(data.readings || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await simulateTelemetry(today, 24);
      await loadTelemetry();
    } catch (err) { console.error(err); }
    finally { setSimulating(false); }
  };

  const chartData = readings.slice().reverse().map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    ice_tank_state: r.ice_tank_state,
    ...METRICS.reduce((acc, m) => { acc[m.key] = r[m.key]; return acc; }, {}),
  }));

  const latestReading = readings[0];
  const iceState = latestReading ? ICE_STATES[latestReading.ice_tank_state] : null;

  return (
    <div>
      <div className="banner banner-simulated">
        <span className="banner-icon">⚠️</span>
        <span>Telemetry data shown is simulated. O4 sensor hardware not yet deployed.</span>
      </div>

      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h2 className="page-title">Live Telemetry</h2>
            <p className="page-subtitle">Chiller plant monitoring — sensor hardware not yet deployed</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={handleSimulate} disabled={simulating}>
              {simulating ? <><div className="spinner spinner-sm" /> Generating...</> : "⚡ Generate Sim Data"}
            </button>
            <button className="btn btn-secondary" onClick={loadTelemetry} disabled={loading}>
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <div className="loading-text">Fetching telemetry readings...</div>
        </div>
      )}

      {latestReading && !loading && (
        <>
          {/* Ice Tank Status Hero */}
          <div className="card card-accent-ice" style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: iceState?.bg || "var(--bg-elevated)",
                border: `3px solid ${iceState?.color || "var(--border-default)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, fontWeight: 700, color: iceState?.color || "var(--text-primary)"
              }}>
                {latestReading.ice_tank_level_pct?.toFixed(0) ?? "—"}%
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ice Tank Status</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: iceState?.color, marginTop: 2 }}>
                  {iceState?.label || "Unknown"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  Tank Level: {latestReading.ice_tank_level_pct?.toFixed(1)}% · Last updated: {new Date(latestReading.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className={`status-badge ${latestReading.ice_tank_state === "charging" || latestReading.ice_tank_state === "fully_charged" ? "status-online" : "status-warning"}`}>
                <span className="badge-dot" />
                {latestReading.ice_tank_state === "charging" || latestReading.ice_tank_state === "fully_charged" ? "System Active" : "Attention Needed"}
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-grid">
            {METRICS.map((m) => (
              <div key={m.key} className="kpi-card" style={{ "--kpi-color": m.color, "--kpi-bg": `${m.color}15` }}>
                <div className="kpi-icon">{m.icon}</div>
                <div className="kpi-label">{m.label}</div>
                <div className="kpi-value">{latestReading[m.key]?.toFixed(1) ?? "—"}</div>
                <div className="kpi-sub">{m.unit}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid-2">
            {METRICS.slice(0, 2).map((m) => (
              <div key={m.key} className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">{m.icon} {m.label}</div>
                    <div className="card-subtitle">{m.unit} over time</div>
                  </div>
                </div>
                <div className="chart-container" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: "var(--space-5)" }}>
            {METRICS.slice(2, 4).map((m) => (
              <div key={m.key} className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">{m.icon} {m.label}</div>
                    <div className="card-subtitle">{m.unit} over time</div>
                  </div>
                </div>
                <div className="chart-container" style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          {/* Ice Tank State Timeline */}
          <div className="card mt-6">
            <div className="card-header">
              <div>
                <div className="card-title">Ice Tank State Timeline</div>
                <div className="card-subtitle">Hourly state transitions</div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {Object.entries(ICE_STATES).map(([key, s]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {chartData.map((d, i) => {
                const s = ICE_STATES[d.ice_tank_state];
                return (
                  <div
                    key={i}
                    style={{
                      width: 36, height: 36, borderRadius: 6,
                      background: s?.bg || "var(--bg-elevated)",
                      border: `1px solid ${s?.color || "var(--border-default)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 600, color: s?.color || "var(--text-tertiary)",
                      transition: "all 0.2s",
                    }}
                    title={`${d.time}: ${s?.label || "Unknown"}`}
                  >
                    {d.time?.split(":")[0]}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!latestReading && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <div className="empty-state-title">No telemetry data yet</div>
          <div className="empty-state-desc">Click "Generate Sim Data" to populate simulated sensor readings.</div>
          <button className="btn btn-primary btn-lg" onClick={handleSimulate} disabled={simulating} style={{ marginTop: 16 }}>
            {simulating ? "Generating..." : "⚡ Generate Simulated Data"}
          </button>
        </div>
      )}
    </div>
  );
}
