import React, { useState, useEffect, useRef } from "react";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tariff", label: "Tariff & Compensation" },
  { id: "subsidy", label: "Subsidies & Design" },
  { id: "behavior", label: "Consumer Behavior" },
  { id: "rl", label: "RL & Energy Trading" },
  { id: "battery", label: "Battery & Storage" },
  { id: "trends", label: "State Trends" },
];

const COLORS = {
  blue: "#185FA5", green: "#1D9E75", orange: "#EF9F27",
  red: "#E24B4A", purple: "#8b5cf6", gray: "#888780",
  teal: "#0F6E56", light: "#B5D4F4",
};

// ── Shared chart options ──
const baseOpts = (yLabel) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { font: { size: 10 } } },
    y: { title: { display: !!yLabel, text: yLabel || "", font: { size: 10 } }, ticks: { font: { size: 9 } } },
  },
});

// ──────────────────────────────── OVERVIEW TAB ────────────────────────────────
function OverviewTab() {
  const trendData = {
    labels: ["FY18", "FY19", "FY20", "FY21", "FY22", "FY23", "FY24", "FY25"],
    datasets: [
      { label: "Under PMSGY", data: [0, 0, 0, 0, 0, 0, 800, 4900], backgroundColor: COLORS.green },
      { label: "Other", data: [350, 520, 640, 720, 1100, 1800, 2200, 1200], backgroundColor: COLORS.light },
    ],
  };

  const stakeData = {
    labels: ["Prosumers", "RESCO developers", "Grid stability", "Env. benefits", "DISCOM (net)"],
    datasets: [{ data: [38, 22, 18, 14, 8], backgroundColor: [COLORS.blue, COLORS.green, COLORS.orange, "#639922", COLORS.gray], borderWidth: 0 }],
  };

  const states = [
    { name: "Gujarat", pct: 95 }, { name: "Kerala", pct: 68 },
    { name: "Maharashtra", pct: 55 }, { name: "Rajasthan", pct: 45 },
    { name: "Tamil Nadu", pct: 38 },
  ];
  const barriers = [
    { name: "High upfront cost", pct: 88, color: COLORS.red },
    { name: "Awareness gap", pct: 74, color: COLORS.red },
    { name: "DISCOM delays", pct: 68, color: COLORS.orange },
    { name: "Regulatory uncertainty", pct: 62, color: COLORS.orange },
    { name: "Credit access", pct: 55, color: COLORS.green },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { l: "Total RTS potential", v: "200+ GW", s: "Technical rooftop capacity" },
          { l: "Installed (2025)", v: "16.3 GW", s: "8% of potential realized" },
          { l: "PMSGY target", v: "30 GW", s: "By FY2027, ₹75,021 Cr" },
          { l: "PMSGY conversion", v: "22.7%", s: "Application → installation" },
        ].map((m) => (
          <div key={m.l} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{m.v}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.s}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Annual installation trend (MW)</div>
          <div style={{ height: 200 }}><Bar data={trendData} options={{ ...baseOpts("MW installed"), scales: { ...baseOpts("").scales, x: { stacked: true }, y: { stacked: true, title: { display: true, text: "MW installed", font: { size: 10 } } } } }} /></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Stakeholder benefit distribution</div>
          <div style={{ height: 200 }}><Doughnut data={stakeData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} /></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, borderLeft: `3px solid ${COLORS.blue}`, background: "var(--bg-card)" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          <strong>Key finding:</strong> Commercial & industrial segments dominated historically. PMSGY (Feb 2024) catalyzed residential adoption but only 22.7% of applications convert to installations — pointing to supply-side bottlenecks, not just demand gaps.
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Three metering types (UP policy)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#E6F1FB", color: "#0C447C", width: "fit-content" }}>Net metering — LMV-1 & LMV-5 only</span>
            <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#EAF3DE", color: "#27500A", width: "fit-content" }}>Gross metering — All categories, FiT rate</span>
            <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#FAEEDA", color: "#633806", width: "fit-content" }}>Net billing — Industrial & commercial</span>
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Top 5 state performers</div>
          {states.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0", fontSize: 12 }}>
              <span style={{ width: 100, textAlign: "right", color: "var(--text-secondary)", fontSize: 11 }}>{s.name}</span>
              <div style={{ flex: 1, background: "var(--bg-primary)", borderRadius: 3, height: 14, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${s.pct}%`, background: COLORS.blue, borderRadius: 3 }} />
              </div>
              <span style={{ width: 36, fontWeight: 500, fontSize: 11 }}>{s.pct}%</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Key barriers (weighted)</div>
          {barriers.map((b) => (
            <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0", fontSize: 12 }}>
              <span style={{ width: 110, textAlign: "right", color: "var(--text-secondary)", fontSize: 11 }}>{b.name}</span>
              <div style={{ flex: 1, background: "var(--bg-primary)", borderRadius: 3, height: 14, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${b.pct}%`, background: b.color, borderRadius: 3 }} />
              </div>
              <span style={{ width: 36, fontWeight: 500, fontSize: 11 }}>{b.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────── TARIFF TAB ────────────────────────────────
function TariffTab() {
  const nemData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      { label: "DER production", data: Array.from({ length: 24 }, (_, i) => Math.max(0, Math.sin((i - 6) * Math.PI / 12) * 100)), borderColor: COLORS.orange, backgroundColor: "rgba(239,159,39,0.1)", fill: true, tension: 0.4, pointRadius: 0 },
      { label: "Lower threshold", data: Array(24).fill(25), borderColor: COLORS.red, borderDash: [4, 4], pointRadius: 0 },
      { label: "Upper threshold", data: Array(24).fill(75), borderColor: COLORS.blue, borderDash: [4, 4], pointRadius: 0 },
    ],
  };

  const crossData = {
    labels: ["NEM 1.0", "NEM 2.0", "Net billing", "Gross metering", "NEM X"],
    datasets: [{ label: "Cross-subsidy", data: [420, 280, 150, 60, 85], backgroundColor: [COLORS.red, COLORS.orange, COLORS.green, COLORS.teal, COLORS.blue] }],
  };

  const tariffTypes = [
    { type: "NEM 1.0", benefit: "Prosumers strongly", risk: "High (death spiral)", incentive: "Very high", color: COLORS.blue },
    { type: "Net Billing", benefit: "Balanced", risk: "Low-medium", incentive: "Medium", color: COLORS.green },
    { type: "Gross Metering", benefit: "Grid operators", risk: "Low", incentive: "Low (FiT dependent)", color: COLORS.orange },
    { type: "TOU rates", benefit: "Flexible consumers", risk: "Low", incentive: "High (peak hours)", color: COLORS.teal },
    { type: "NEM X", benefit: "Social welfare max", risk: "Constrained", incentive: "Optimal via RL", color: COLORS.purple },
  ];

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Prosumer optimal decision modes (NEM X)</div>
          <div style={{ height: 220 }}><Line data={nemData} options={{ ...baseOpts("% of capacity"), plugins: { legend: { display: false } } }} /></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Tariff model comparison</div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead><tr>{["Tariff type", "Who benefits", "Utility risk", "Prosumer incentive"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", background: "var(--bg-primary)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{h}</th>)}</tr></thead>
            <tbody>
              {tariffTypes.map((t) => (
                <tr key={t.type}>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}><span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: t.color + "22", color: t.color }}>{t.type}</span></td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{t.benefit}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{t.risk}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{t.incentive}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="insight-box" style={{ marginTop: 12 }}>
            Death spiral risk: NEM 1.0 creates positive feedback — prosumer savings → utility revenue loss → tariff hike → more rooftop adoption → further revenue loss. NEM X uses Ramsey pricing to break this cycle.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Cross-subsidy flow under different NEM policies</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#FCEBEB", color: "#791F1F" }}>Non-solar consumers</span>
          <span style={{ color: "var(--text-tertiary)" }}>→ subsidize →</span>
          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#EAF3DE", color: "#27500A" }}>Prosumers (NEM 1.0)</span>
          <span style={{ color: "var(--text-tertiary)" }}>→ leads to →</span>
          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#FAEEDA", color: "#633806" }}>Fairness concern</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#E6F1FB", color: "#0C447C" }}>NEM X / Net Billing</span>
          <span style={{ color: "var(--text-tertiary)" }}>→ retail rate ≠ sell rate →</span>
          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#EEEDFE", color: "#3C3489" }}>Reduced cross-subsidy</span>
          <span style={{ color: "var(--text-tertiary)" }}>→ achieves →</span>
          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, background: "#EAF3DE", color: "#27500A" }}>Revenue break-even</span>
        </div>
        <div style={{ height: 180, marginTop: 12 }}><Bar data={crossData} options={baseOpts("₹/MWh cross-subsidy")} /></div>
      </div>
    </div>
  );
}

// ──────────────────────────────── SUBSIDY TAB ────────────────────────────────
function SubsidyTab() {
  const subData = {
    labels: ["₹10k", "₹20k", "₹30k", "₹50k", "₹75k", "₹1L"],
    datasets: [
      { label: "Time to 50% target (months)", data: [84, 60, 48, 36, 28, 22], borderColor: COLORS.blue, tension: 0.4, yAxisID: "y" },
      { label: "Total subsidy cost (Cr)", data: [1200, 1800, 2400, 3500, 4800, 6200], borderColor: COLORS.red, tension: 0.4, yAxisID: "y1" },
    ],
  };

  const incomeData = {
    labels: ["Q1 (lowest)", "Q2", "Q3", "Q4", "Q5 (highest)"],
    datasets: [
      { label: "Rooftop", data: [8, 15, 28, 48, 72], backgroundColor: COLORS.blue },
      { label: "Community solar", data: [32, 38, 30, 22, 12], backgroundColor: COLORS.green },
    ],
  };

  const stateTable = [
    { state: "Gujarat", sub: "₹10,000–20,000", rank: "Top tier", conv: "65%+", badge: COLORS.green },
    { state: "Kerala", sub: "State supplement", rank: "High", conv: "65%+", badge: COLORS.green },
    { state: "Delhi", sub: "Direct capital subsidy", rank: "Medium-high", conv: "~35%", badge: COLORS.blue },
    { state: "Assam", sub: "Capital subsidy", rank: "Medium", conv: "~20%", badge: COLORS.blue },
    { state: "Uttar Pradesh", sub: "UPNEDA 3% fee", rank: "Medium-low", conv: "<20%", badge: COLORS.orange },
    { state: "West Bengal", sub: "Minimal", rank: "Low", conv: "<15%", badge: COLORS.red },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { l: "Central subsidy (1-2 kW)", v: "₹30,000", s: "PMSGY tier 1" },
          { l: "Central subsidy (2-3 kW)", v: "₹60,000", s: "PMSGY tier 2" },
          { l: "Avg payback period", v: "5–8 yrs", s: "3 kW system, varies by state" },
          { l: "Community solar impact", v: "30–40%", s: "Lower-income reach increase" },
        ].map((m) => (
          <div key={m.l} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{m.v}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.s}</div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Subsidy vs adoption speed tradeoff</div>
          <div style={{ height: 210 }}><Line data={subData} options={{ ...baseOpts("Months to target"), scales: { y: { title: { display: true, text: "Months", font: { size: 10 } } }, y1: { position: "right", title: { display: true, text: "Cost (Cr ₹)", font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } }} /></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Income-stratified adoption response</div>
          <div style={{ height: 210 }}><Bar data={incomeData} options={baseOpts("Adoption probability (%)")} /></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>State-level additional capital incentives</div>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead><tr>{["State", "Additional subsidy", "Policy strength", "Conversion", "Notes"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", background: "var(--bg-primary)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {stateTable.map((s) => (
              <tr key={s.state}>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{s.state}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}><span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, background: s.badge + "22", color: s.badge }}>{s.sub}</span></td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{s.rank}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{s.conv}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{s.state === "Gujarat" ? "Surya Gujarat program" : s.state === "Kerala" ? "Mature ecosystem" : s.state === "Delhi" ? "High awareness; delays" : s.state === "UP" ? "RESCO model promoted" : s.state === "West Bengal" ? "Poorly designed policies" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="insight-box" style={{ marginTop: 8 }}>
          Rayal et al. (2024): Optimal planner policy must simultaneously consider adoption level target, time target, and subsidy budget — treating them as substitutes leads to suboptimal outcomes. Community solar + rooftop solar dual-track reduces total subsidy cost by reaching both high and low income households.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────── BEHAVIOR TAB ────────────────────────────────
function BehaviorTab() {
  const predData = {
    labels: ["Perceived\nbenefits", "Behavioral\ncontrol", "Env.\nconcern", "Social\nnorm", "Novelty\nseeking", "Income", "Age"],
    datasets: [{ data: [0.52, 0.44, 0.38, 0.36, 0.31, 0.08, 0.05], backgroundColor: [COLORS.blue, COLORS.blue, COLORS.blue, COLORS.blue, COLORS.gray, COLORS.gray, COLORS.gray] }],
  };

  const bassData = {
    labels: Array.from({ length: 20 }, (_, i) => 2005 + i),
    datasets: [
      { label: "Innovators", data: [50, 70, 90, 110, 130, 140, 135, 125, 115, 100, 90, 80, 70, 60, 50, 45, 40, 35, 30, 25], borderColor: COLORS.blue, tension: 0.4, pointRadius: 0 },
      { label: "Imitators", data: [10, 30, 60, 120, 220, 380, 520, 680, 850, 980, 1100, 1180, 1250, 1280, 1300, 1290, 1270, 1240, 1200, 1150], borderColor: COLORS.green, tension: 0.4, pointRadius: 0 },
      { label: "Total", data: [60, 100, 150, 230, 350, 520, 655, 805, 965, 1080, 1190, 1260, 1320, 1340, 1350, 1335, 1310, 1275, 1230, 1175], borderColor: COLORS.red, tension: 0.4, pointRadius: 0 },
    ],
  };

  const economicFactors = [
    { badge: "blue", label: "Payback period", desc: "Primary financial signal" },
    { badge: "blue", label: "Electricity tariff", desc: "Higher tariff → faster ROI" },
    { badge: "blue", label: "Panel prices", desc: "Dropped 89% since 2010" },
    { badge: "blue", label: "Financing access", desc: "Collateral-free loans critical" },
    { badge: "blue", label: "Net metering rate", desc: "Sell rate sensitivity high" },
  ];
  const behavioralFactors = [
    { badge: "teal", label: "Perceived benefit", desc: "Strongest predictor (r=0.52)" },
    { badge: "teal", label: "Env. concern", desc: "Indirect via benefits" },
    { badge: "teal", label: "Social norm", desc: "Neighbor effect strong" },
    { badge: "teal", label: "Behavioral control", desc: "Self-efficacy in installation" },
    { badge: "teal", label: "Novelty seeking", desc: "Early adopter trait" },
  ];
  const diffusionParams = [
    { badge: "purple", label: "Innovation coeff p", desc: "~0.001–0.003" },
    { badge: "purple", label: "Imitation coeff q", desc: "~0.35–0.45" },
    { badge: "purple", label: "Market potential m", desc: "10M households" },
    { badge: "purple", label: "Govt incentive boost", desc: "+40–60% on q" },
    { badge: "purple", label: "Peak adoption year", desc: "2027–2029 est." },
  ];

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Predictors of solar adoption intention</div>
          <div style={{ height: 210 }}><Bar data={predData} options={{ ...baseOpts("Correlation r"), scales: { y: { min: 0, max: 0.7, title: { display: true, text: "Correlation r", font: { size: 10 } } }, x: { ticks: { font: { size: 9 } } } } }} /></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Adoption diffusion curve (Bass model fit)</div>
          <div style={{ height: 210 }}><Line data={bassData} options={{ ...baseOpts(""), scales: { x: { ticks: { maxTicksLimit: 6, font: { size: 10 } } }, y: { ticks: { callback: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v, font: { size: 9 } } } } }} /></div>
        </div>
      </div>
      <div className="grid-3" style={{ marginTop: 12 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Economic model factors</div>
          {economicFactors.map((f) => <div key={f.label} style={{ margin: "4px 0" }}><span className={`badge badge-${f.badge}`} style={{ marginRight: 6 }}>{f.label}</span>{f.desc}</div>)}
        </div>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Behavioral model factors</div>
          {behavioralFactors.map((f) => <div key={f.label} style={{ margin: "4px 0" }}><span className={`badge badge-${f.badge}`} style={{ marginRight: 6 }}>{f.label}</span>{f.desc}</div>)}
        </div>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Diffusion model parameters (India)</div>
          {diffusionParams.map((f) => <div key={f.label} style={{ margin: "4px 0" }}><span className={`badge badge-${f.badge}`} style={{ marginRight: 6 }}>{f.label}</span>{f.desc}</div>)}
        </div>
      </div>
      <div className="insight-box" style={{ marginTop: 12 }}>
        Schulte et al. (2021) meta-analysis: Socio-demographic variables (age, gender, income) are NOT significantly correlated with adoption intention — but perceived benefits are. Campaigns should focus on ROI messaging, not demographic targeting. Subjective norm (what neighbors do) has medium-large correlation, suggesting peer demonstration programs are effective.
      </div>
    </div>
  );
}

// ──────────────────────────────── RL TAB ────────────────────────────────
function RLTab() {
  const hrs = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const solar = hrs.map((_, i) => Math.max(0, Math.sin((i - 6) * Math.PI / 11) * 5));
  const action = solar.map((s) => (s < 1 ? 0 : s < 3.5 ? 1 : 2));

  const rlData = {
    labels: hrs,
    datasets: [
      { label: "Consume", data: action.map((a) => (a === 0 ? 1 : 0)), backgroundColor: COLORS.red },
      { label: "Store", data: action.map((a) => (a === 1 ? 1 : 0)), backgroundColor: COLORS.green },
      { label: "Sell", data: action.map((a) => (a === 2 ? 1 : 0)), backgroundColor: COLORS.blue },
    ],
  };

  const savingsData = {
    labels: ["1 kW", "2 kW", "3 kW", "5 kW", "10 kW"],
    datasets: [
      { label: "Naive", data: [280, 520, 750, 1100, 1900], backgroundColor: COLORS.gray },
      { label: "RL optimized", data: [380, 720, 1050, 1580, 2850], backgroundColor: COLORS.blue },
    ],
  };

  const load = [3.2, 2.8, 2.5, 2.2, 2.0, 2.1, 2.8, 4.2, 5.8, 6.2, 6.0, 5.8, 5.5, 5.2, 5.0, 5.2, 5.8, 7.2, 8.5, 8.0, 7.0, 5.8, 4.8, 3.8];
  const rlLoad = [3.2, 2.8, 2.5, 2.2, 2.0, 2.1, 2.8, 4.0, 4.5, 4.8, 4.6, 4.5, 5.0, 5.2, 5.0, 5.2, 5.5, 6.0, 6.8, 6.5, 5.8, 4.8, 4.0, 3.5];
  const drData = {
    labels: hrs,
    datasets: [
      { label: "Baseline", data: load, borderColor: COLORS.red, fill: true, backgroundColor: "rgba(226,75,74,0.08)", tension: 0.4, pointRadius: 0 },
      { label: "RL DR", data: rlLoad, borderColor: COLORS.blue, fill: true, backgroundColor: "rgba(24,95,165,0.08)", tension: 0.4, pointRadius: 0 },
    ],
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { icon: "⚡", lbl: "State space", val: "DER production, grid price, battery SoC, demand", color: COLORS.blue },
          { icon: "↔", lbl: "Action space", val: "Consume, store, sell, buy from grid", color: COLORS.green },
          { icon: "₹", lbl: "Reward", val: "Bill savings + export revenue – grid charges", color: COLORS.red },
          { icon: "📈", lbl: "Policy learned", val: "Optimal prosumer strategy per tariff regime", color: COLORS.orange },
        ].map((b) => (
          <div key={b.lbl} style={{ background: "var(--bg-primary)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 20, color: b.color }}>{b.icon}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{b.lbl}</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{b.val}</div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Prosumer RL policy: sell vs store vs consume</div>
          <div style={{ height: 220 }}><Bar data={rlData} options={{ scales: { x: { stacked: true }, y: { stacked: true, display: false } }, plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }} /></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Bill savings: RL policy vs baseline (₹/month)</div>
          <div style={{ height: 220 }}><Bar data={savingsData} options={baseOpts("₹/month savings")} /></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Energy trading flow — prosumer economy</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          {[
            { bg: "#FAEEDA", color: "#633806", label: "Solar panels", sub: "DER production" },
            { bg: "#EEEDFE", color: "#3C3489", label: "RL agent decides", sub: "store / sell / self-consume" },
            { bg: "#E1F5EE", color: "#085041", label: "Battery storage", sub: "Shift energy temporally" },
            { bg: "#E6F1FB", color: "#0C447C", label: "Grid (DISCOM)", sub: "Net metering / billing" },
            { bg: "#EAF3DE", color: "#27500A", label: "Reward signal", sub: "Bill savings + export revenue" },
          ].map((n, i, arr) => (
            <React.Fragment key={n.label}>
              <div style={{ textAlign: "center" }}>
                <div style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: n.bg, color: n.color }}>{n.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{n.sub}</div>
              </div>
              {i < arr.length - 1 && <span style={{ fontSize: 20, color: "var(--text-tertiary)" }}>→</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="insight-box" style={{ marginTop: 12 }}>
          Under TOU rates, RL agents learn to: (1) prioritize self-consumption during peak hours, (2) store excess in batteries for evening peak, (3) sell surplus to grid only when sell rate > storage opportunity cost.
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Demand response — grid-level RL outcomes</div>
        <div style={{ height: 160 }}><Line data={drData} options={baseOpts("Grid load (kW)")} /></div>
      </div>
    </div>
  );
}

// ──────────────────────────────── BATTERY TAB ────────────────────────────────
function BatteryTab() {
  const battData = {
    labels: ["2 kWh", "5 kWh", "10 kWh", "15 kWh", "20 kWh"],
    datasets: [
      { label: "Net metering 1.0", data: [2200, 4800, 8500, 11000, 12000], backgroundColor: COLORS.blue },
      { label: "Net billing", data: [3000, 6500, 11000, 14000, 16000], backgroundColor: COLORS.green },
      { label: "TOU rates", data: [4500, 9500, 16000, 21000, 24000], backgroundColor: COLORS.red },
    ],
  };

  const soc = [20, 18, 16, 15, 14, 13, 15, 20, 30, 55, 75, 88, 92, 90, 88, 85, 82, 78, 60, 35, 30, 28, 26, 24, 22];
  const irr = [0, 0, 0, 0, 0, 0, 5, 25, 55, 75, 90, 95, 95, 90, 75, 55, 30, 10, 2, 0, 0, 0, 0, 0, 0];
  const tariff = [8, 8, 7, 7, 7, 8, 9, 10, 10, 9, 8, 8, 8, 8, 8, 9, 10, 12, 14, 14, 12, 11, 10, 9, 8];
  const tMax = Math.max(...tariff), iMax = Math.max(...irr);

  const socData = {
    labels: Array.from({ length: 25 }, (_, i) => `${i}:00`),
    datasets: [
      { label: "Battery SoC", data: soc, borderColor: COLORS.blue, fill: true, backgroundColor: "rgba(24,95,165,0.1)", tension: 0.4, pointRadius: 0 },
      { label: "Solar gen", data: irr.map((v) => (v / iMax) * 100), borderColor: COLORS.orange, borderDash: [4, 4], tension: 0.4, pointRadius: 0 },
      { label: "Tariff", data: tariff.map((v) => (v / tMax) * 100), borderColor: COLORS.red, borderDash: [2, 4], tension: 0.4, pointRadius: 0 },
    ],
  };

  const measureRows = [
    { param: "Solar generation (kW)", sensor: "Smart inverter meter", freq: "5-min interval", use: "DER production state" },
    { param: "Grid import/export (kW)", sensor: "Bidirectional meter", freq: "5-min interval", use: "Net energy state" },
    { param: "Battery SoC (%)", sensor: "BMS telemetry", freq: "1-min interval", use: "Storage state" },
    { param: "Electricity tariff signal", sensor: "DISCOM API / ToU schedule", freq: "15-min / hourly", use: "Price signal for RL" },
    { param: "Building load (kW)", sensor: "Sub-metering by block", freq: "5-min interval", use: "Demand state" },
    { param: "Weather / irradiance", sensor: "Pyranometer or API", freq: "Hourly", use: "DER forecast" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { l: "Battery cost (2024)", v: "$120/kWh", s: "Down from $1,200 in 2010" },
          { l: "Self-sufficiency gain", v: "40–70%", s: "With 5–10 kWh battery" },
          { l: "Payback impact", v: "+2–4 yrs", s: "Battery extends payback period" },
          { l: "Optimal battery size", v: "0.8–1.2×", s: "Daily avg solar output (kWh)" },
        ].map((m) => (
          <div key={m.l} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.l}</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{m.v}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.s}</div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Battery storage value under different tariff regimes</div>
          <div style={{ height: 210 }}><Bar data={battData} options={baseOpts("Annual value (₹)")} /></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>RL-optimized charge/discharge cycles (24h)</div>
          <div style={{ height: 210 }}><Line data={socData} options={{ ...baseOpts("% normalized"), scales: { y: { min: 0, max: 100, title: { display: true, text: "% normalized", font: { size: 10 } } }, x: { ticks: { maxTicksLimit: 8, font: { size: 9 } } } } }} /></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Battery sizing for campus — measurement requirements</div>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead><tr>{["Measurement parameter", "Sensor / meter", "Frequency", "RL input use"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", background: "var(--bg-primary)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {measureRows.map((r) => (
              <tr key={r.param}>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{r.param}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{r.sensor}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{r.freq}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>{r.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="insight-box" style={{ marginTop: 8 }}>
          Campus implementation order: (1) Instrument with smart meters → (2) collect 3–6 months baseline data → (3) train RL model offline → (4) deploy online RL agent → (5) evaluate against DISCOM bills.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────── TRENDS TAB ────────────────────────────────
function TrendsTab() {
  const policyData = {
    labels: ["Gujarat", "AP", "Karnataka", "Telangana", "Maharashtra", "Rajasthan", "TN", "Delhi", "UP", "Punjab", "W Bengal"],
    datasets: [{ data: [92, 88, 85, 82, 75, 72, 68, 62, 45, 38, 32], backgroundColor: [92, 88, 85, 82, 75, 72, 68, 62, 45, 38, 32].map((v) => v >= 80 ? COLORS.blue : v >= 60 ? COLORS.green : v >= 40 ? COLORS.orange : COLORS.red) }],
  };

  const segData = {
    labels: ["FY18", "FY19", "FY20", "FY21", "FY22", "FY23", "FY24", "FY25"],
    datasets: [
      { label: "C&I share %", data: [82, 80, 78, 76, 74, 70, 62, 52], borderColor: COLORS.blue, fill: true, backgroundColor: "rgba(24,95,165,0.12)", tension: 0.4 },
      { label: "Residential share %", data: [18, 20, 22, 24, 26, 30, 38, 48], borderColor: COLORS.green, fill: true, backgroundColor: "rgba(29,158,117,0.12)", tension: 0.4 },
    ],
  };

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Policy strength index by state (ADBI)</div>
          <div style={{ height: 250 }}><Bar data={policyData} options={{ ...baseOpts("Policy strength (0-100)", true), indexAxis: "y", scales: { x: { max: 100, title: { display: true, text: "Policy strength (0-100)", font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } } }} /></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>C&I vs residential share over time</div>
          <div style={{ height: 250 }}><Line data={segData} options={{ ...baseOpts("% of installations"), scales: { y: { max: 100, title: { display: true, text: "% of installations", font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } } }} /></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Winners and losers analysis</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ background: "#EAF3DE", borderRadius: 8, padding: 12, border: "1px solid #C0DD97" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#27500A", marginBottom: 6 }}>Who benefits most</div>
            <div style={{ fontSize: 12, color: "#3B6D11", lineHeight: 1.7 }}>
              ✓ High-income homeowners (rooftop)<br />
              ✓ C&I consumers (higher tariffs = faster ROI)<br />
              ✓ Gujarat, Kerala consumers (mature ecosystem)<br />
              ✓ RESCO developers (OPEX model growth)<br />
              ✓ Grid (peak shaving from storage)<br />
              ✓ Prosumers under NEM 1.0 (cross-subsidy)
            </div>
          </div>
          <div style={{ background: "#FCEBEB", borderRadius: 8, padding: 12, border: "1px solid #F7C1C1" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#791F1F", marginBottom: 6 }}>Who is left behind</div>
            <div style={{ fontSize: 12, color: "#A32D2D", lineHeight: 1.7 }}>
              ✗ Low-income renters (can't install)<br />
              ✗ Apartment dwellers (shared roof issue)<br />
              ✗ UP, Bihar consumers (weak policy)<br />
              ✗ Non-solar consumers (pay cross-subsidy)<br />
              ✗ Agricultural consumers (grid burden)<br />
              ✗ DISCOM utilities (revenue loss risk)
            </div>
          </div>
          <div style={{ background: "#FAEEDA", borderRadius: 8, padding: 12, border: "1px solid #FAC775" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#633806", marginBottom: 6 }}>Emerging opportunities</div>
            <div style={{ fontSize: 12, color: "#854F0B", lineHeight: 1.7 }}>
              → Community solar for renters<br />
              → Virtual net metering for apartments<br />
              → RL-driven peer-to-peer trading<br />
              → RESCO/OPEX lowers upfront barrier<br />
              → Battery + solar for prosumer arbitrage<br />
              → DISCOM performance incentives
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Research gaps — your RL study can fill these</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="insight-box">No RL study exists for India-specific tariff structures (NEM + TOU + net billing mix) — direct research gap your campus data can address.</div>
          <div className="insight-box">Battery + solar + demand response jointly optimized under PMSGY subsidy framework not yet modeled — high publication potential.</div>
          <div className="insight-box">Consumer behavioral response to RL-informed dynamic pricing not studied in India context — combines diffusion model + RL.</div>
          <div className="insight-box">Cross-subsidy welfare analysis under NEM X for Indian income inequality (Gini 0.35) — directly applicable to UPERC consultation paper findings.</div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────── MAIN DASHBOARD ────────────────────────────────
export default function SolarPolicyDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab />;
      case "tariff": return <TariffTab />;
      case "subsidy": return <SubsidyTab />;
      case "behavior": return <BehaviorTab />;
      case "rl": return <RLTab />;
      case "battery": return <BatteryTab />;
      case "trends": return <TrendsTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>India Rooftop Solar Policy Analysis</h2>
        <p>Synthesis from 18 research papers — compensation, subsidies, tariff design, battery storage, energy trading, and consumer behavior</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "6px 14px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 20, cursor: "pointer",
            background: activeTab === tab.id ? COLORS.blue : "var(--bg-card)",
            color: activeTab === tab.id ? "#E6F1FB" : "var(--text-secondary)",
            borderColor: activeTab === tab.id ? COLORS.blue : "var(--border)", transition: "all 0.15s"
          }}>{tab.label}</button>
        ))}
      </div>
      {renderTab()}
    </div>
  );
}
