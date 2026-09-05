import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line
} from "recharts";
import { getTESSizing, getTESRecent, getTESDischarge } from "../api/client";

const today = () => new Date().toISOString().split("T")[0];

const TIER_COLORS = {
  Large: "#f59e0b",
  Medium: "#38bdf8",
  Small: "#a78bfa",
};

export default function TESDashboard() {
  const [date, setDate] = useState(today());
  const [tes, setTes] = useState(null);
  const [recent, setRecent] = useState(null);
  const [discharge, setDischarge] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tesRes, recentRes, dischargeRes] = await Promise.allSettled([
        getTESSizing(date),
        getTESRecent(30),
        getTESDischarge(date),
      ]);
      if (tesRes.status === "fulfilled") setTes(tesRes.value.tes);
      if (recentRes.status === "fulfilled") setRecent(recentRes.value);
      if (dischargeRes.status === "fulfilled") setDischarge(dischargeRes.value);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const tierData = tes?.tier_summary
    ? Object.entries(tes.tier_summary).map(([tier, data]) => ({
        tier,
        ice_kg: data.ice_kg,
        discharge_kwh: data.discharge_kwh,
        rooms: data.rooms,
      }))
    : [];

  const coverageData = recent?.coverageTrend
    ? recent.coverageTrend.reverse().map((r) => ({
        date: new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        coverage_pct: r.coverage_pct,
      }))
    : [];

  const dischargeData = discharge?.discharge_schedule
    ? discharge.discharge_schedule.map((d) => ({
        hall: d.hall_id,
        tier: d.tier,
        ice_kg: d.ice_allocation_kg,
        discharge_kwh: d.discharge_kwh,
      }))
    : [];

  return (
    <div>
      <div className="page-header">
        <h2>Ice TES Sizing & Dispatch</h2>
        <p>Thermodynamic sizing engine — ice mass, volume, coverage, and waterfall discharge</p>
      </div>

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

      {tes && (
        <>
          <div className="grid-4">
            <div className="card kpi-card ice">
              <div className="value">{tes.ice_mass_kg?.toLocaleString()}</div>
              <div className="label">Ice Mass (kg)</div>
            </div>
            <div className="card kpi-card ice">
              <div className="value">{tes.ice_volume_m3?.toLocaleString()}</div>
              <div className="label">Ice Volume (m³)</div>
            </div>
            <div className="card kpi-card green">
              <div className="value">{tes.coverage_pct}%</div>
              <div className="label">Night Coverage</div>
            </div>
            <div className="card kpi-card purple">
              <div className="value">{tes.cop_actual}</div>
              <div className="label">Actual COP</div>
            </div>
          </div>

          <div className="grid-3">
            <div className="card kpi-card">
              <div className="value" style={{ color: "var(--accent-solar)" }}>{tes.cop_carnot}</div>
              <div className="label">Carnot COP</div>
            </div>
            <div className="card kpi-card">
              <div className="value" style={{ color: "var(--accent-ice)" }}>{tes.slr}</div>
              <div className="label">SLR (Sensible/Latent)</div>
            </div>
            <div className="card kpi-card">
              <div className="value" style={{ color: "var(--text-primary)" }}>{tes.charging_window}</div>
              <div className="label">Charging Window</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h3>Waterfall Discharge by Tier</h3>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={tierData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="tier" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                    <Legend />
                    <Bar dataKey="ice_kg" fill="#38bdf8" name="Ice (kg)" />
                    <Bar dataKey="discharge_kwh" fill="#f59e0b" name="Discharge (kWh)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>30-Day Coverage Trend</h3>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={coverageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                    <Line type="monotone" dataKey="coverage_pct" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {dischargeData.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>Per-Hall Discharge Schedule ({dischargeData.length} halls)</h3>
              </div>
              <table>
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
                      <td>{d.hall}</td>
                      <td>
                        <span style={{ color: TIER_COLORS[d.tier], fontWeight: 600 }}>
                          {d.tier}
                        </span>
                      </td>
                      <td>{d.ice_kg?.toLocaleString()}</td>
                      <td>{d.discharge_kwh?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
