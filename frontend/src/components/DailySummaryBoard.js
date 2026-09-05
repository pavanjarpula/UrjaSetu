import React, { useState, useEffect } from "react";
import { getDailySummary } from "../api/client";

const today = () => new Date().toISOString().split("T")[0];

export default function DailySummaryBoard({ date }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (date) loadSummary();
  }, [date]);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDailySummary(date || today());
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card summary-card">
        <div className="card-header">
          <h3>Daily Operations Summary</h3>
        </div>
        <p style={{ color: "var(--text-secondary)", padding: 20 }}>Generating summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card summary-card">
        <div className="card-header">
          <h3>Daily Operations Summary</h3>
        </div>
        <p style={{ color: "var(--accent-red)", padding: 20 }}>Summary unavailable: {error}</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="card summary-card">
      <div className="card-header">
        <h3>Daily Operations Summary</h3>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          {summary.date}
        </span>
      </div>
      <div className="summary-content">
        <p style={{ color: "var(--text-primary)", lineHeight: 1.7, fontSize: "0.9rem" }}>
          {summary.summary}
        </p>
        {summary.forecast && (
          <div className="summary-kpis" style={{ marginTop: 12, display: "flex", gap: 16 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--accent-solar)" }}>
              P50: {summary.forecast.p50_kwh?.toLocaleString()} kWh
            </span>
            {summary.tes && (
              <span style={{ fontSize: "0.8rem", color: "var(--accent-ice)" }}>
                Coverage: {summary.tes.coverage_pct}%
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
