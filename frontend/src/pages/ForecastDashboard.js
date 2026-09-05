import React, { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar
} from "recharts";
import { getDailyForecast, getHourlyForecast, getForecastAccuracy } from "../api/client";
import DailySummaryBoard from "../components/DailySummaryBoard";
import TariffPanel from "../components/TariffPanel";
import WeatherPanel from "../components/WeatherPanel";

const today = () => new Date().toISOString().split("T")[0];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#171717", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: "#ececec" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.value?.toFixed?.(1) ?? p.value} kWh</span>
        </div>
      ))}
    </div>
  );
};

export default function ForecastDashboard() {
  const [date, setDate] = useState(today());
  const [daily, setDaily] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dailyRes, hourlyRes, accRes] = await Promise.allSettled([
        getDailyForecast(date),
        getHourlyForecast(date),
        getForecastAccuracy(14),
      ]);
      if (dailyRes.status === "fulfilled") setDaily(dailyRes.value.forecast);
      if (hourlyRes.status === "fulfilled") setHourly(hourlyRes.value);
      if (accRes.status === "fulfilled") setAccuracy(accRes.value);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const hourlyChartData = hourly?.forecast?.hourly_kwh
    ? hourly.forecast.hourly_kwh.map((kwh, i) => ({ hour: `${String(i + 4).padStart(2, "0")}:00`, "LSTM Output": kwh }))
    : [];

  const accuracyData = accuracy?.accuracy
    ? [...accuracy.accuracy].reverse().map((a) => ({
        date: new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        "MAPE %": a.error_pct, "Predicted": a.predicted, "Actual": a.actual,
      }))
    : [];

  const lstmTotal = hourlyChartData.reduce((s, d) => s + (d["LSTM Output"] || 0), 0);

  return (
    <div>
      <div className="banner banner-simulated">
        <span className="banner-icon">⚠️</span>
        <span>Telemetry data shown is simulated. O4 sensor hardware not yet deployed.</span>
      </div>

      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h2 className="page-title">Solar Generation Forecast</h2>
            <p className="page-subtitle">Day-ahead P10/P50/P90 quantile forecast (XGBoost) + hourly LSTM profile</p>
          </div>
          <div className="page-actions">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" style={{ width: "auto" }} />
            <button className="btn btn-primary" onClick={loadData} disabled={loading}>
              {loading ? <><div className="spinner spinner-sm" /> Loading...</> : "↻ Refresh"}
            </button>
          </div>
        </div>
      </div>

      <DailySummaryBoard date={date} />

      {daily && (
        <div className="kpi-grid">
          <div className="kpi-card" style={{ "--kpi-color": "#f59e0b", "--kpi-bg": "rgba(245,158,11,0.08)" }}>
            <div className="kpi-icon">☀️</div>
            <div className="kpi-label">P50 Forecast</div>
            <div className="kpi-value">{daily.p50_kwh?.toFixed(1)}</div>
            <div className="kpi-sub">kWh expected</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "#10b981", "--kpi-bg": "rgba(16,185,129,0.08)" }}>
            <div className="kpi-icon">📈</div>
            <div className="kpi-label">P90 (Optimistic)</div>
            <div className="kpi-value">{daily.p90_kwh?.toFixed(1)}</div>
            <div className="kpi-sub">kWh upper bound</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "#38bdf8", "--kpi-bg": "rgba(56,189,248,0.08)" }}>
            <div className="kpi-icon">📉</div>
            <div className="kpi-label">P10 (Conservative)</div>
            <div className="kpi-value">{daily.p10_kwh?.toFixed(1)}</div>
            <div className="kpi-sub">kWh lower bound</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "#a78bfa", "--kpi-bg": "rgba(167,139,250,0.08)" }}>
            <div className="kpi-icon">🤖</div>
            <div className="kpi-label">LSTM Total</div>
            <div className="kpi-value">{lstmTotal > 0 ? lstmTotal.toFixed(1) : "—"}</div>
            <div className="kpi-sub">kWh hourly sum</div>
          </div>
        </div>
      )}

      <WeatherPanel date={date} />

      <div className="grid-2">
        <div className="card card-accent-solar">
          <div className="card-header">
            <div>
              <div className="card-title">📈 Hourly Generation Profile</div>
              <div className="card-subtitle">LSTM model — 16-hour forecast (04:00–19:00)</div>
            </div>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="loading-container" style={{ padding: "3rem" }}><div className="spinner" /><div className="loading-text">Loading...</div></div>
            ) : hourlyChartData.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyChartData}>
                    <defs>
                      <linearGradient id="gradLSTM" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#737373" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#737373" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="LSTM Output" stroke="#f59e0b" fill="url(#gradLSTM)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "3rem" }}>
                <div className="empty-state-icon">📈</div>
                <div className="empty-state-title">No hourly data</div>
                <div className="empty-state-desc">LSTM model will generate hourly predictions.</div>
              </div>
            )}
          </div>
        </div>

        <div className="card card-accent-ice">
          <div className="card-header">
            <div>
              <div className="card-title">🎯 Prediction Accuracy</div>
              <div className="card-subtitle">Trailing 14-day predicted vs actual</div>
            </div>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="loading-container" style={{ padding: "3rem" }}><div className="spinner" /><div className="loading-text">Loading...</div></div>
            ) : accuracyData.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={accuracyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#737373" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#737373" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="Actual" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={18} />
                    <Line type="monotone" dataKey="Predicted" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "3rem" }}>
                <div className="empty-state-icon">🎯</div>
                <div className="empty-state-title">No accuracy data</div>
                <div className="empty-state-desc">Accuracy tracking starts after backfilling actual generation.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TariffPanel dailyForecast={daily} />
    </div>
  );
}
