import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { getTelemetryLatest, simulateTelemetry } from "../api/client";

const CORE_METRICS = [
  { key: "chiller_power_kw", label: "Chiller Power", unit: "kW", color: "#f59e0b", icon: "⚡" },
  { key: "evaporator_temp_c", label: "Evaporator Temp", unit: "°C", color: "#38bdf8", icon: "🌡️" },
  { key: "ice_tank_level_pct", label: "Ice Tank Level", unit: "%", color: "#10b981", icon: "🧊" },
  { key: "chilled_water_supply_temp_c", label: "CHW Supply Temp", unit: "°C", color: "#a78bfa", icon: "💧" },
  { key: "chilled_water_return_temp_c", label: "CHW Return Temp", unit: "°C", color: "#ef4444", icon: "💧" },
];

const DUMMY_VARIABLES = [
  { key: "cop_chiller", label: "Chiller COP", unit: "", icon: "🔄", value: 0, color: "#10b981" },
  { key: "cop_actual", label: "Actual COP", unit: "", icon: "⚙️", value: 0, color: "#f59e0b" },
  { key: "cop_carnot", label: "Carnot COP", unit: "", icon: "🔬", value: 0, color: "#38bdf8" },
  { key: "power_factor", label: "Power Factor", unit: "", icon: "📐", value: 0, color: "#a78bfa" },
  { key: "voltage", label: "Voltage", unit: "V", icon: "🔌", value: 0, color: "#ef4444" },
  { key: "current_amps", label: "Current", unit: "A", icon: "⚡", value: 0, color: "#f97316" },
  { key: "energy_meter_kwh", label: "Energy Meter", unit: "kWh", icon: "📊", value: 0, color: "#14b8a6" },
  { key: "flow_rate_m3h", label: "Flow Rate", unit: "m³/h", icon: "🌊", value: 0, color: "#0284c7" },
  { key: "condenser_temp_c", label: "Condenser Temp", unit: "°C", icon: "🔥", value: 0, color: "#dc2626" },
  { key: "ambient_temp_c", label: "Ambient Temp", unit: "°C", icon: "🌡️", value: 0, color: "#fbbf24" },
  { key: "cooling_tonnage", label: "Cooling Tonnage", unit: "TR", icon: "❄️", value: 0, color: "#7dd3fc" },
  { key: "specific_power", label: "Specific Power", unit: "kW/TR", icon: "⚡", value: 0, color: "#c4b5fd" },
];

const ICE_STATES = {
  charging: { color: "#10b981", label: "Charging" },
  crystallization: { color: "#38bdf8", label: "Crystallizing" },
  fully_charged: { color: "#f59e0b", label: "Fully Charged" },
  discharging: { color: "#a78bfa", label: "Discharging" },
  melted: { color: "#ef4444", label: "Melted" },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#171717", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: "#ececec" }}>{label}</div>
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
    try { const data = await getTelemetryLatest(null, 200); setReadings(data.readings || []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try { await simulateTelemetry(new Date().toISOString().split("T")[0], 24); await loadTelemetry(); }
    catch (err) { console.error(err); }
    finally { setSimulating(false); }
  };

  const chartData = readings.slice().reverse().map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    ice_tank_state: r.ice_tank_state,
    ...CORE_METRICS.reduce((acc, m) => { acc[m.key] = r[m.key]; return acc; }, {}),
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
            <p className="page-subtitle">Chiller plant monitoring — O4 sensor hardware deployment pending</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={handleSimulate} disabled={simulating}>
              {simulating ? <><div className="spinner spinner-sm" /> Generating...</> : "⚡ Generate Sim Data"}
            </button>
            <button className="btn btn-secondary" onClick={loadTelemetry} disabled={loading}>↻ Refresh</button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-container"><div className="spinner" /><div className="loading-text">Fetching telemetry...</div></div>
      )}

      {/* Ice Tank Status Hero */}
      {latestReading && !loading && (
        <div className="card card-accent-ice mb-6">
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(56, 189, 248, 0.1)", border: `3px solid ${iceState?.color || "#2a2a2a"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, color: iceState?.color || "#ececec"
            }}>{latestReading.ice_tank_level_pct?.toFixed(0) ?? "—"}%</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ice Tank Status</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: iceState?.color, marginTop: 2 }}>{iceState?.label || "Unknown"}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                Tank: {latestReading.ice_tank_level_pct?.toFixed(1)}% · Updated: {new Date(latestReading.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div className={`status-badge ${latestReading.ice_tank_state === "charging" || latestReading.ice_tank_state === "fully_charged" ? "status-online" : "status-warning"}`}>
              <span className="badge-dot" />
              {latestReading.ice_tank_state === "charging" || latestReading.ice_tank_state === "fully_charged" ? "Active" : "Attention"}
            </div>
          </div>
        </div>
      )}

      {/* Core Telemetry KPIs */}
      {latestReading && !loading && (
        <>
          <div className="kpi-grid">
            {CORE_METRICS.map((m) => (
              <div key={m.key} className="kpi-card" style={{ "--kpi-color": m.color, "--kpi-bg": `${m.color}10` }}>
                <div className="kpi-icon">{m.icon}</div>
                <div className="kpi-label">{m.label}</div>
                <div className="kpi-value">{latestReading[m.key]?.toFixed(1) ?? "—"}</div>
                <div className="kpi-sub">{m.unit}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid-2">
            {CORE_METRICS.slice(0, 2).map((m) => (
              <div key={m.key} className="card">
                <div className="card-header">
                  <div className="card-title">{m.icon} {m.label}</div>
                  <div className="card-subtitle">{m.unit} over time</div>
                </div>
                <div className="chart-container" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: "#525252" }} />
                      <YAxis tick={{ fontSize: 9, fill: "#525252" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dummy Variables Grid — Not yet deployed */}
      <div className="mt-6">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Chiller Plant Instrumentation</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>O4 sensors — awaiting hardware deployment</div>
          </div>
          <span className="badge badge-neutral">Not Connected</span>
        </div>
        <div className="telemetry-grid">
          {DUMMY_VARIABLES.map((v) => (
            <div key={v.key} className="telemetry-item">
              <div className="telemetry-item-icon">{v.icon}</div>
              <div className="telemetry-item-label">{v.label}</div>
              <div className="telemetry-item-value" style={{ color: "var(--text-muted)" }}>0</div>
              <div className="telemetry-item-unit">{v.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {!latestReading && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">📡</div>
          <div className="empty-state-title">No telemetry data</div>
          <div className="empty-state-desc">Click "Generate Sim Data" to populate simulated sensor readings.</div>
          <button className="btn btn-primary btn-lg mt-4" onClick={handleSimulate} disabled={simulating}>
            {simulating ? "Generating..." : "⚡ Generate Simulated Data"}
          </button>
        </div>
      )}
    </div>
  );
}
