import React, { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { getTelemetryLatest, simulateTelemetry } from "../api/client";

const METRICS = [
  { key: "chiller_power_kw", label: "Chiller Power (kW)", color: "#f59e0b" },
  { key: "evaporator_temp_c", label: "Evaporator Temp (°C)", color: "#38bdf8" },
  { key: "ice_tank_level_pct", label: "Ice Tank Level (%)", color: "#22c55e" },
  { key: "chilled_water_supply_temp_c", label: "CHW Supply Temp (°C)", color: "#a78bfa" },
  { key: "chilled_water_return_temp_c", label: "CHW Return Temp (°C)", color: "#ef4444" },
];

const ICE_STATE_COLORS = {
  charging: "#22c55e",
  crystallization: "#38bdf8",
  fully_charged: "#f59e0b",
  discharging: "#a78bfa",
  melted: "#ef4444",
};

const ICE_STATE_LABELS = {
  charging: "Charging",
  crystallization: "Crystallizing",
  fully_charged: "Fully Charged",
  discharging: "Discharging",
  melted: "Melted",
};

export default function TelemetryDashboard() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    loadTelemetry();
  }, []);

  const loadTelemetry = async () => {
    setLoading(true);
    try {
      const data = await getTelemetryLatest(null, 200);
      setReadings(data.readings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await simulateTelemetry(today, 24);
      await loadTelemetry();
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  const chartData = readings
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      ice_tank_state: r.ice_tank_state,
      ...METRICS.reduce((acc, m) => {
        acc[m.key] = r[m.key];
        return acc;
      }, {}),
    }));

  const latestReading = readings[0];

  return (
    <div>
      <div className="page-header">
        <h2>Telemetry (Simulated)</h2>
        <p>Architecture demonstration — sensor hardware not yet deployed</p>
      </div>

      <div className="banner-simulated">
        Sensor hardware not yet deployed. Values shown are simulated for architecture demonstration.
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          className="btn btn-primary"
          onClick={handleSimulate}
          disabled={simulating}
        >
          {simulating ? "Generating..." : "Generate Simulated Data"}
        </button>
        <button className="btn btn-secondary" onClick={loadTelemetry} style={{ marginLeft: 8 }}>
          Refresh
        </button>
      </div>

      {loading && <p style={{ color: "var(--text-secondary)" }}>Loading...</p>}

      {latestReading && (
        <>
          {/* Ice Tank State KPI */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <h3>Ice Tank Status</h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: ICE_STATE_COLORS[latestReading.ice_tank_state] || "#334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
              }}>
                {latestReading.ice_tank_level_pct?.toFixed(0) ?? "—"}%
              </div>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 600, color: ICE_STATE_COLORS[latestReading.ice_tank_state] }}>
                  {ICE_STATE_LABELS[latestReading.ice_tank_state] || "Unknown"}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Tank Level: {latestReading.ice_tank_level_pct?.toFixed(1) ?? "—"}%
                </div>
              </div>
            </div>
          </div>

          <div className="grid-4" style={{ marginBottom: 20 }}>
            {METRICS.slice(0, 4).map((m) => (
              <div key={m.key} className="card kpi-card">
                <div className="value" style={{ color: m.color }}>
                  {latestReading[m.key]?.toFixed(1) ?? "—"}
                </div>
                <div className="label">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            {METRICS.slice(0, 2).map((m) => (
              <div key={m.key} className="card">
                <div className="card-header">
                  <h3>{m.label}</h3>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                      <Line type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            {METRICS.slice(2, 4).map((m) => (
              <div key={m.key} className="card">
                <div className="card-header">
                  <h3>{m.label}</h3>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                      <Line type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          {/* Ice Tank State Timeline */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h3>Ice Tank State Timeline</h3>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {chartData.map((d, i) => (
                <div
                  key={i}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: ICE_STATE_COLORS[d.ice_tank_state] || "#334155",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.6rem",
                    color: "#fff",
                  }}
                  title={`${d.time}: ${ICE_STATE_LABELS[d.ice_tank_state] || "Unknown"}`}
                >
                  {d.time?.split(":")[0]}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {readings.length === 0 && !loading && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
            No telemetry data yet. Click "Generate Simulated Data" to populate.
          </p>
        </div>
      )}
    </div>
  );
}
