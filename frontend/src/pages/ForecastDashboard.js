import React, { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar
} from "recharts";
import { getDailyForecast, getHourlyForecast, getForecastAccuracy } from "../api/client";
import DailySummaryBoard from "../components/DailySummaryBoard";
import TariffPanel from "../components/TariffPanel";

const today = () => new Date().toISOString().split("T")[0];

export default function ForecastDashboard() {
  const [date, setDate] = useState(today());
  const [daily, setDaily] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [date]);

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

  const bandData = daily ? [
    { name: "P10", p10: daily.p10_kwh, p50: daily.p50_kwh, p90: daily.p90_kwh },
  ] : [];

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
      <div className="page-header">
        <h2>Solar Generation Forecast</h2>
        <p>Day-ahead P10/P50/P90 quantile forecast (XGBoost) + hourly breakdown (LSTM)</p>
      </div>

      <DailySummaryBoard date={date} />

      <div className="controls" style={{ marginBottom: 20 }}>
        <label style={{ marginRight: 8, color: "var(--text-secondary)" }}>Date:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="date-input"
        />
        <button className="btn btn-primary" onClick={loadData} style={{ marginLeft: 8 }}>
          Refresh
        </button>
      </div>

      {loading && <p style={{ color: "var(--text-secondary)" }}>Loading...</p>}

      {daily && (
        <>
          <div className="grid-4">
            <div className="card kpi-card solar">
              <div className="value">{daily.p10_kwh?.toLocaleString()}</div>
              <div className="label">P10 (Conservative) kWh</div>
            </div>
            <div className="card kpi-card solar">
              <div className="value">{daily.p50_kwh?.toLocaleString()}</div>
              <div className="label">P50 (Expected) kWh</div>
            </div>
            <div className="card kpi-card solar">
              <div className="value">{daily.p90_kwh?.toLocaleString()}</div>
              <div className="label">P90 (Optimistic) kWh</div>
            </div>
            <div className="card kpi-card green">
              <div className="value">{accuracy?.summary?.avg_mape ?? "—"}</div>
              <div className="label">Trailing MAPE %</div>
            </div>
          </div>

          <div className="grid-2">
            {/* XGBoost Forecast Band */}
            <div className="card">
              <div className="card-header">
                <h3>XGBoost Quantile Band (P10/P50/P90)</h3>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={[
                    { name: "P10", value: daily.p10_kwh },
                    { name: "P50", value: daily.p50_kwh },
                    { name: "P90", value: daily.p90_kwh },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                    <Area type="monotone" dataKey="value" stroke="#f59e0b" fill="#f59e0b33" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* LSTM Hourly Profile */}
            <div className="card">
              <div className="card-header">
                <h3>LSTM Hourly Generation Profile</h3>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={hourlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                    <Legend />
                    <Bar dataKey="predicted_kwh" fill="#38bdf844" name="Hourly (kWh)" />
                    <Line type="monotone" dataKey="predicted_kwh" stroke="#38bdf8" strokeWidth={2} dot={false} name="LSTM Curve" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Combined Chart: XGBoost band + LSTM hourly overlay */}
          {hourlyChartData.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Combined View: XGBoost P50 + LSTM Hourly</h3>
              </div>
              <div className="chart-container" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={hourlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="predicted_kwh"
                      fill="#f59e0b22"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      name="LSTM Hourly"
                    />
                    <Line
                      type="monotone"
                      dataKey={() => daily.p50_kwh / 16}
                      stroke="#22c55e"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="XGBoost P50 avg/hr"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {accuracyData.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Forecast vs Actual ({accuracyData.length} days)</h3>
              </div>
              <div className="chart-container" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={accuracyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                    <Legend />
                    <Line type="monotone" dataKey="predicted" stroke="#f59e0b" name="Predicted" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="actual" stroke="#22c55e" name="Actual" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <TariffPanel dailyForecast={daily} />
        </>
      )}
    </div>
  );
}
