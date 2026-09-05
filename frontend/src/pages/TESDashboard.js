import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line
} from "recharts";
import { getTESSizing, getTESRecent, getTESDischarge } from "../api/client";

const today = () => new Date().toISOString().split("T")[0];

const TIER_COLORS = { Large: "#f59e0b", Medium: "#38bdf8", Small: "#a78bfa" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function TESDashboard() {
  const [date, setDate] = useState(today());
  const [tes, setTes] = useState(null);
  const [recent, setRecent] = useState(null);
  const [discharge, setDischarge] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tesRes, recentRes, dischargeRes] = await Promise.allSettled([
        getTESSizing(date), getTESRecent(30), getTESDischarge(date),
      ]);
      if (tesRes.status === "fulfilled") setTes(tesRes.value.tes);
      if (recentRes.status === "fulfilled") setRecent(recentRes.value);
      if (dischargeRes.status === "fulfilled") setDischarge(dischargeRes.value);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const tierData = tes?.tier_summary
    ? Object.entries(tes.tier_summary).map(([tier, data]) => ({ tier, ice_kg: data.ice_kg, discharge_kwh: data.discharge_kwh, rooms: data.rooms }))
    : [];

  const coverageData = recent?.coverageTrend
    ? recent.coverageTrend.reverse().map((r) => ({
        date: new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        coverage_pct: r.coverage_pct,
      }))
    : [];

  const dischargeData = discharge?.discharge_schedule
    ? discharge.discharge_schedule.map((d) => ({ hall: d.hall_id, tier: d.tier, ice_kg: d.ice_allocation_kg, discharge_kwh: d.discharge_kwh }))
    : [];

  return (
    <div>
      <div className="banner banner-simulated">
        <span className="banner-icon">⚠️</span>
        <span>Telemetry data shown is simulated. O4 sensor hardware not yet deployed.</span>
      </div>

      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h2 className="page-title">Ice TES Sizing & Dispatch</h2>
            <p className="page-subtitle">Thermodynamic sizing engine — ice mass, volume, coverage, and waterfall discharge for 21 halls</p>
          </div>
          <div className="page-actions">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" style={{ width: "auto" }} />
            <button className="btn btn-primary" onClick={loadData} disabled={loading}>
              {loading ? <><div className="spinner spinner-sm" /> Loading...</> : "↻ Refresh"}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="spinner" />
          <div className="loading-text">Computing thermodynamic sizing...</div>
        </div>
      )}

      {tes && !loading && (
        <>
          {/* KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card" style={{ "--kpi-color": "var(--color-ice)", "--kpi-bg": "rgba(56,189,248,0.1)" }}>
              <div className="kpi-icon">🧊</div>
              <div className="kpi-label">Ice Mass</div>
              <div className="kpi-value">{tes.ice_mass_kg?.toLocaleString()}</div>
              <div className="kpi-sub">kg required</div>
            </div>
            <div className="kpi-card" style={{ "--kpi-color": "var(--color-ice)", "--kpi-bg": "rgba(56,189,248,0.1)" }}>
              <div className="kpi-icon">📦</div>
              <div className="kpi-label">Ice Volume</div>
              <div className="kpi-value">{tes.ice_volume_m3?.toLocaleString()}</div>
              <div className="kpi-sub">m³ tank volume</div>
            </div>
            <div className="kpi-card" style={{ "--kpi-color": "var(--color-green)", "--kpi-bg": "rgba(34,197,94,0.1)" }}>
              <div className="kpi-icon">🎯</div>
              <div className="kpi-label">Night Coverage</div>
              <div className="kpi-value">{tes.coverage_pct}%</div>
              <div className="kpi-sub">of cooling load met</div>
            </div>
            <div className="kpi-card" style={{ "--kpi-color": "var(--color-purple)", "--kpi-bg": "rgba(167,139,250,0.1)" }}>
              <div className="kpi-icon">⚙️</div>
              <div className="kpi-label">Actual COP</div>
              <div className="kpi-value">{tes.cop_actual}</div>
              <div className="kpi-sub">vs Carnot {tes.cop_carnot}</div>
            </div>
          </div>

          {/* Secondary KPIs */}
          <div className="grid-3" style={{ marginBottom: "var(--space-6)" }}>
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔥</div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Carnot COP</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{tes.cop_carnot}</div>
              </div>
            </div>
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(56,189,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📊</div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>SLR (Sensible/Latent)</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{tes.slr}</div>
              </div>
            </div>
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⏰</div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Charging Window</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{tes.charging_window}</div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid-2">
            <div className="card card-accent-ice">
              <div className="card-header">
                <div>
                  <div className="card-title">Waterfall Discharge by Tier</div>
                  <div className="card-subtitle">Ice allocation and discharge per tier</div>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={tierData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="tier" tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="ice_kg" fill="#38bdf8" name="Ice (kg)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="discharge_kwh" fill="#f59e0b" name="Discharge (kWh)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card card-accent-green">
              <div className="card-header">
                <div>
                  <div className="card-title">30-Day Coverage Trend</div>
                  <div className="card-subtitle">Night coverage percentage over time</div>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={coverageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="coverage_pct" name="Coverage %" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Per-hall discharge table */}
          {dischargeData.length > 0 && (
            <div className="card mt-6">
              <div className="card-header">
                <div>
                  <div className="card-title">Per-Hall Discharge Schedule</div>
                  <div className="card-subtitle">{dischargeData.length} halls of residence</div>
                </div>
                <span className="badge badge-ice">{dischargeData.length} halls</span>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hall</th>
                      <th>Tier</th>
                      <th>Ice Allocation (kg)</th>
                      <th>Discharge (kWh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dischargeData.map((d) => (
                      <tr key={d.hall}>
                        <td style={{ fontWeight: 500 }}>{d.hall}</td>
                        <td>
                          <span className="badge" style={{ background: `${TIER_COLORS[d.tier]}20`, color: TIER_COLORS[d.tier] }}>
                            {d.tier}
                          </span>
                        </td>
                        <td>{d.ice_kg?.toLocaleString()}</td>
                        <td style={{ fontWeight: 500 }}>{d.discharge_kwh?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!tes && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">🧊</div>
          <div className="empty-state-title">No TES data for this date</div>
          <div className="empty-state-desc">Select a different date or run the sizing engine.</div>
        </div>
      )}
    </div>
  );
}
