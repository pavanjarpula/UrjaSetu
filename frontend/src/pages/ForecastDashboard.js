import React, { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar
} from "recharts";
import { getDailyForecast, getHourlyForecast, getForecastAccuracy } from "../api/client";
import DailySummaryBoard from "../components/DailySummaryBoard";
import TariffPanel from "../components/TariffPanel";

const today = () => new Date().toISOString().split("T")[0];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border-default)",
      borderRadius: 8, padding: "8px 12px", fontSize: 12
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.value?.toFixed(1)} kWh</span>
        </div>
      ))}
    </div>
  );
};

function ChartCard({ title, subtitle, children, accent = "solar" }) {
  return (
    <div className={`card card-accent-${accent}`}>
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}

function LoadingChart() {
  return (
    <div className="loading-container" style={{ padding: "3rem" }}>
      <div className="spinner" />
      <div className="loading-text">Loading forecast data...</div>
    </div>
  );
}

function EmptyChart({ message = "No data available" }) {
  return (
    <div className="empty-state" style={{ padding: "3rem" }}>
      <div className="empty-state-icon">📈</div>
      <div className="empty-state-title">{message}</div>
      <div className="empty-state-desc">Select a different date or refresh to load data.</div>
    </div>
  );
}

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const hourlyChartData = hourly?.hourly_kwh
    ? hourly.hourly_kwh.map((kwh, i) => ({
        hour: `${String(i + 4).padStart(2, "0")}:00`,
        predicted_kwh: kwh,
      }))
    : [];

  const accuracyData = accuracy?.accuracy
    ? accuracy.accuracy.reverse().map((a) => ({
        date: new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        error_pct: a.error_pct,
        predicted: a.predicted,
        actual: a.actual,
      }))
    : [];

  return (
    <div>
      {/* Simulated data banner */}
      <div className="banner banner-simulated">
        <span className="banner-icon">⚠️</span>
        <span>Telemetry data shown is simulated. O4 sensor hardware not yet deployed.</span>
      </div>

      {/* Page header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h2 className="page-title">Solar Generation Forecast</h2>
            <p className="page-subtitle">
              Day-ahead P10/P50/P90 quantile forecast (XGBoost) + hourly breakdown (LSTM)
            </p>
          </div>
          <div className="page-actions">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              style={{ width: "auto" }}
            />
            <button className="btn btn-primary" onClick={loadData} disabled={loading}>
              {loading ? <><div className="spinner spinner-sm" /> Loading...</> : "↻ Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Daily summary */}
      <DailySummaryBoard date={date} />

      {/* KPI Cards */}
      {daily && (
        <div className="kpi-grid">
          <div className="kpi-card" style={{ "--kpi-color": "var(--color-solar)", "--kpi-bg": "rgba(245,158,11,0.1)" }}>
            <div className="kpi-icon">☀️</div>
            <div className="kpi-label">P50 Forecast</div>
            <div className="kpi-value">{daily.p50_kwh?.toFixed(1)}</div>
            <div className="kpi-sub">kWh expected</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "var(--color-green)", "--kpi-bg": "rgba(34,197,94,0.1)" }}>
            <div className="kpi-icon">📈</div>
            <div className="kpi-label">P90 (Optimistic)</div>
            <div className="kpi-value">{daily.p90_kwh?.toFixed(1)}</div>
            <div className="kpi-sub">kWh upper bound</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "var(--color-ice)", "--kpi-bg": "rgba(56,189,248,0.1)" }}>
            <div className="kpi-icon">📉</div>
            <div className="kpi-label">P10 (Conservative)</div>
            <div className="kpi-value">{daily.p10_kwh?.toFixed(1)}</div>
            <div className="kpi-sub">kWh lower bound</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "var(--color-purple)", "--kpi-bg": "rgba(167,139,250,0.1)" }}>
            <div className="kpi-icon">🎯</div>
            <div className="kpi-label">Confidence Band</div>
            <div className="kpi-value">{daily.p90_kwh && daily.p10_kwh ? (daily.p90_kwh - daily.p10_kwh).toFixed(1) : "—"}</div>
            <div className="kpi-sub">kWh spread</div>
          </div>
        </div>
      )}

      {/* Charts grid */}
      <div className="grid-2">
        {/* Hourly forecast */}
        <ChartCard title="Hourly Generation Profile" subtitle="LSTM prediction, 20-step forecast" accent="solar">
          {loading ? <LoadingChart /> : hourlyChartData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyChartData}>
                  <defs>
                    <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="predicted_kwh" name="Predicted" stroke="#f59e0b" fill="url(#gradSolar)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart />}
        </ChartCard>

        {/* Prediction accuracy */}
        <ChartCard title="Prediction Accuracy" subtitle="Trailing 14-day MAPE" accent="ice">
          {loading ? <LoadingChart /> : accuracyData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="actual" name="Actual (kWh)" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line type="monotone" dataKey="predicted" name="Predicted (kWh)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyChart />}
        </ChartCard>
      </div>

      {/* Tariff panel */}
      <TariffPanel />
    </div>
  );
}
