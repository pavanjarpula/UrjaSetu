import React, { useState, useEffect } from "react";
import { getDailySummary } from "../api/client";

const today = () => new Date().toISOString().split("T")[0];

export default function DailySummaryBoard({ date }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (date) loadSummary(); }, [date]);

  const loadSummary = async () => {
    setLoading(true); setError(null);
    try { const data = await getDailySummary(date || today()); setSummary(data); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="card summary-card mb-6">
      <div className="card-header"><div className="card-title">📋 Daily Operations Summary</div></div>
      <div className="loading-container" style={{ padding: "1.5rem" }}><div className="spinner spinner-sm" /><div className="loading-text">Generating AI summary...</div></div>
    </div>
  );

  if (error) return (
    <div className="card summary-card mb-6" style={{ borderLeft: "3px solid var(--color-red)" }}>
      <div className="card-header"><div className="card-title">📋 Daily Operations Summary</div></div>
      <p style={{ color: "var(--color-red)", padding: "0 1.25rem 1rem", fontSize: 13 }}>Summary unavailable: {error}</p>
    </div>
  );

  if (!summary) return null;

  return (
    <div className="card summary-card mb-6" style={{ borderLeft: "3px solid var(--color-solar)" }}>
      <div className="card-header">
        <div className="card-title">📋 Daily Operations Summary</div>
        <span className="badge badge-solar">{summary.date}</span>
      </div>
      <div className="summary-content" style={{ padding: "0 1.25rem 1rem" }}>
        <p style={{ lineHeight: 1.7 }}>{summary.summary}</p>
        {summary.forecast && (
          <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--color-solar)" }}>P50: {summary.forecast.p50_kwh?.toLocaleString()} kWh</span>
            {summary.weather && <span style={{ fontSize: 12, color: "var(--color-ice)" }}>Temp: {summary.weather.temperature}°C</span>}
            {summary.weather && <span style={{ fontSize: 12, color: "var(--color-purple)" }}>Cloud: {summary.weather.cloud_cover}%</span>}
          </div>
        )}
      </div>
    </div>
  );
}
