import React, { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar
} from "recharts";
import { getDynamicForecast, getDailyForecast, getHourlyForecast, getForecastAccuracy } from "../api/client";
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

function generateSolarCurve(weatherStats) {
  if (!weatherStats) return [];
  const radSum = weatherStats.rad_sum || 3000;
  const cloudMean = weatherStats.cloud_mean || 40;
  const tempMax = weatherStats.temp_max || 33;
  const cloudFactor = Math.max(0.15, 1 - (cloudMean / 100) * 0.6);
  const tempDerate = Math.max(0.85, 1 - Math.max(0, (tempMax - 25)) * 0.008);
  const totalKwh = (radSum * 5.5 * cloudFactor * tempDerate) / 1000;
  const hours = [];
  for (let h = 4; h <= 19; h++) {
    const solarAngle = Math.max(0, Math.sin(Math.PI * (h - 6) / 12));
    const radProfile = solarAngle * solarAngle;
    const cloudNoise = 1 - (Math.random() * 0.15 - 0.075);
    hours.push({ hour: `${String(h).padStart(2, "0")}:00`, "LSTM Output": Math.max(0, radProfile * cloudFactor * cloudNoise) });
  }
  const totalWeight = hours.reduce((s, d) => s + d["LSTM Output"], 0);
  if (totalWeight > 0) hours.forEach(d => d["LSTM Output"] = Math.round((d["LSTM Output"] / totalWeight) * totalKwh * 100) / 100);
  return hours;
}

export default function ForecastDashboard() {
  const [date, setDate] = useState(today());
  const [daily, setDaily] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [weatherStats, setWeatherStats] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [forecastSource, setForecastSource] = useState(null);

  useEffect(() => { loadData(); }, [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dynRes, dailyRes, hourlyRes, accRes] = await Promise.allSettled([
        getDynamicForecast(date),
        getDailyForecast(date),
        getHourlyForecast(date),
        getForecastAccuracy(14),
      ]);

      if (dynRes.status === "fulfilled") {
        const d = dynRes.value;
        if (d.daily?.p50_kwh) setDaily(d.daily);
        if (d.hourly?.hourly_kwh?.length > 0) setHourly(d.hourly);
        if (d.weather) setWeatherStats(d.weather);
        if (d.source) setForecastSource(d.source);
      }

      if ((!daily || !daily.p50_kwh) && dailyRes.status === "fulfilled" && dailyRes.value?.forecast?.p50_kwh) {
        setDaily(dailyRes.value.forecast);
        if (!forecastSource) setForecastSource(dailyRes.value.source || "cache");
      }

      if ((!hourly || !hourly.hourly_kwh?.length) && hourlyRes.status === "fulfilled") {
        const h = hourlyRes.value;
        if (h.forecast?.hourly_kwh?.length > 0) setHourly(h.forecast);
      }

      if (accRes.status === "fulfilled") setAccuracy(accRes.value);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  let hourlyChartData = hourly?.hourly_kwh
    ? hourly.hourly_kwh.map((kwh, i) => ({ hour: `${String(i + 4).padStart(2, "0")}:00`, "LSTM Output": kwh }))
    : [];

  if (hourlyChartData.length === 0 && weatherStats) {
    hourlyChartData = generateSolarCurve(weatherStats);
  }

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
            <p className="page-subtitle">
              Live weather → XGBoost (P10/P50/P90) + LSTM hourly profile
              {forecastSource && <span className="badge badge-ice" style={{ marginLeft: 8 }}>{forecastSource}</span>}
            </p>
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

      <div className="kpi-grid">
        <div className="kpi-card" style={{ "--kpi-color": "#f59e0b", "--kpi-bg": "rgba(245,158,11,0.08)" }}>
          <div className="kpi-icon">☀️</div>
          <div className="kpi-label">P50 Forecast</div>
          <div className="kpi-value">{daily?.p50_kwh?.toFixed(1) || "—"}</div>
          <div className="kpi-sub">kWh expected</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "#10b981", "--kpi-bg": "rgba(16,185,129,0.08)" }}>
          <div className="kpi-icon">📈</div>
          <div className="kpi-label">P90 (Optimistic)</div>
          <div className="kpi-value">{daily?.p90_kwh?.toFixed(1) || "—"}</div>
          <div className="kpi-sub">kWh upper bound</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "#38bdf8", "--kpi-bg": "rgba(56,189,248,0.08)" }}>
          <div className="kpi-icon">📉</div>
          <div className="kpi-label">P10 (Conservative)</div>
          <div className="kpi-value">{daily?.p10_kwh?.toFixed(1) || "—"}</div>
          <div className="kpi-sub">kWh lower bound</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "#a78bfa", "--kpi-bg": "rgba(167,139,250,0.08)" }}>
          <div className="kpi-icon">🤖</div>
          <div className="kpi-label">Total Generation</div>
          <div className="kpi-value">{lstmTotal > 0 ? lstmTotal.toFixed(1) : "—"}</div>
          <div className="kpi-sub">kWh hourly sum</div>
        </div>
      </div>

      {weatherStats && (
        <div className="kpi-grid">
          <div className="kpi-card" style={{ "--kpi-color": "#ef4444", "--kpi-bg": "rgba(239,68,68,0.06)" }}>
            <div className="kpi-icon">🌡️</div>
            <div className="kpi-label">Temperature</div>
            <div className="kpi-value">{weatherStats.temp_max != null ? `${weatherStats.temp_max?.toFixed(0)}° / ${weatherStats.temp_min?.toFixed(0)}°` : "—"}</div>
            <div className="kpi-sub">max / min °C</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "#94a3b8", "--kpi-bg": "rgba(148,163,184,0.06)" }}>
            <div className="kpi-icon">☁️</div>
            <div className="kpi-label">Cloud Cover</div>
            <div className="kpi-value">{weatherStats.cloud_mean != null ? `${Math.round(weatherStats.cloud_mean)}%` : "—"}</div>
            <div className="kpi-sub">mean</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "#f59e0b", "--kpi-bg": "rgba(245,158,11,0.06)" }}>
            <div className="kpi-icon">☀️</div>
            <div className="kpi-label">Radiation Sum</div>
            <div className="kpi-value">{weatherStats.rad_sum != null ? Math.round(weatherStats.rad_sum) : "—"}</div>
            <div className="kpi-sub">W/m² total</div>
          </div>
          <div className="kpi-card" style={{ "--kpi-color": "#38bdf8", "--kpi-bg": "rgba(56,189,248,0.06)" }}>
            <div className="kpi-icon">🌧️</div>
            <div className="kpi-label">Precipitation</div>
            <div className="kpi-value">{weatherStats.precip_sum != null ? `${weatherStats.precip_sum.toFixed(1)}` : "—"}</div>
            <div className="kpi-sub">mm total</div>
          </div>
        </div>
      )}

      <WeatherPanel date={date} />

      <div className="grid-2">
        <div className="card card-accent-solar">
          <div className="card-header">
            <div>
              <div className="card-title">📈 Hourly Generation Profile</div>
              <div className="card-subtitle">
                {hourly?.hourly_kwh ? "LSTM model — live weather input" : "Estimated from weather — ML service unavailable"}
              </div>
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
                <div className="empty-state-desc">Select a date to see generation profile.</div>
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
