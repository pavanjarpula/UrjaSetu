import React, { useState, useEffect } from "react";
import { getWeatherData } from "../api/client";

const WEATHER_VARS = [
  { key: "temperature_2m", label: "Temp", unit: "°C", icon: "🌡️", category: "Temp & Comfort", color: "#ef4444" },
  { key: "relative_humidity_2m", label: "Humidity", unit: "%", icon: "💧", category: "Temp & Comfort", color: "#38bdf8" },
  { key: "dew_point_2m", label: "Dew Pt", unit: "°C", icon: "💦", category: "Temp & Comfort", color: "#06b6d4" },
  { key: "apparent_temperature", label: "Feels Like", unit: "°C", icon: "🤒", category: "Temp & Comfort", color: "#f97316" },
  { key: "cloud_cover", label: "Cloud", unit: "%", icon: "☁️", category: "Clouds", color: "#94a3b8" },
  { key: "cloud_cover_low", label: "Low", unit: "%", icon: "☁️", category: "Clouds", color: "#64748b" },
  { key: "cloud_cover_mid", label: "Mid", unit: "%", icon: "⛅", category: "Clouds", color: "#94a3b8" },
  { key: "cloud_cover_high", label: "High", unit: "%", icon: "🌤️", category: "Clouds", color: "#cbd5e1" },
  { key: "precipitation", label: "Precip", unit: "mm", icon: "🌧️", category: "Precip & Wind", color: "#3b82f6" },
  { key: "rain", label: "Rain", unit: "mm", icon: "🌧️", category: "Precip & Wind", color: "#2563eb" },
  { key: "snowfall", label: "Snow", unit: "cm", icon: "❄️", category: "Precip & Wind", color: "#e2e8f0" },
  { key: "wind_speed_10m", label: "Wind", unit: "km/h", icon: "💨", category: "Precip & Wind", color: "#10b981" },
  { key: "wind_direction_10m", label: "WDir", unit: "°", icon: "🧭", category: "Precip & Wind", color: "#14b8a6" },
  { key: "wind_gusts_10m", label: "Gusts", unit: "km/h", icon: "🌬️", category: "Precip & Wind", color: "#059669" },
  { key: "shortwave_radiation", label: "SW Rad", unit: "W/m²", icon: "☀️", category: "Solar Radiation", color: "#f59e0b" },
  { key: "direct_radiation", label: "Direct", unit: "W/m²", icon: "🔆", category: "Solar Radiation", color: "#d97706" },
  { key: "direct_normal_irradiance", label: "DNI", unit: "W/m²", icon: "📡", category: "Solar Radiation", color: "#fbbf24" },
  { key: "diffuse_radiation", label: "Diffuse", unit: "W/m²", icon: "🌤️", category: "Solar Radiation", color: "#fcd34d" },
  { key: "global_tilted_irradiance", label: "GTI", unit: "W/m²", icon: "📐", category: "Solar Radiation", color: "#f97316" },
  { key: "surface_pressure", label: "Pressure", unit: "hPa", icon: "📊", category: "Misc", color: "#8b5cf6" },
  { key: "soil_temperature_6cm", label: "Soil Temp", unit: "°C", icon: "🌍", category: "Misc", color: "#78350f" },
];

const CATEGORIES = [...new Set(WEATHER_VARS.map(v => v.category))];

function windDir(d) {
  if (d == null) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(d / 22.5) % 16];
}

export default function WeatherPanel({ date }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    setError(null);
    getWeatherData(date)
      .then(data => setWeather(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  const toggleCat = (c) => setOpenCats(prev => ({ ...prev, [c]: !prev[c] }));

  if (loading) return (
    <div className="card mb-6" style={{ borderLeft: "3px solid #38bdf8" }}>
      <div className="loading-container" style={{ padding: "1.25rem" }}>
        <div className="spinner spinner-sm" />
        <div className="loading-text">Fetching weather...</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="card mb-6" style={{ borderLeft: "3px solid #ef4444" }}>
      <div style={{ padding: "0.75rem 1rem", color: "#ef4444", fontSize: 12 }}>Weather unavailable: {error}</div>
    </div>
  );

  if (!weather?.hourly) return null;

  const hourly = weather.hourly;
  const times = hourly.time || [];
  const now = new Date();
  const curH = now.getHours();
  const midIdx = Math.min(times.findIndex(t => new Date(t).getHours() === curH), times.length - 1);
  const idx = midIdx >= 0 ? midIdx : Math.floor(times.length / 2);

  const val = (key) => { const a = hourly[key]; return a && a.length > 0 ? a[idx] : null; };
  const fmt = (v, vr) => {
    if (v == null) return "—";
    if (vr.key === "wind_direction_10m") return windDir(v);
    if (vr.key.includes("cover") || vr.key.includes("humidity")) return Math.round(v);
    return typeof v === "number" ? v.toFixed(1) : v;
  };

  const daily = weather.daily;
  const dMax = daily?.temperature_2m_max?.[0];
  const dMin = daily?.temperature_2m_min?.[0];
  const dPrecip = daily?.precipitation_sum?.[0];
  const dRad = daily?.shortwave_radiation_sum?.[0];
  const dUV = daily?.uv_index_max?.[0];
  const dWind = daily?.wind_speed_10m_max?.[0];

  return (
    <div className="card mb-6" style={{ borderLeft: "3px solid #38bdf8" }}>
      {/* Header — always visible, clickable to expand */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "0.75rem 1rem" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🌤️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#ececec" }}>Live Weather</div>
            <div style={{ fontSize: 10, color: "#737373" }}>
              IIT KGP · {date} · {WEATHER_VARS.length} variables
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Inline key stats when collapsed */}
          {!expanded && (
            <div style={{ display: "flex", gap: 8, marginRight: 8 }}>
              {dMax != null && <MiniStat icon="🌡️" value={`${dMax.toFixed(0)}°/${dMin?.toFixed(0)}°`} />}
              {dRad != null && <MiniStat icon="☀️" value={`${Math.round(dRad)} W`} />}
              {dWind != null && <MiniStat icon="💨" value={`${Math.round(dWind)} km/h`} />}
              {dPrecip != null && dPrecip > 0 && <MiniStat icon="🌧️" value={`${dPrecip.toFixed(1)} mm`} />}
            </div>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 1rem 0.75rem", borderTop: "1px solid #1a1a1a" }}>
          {/* Daily pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 0" }}>
            {dMax != null && <Pill>🌡️ {dMax.toFixed(1)}° / {dMin?.toFixed(1)}°</Pill>}
            {dPrecip != null && <Pill>🌧️ {dPrecip.toFixed(1)} mm</Pill>}
            {dRad != null && <Pill>☀️ {Math.round(dRad)} W/m²</Pill>}
            {dUV != null && <Pill>🔆 UV {dUV.toFixed(1)}</Pill>}
            {dWind != null && <Pill>💨 {Math.round(dWind)} km/h</Pill>}
          </div>

          {/* Category groups — collapsible */}
          {CATEGORIES.map(cat => {
            const isOpen = openCats[cat];
            const vars = WEATHER_VARS.filter(v => v.category === cat);
            return (
              <div key={cat} style={{ marginBottom: 4 }}>
                <div
                  onClick={() => toggleCat(cat)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "5px 8px", borderRadius: 6, cursor: "pointer",
                    background: isOpen ? "#1a1a1a" : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {cat} ({vars.length})
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#525252" strokeWidth="2" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {isOpen && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 0 6px" }}>
                    {vars.map(v => {
                      const value = val(v.key);
                      return (
                        <div key={v.key} style={{
                          background: "#0d0d0d", border: "1px solid #1f1f1f",
                          borderRadius: 6, padding: "6px 8px", textAlign: "center",
                          minWidth: 72, flex: "1 1 auto", maxWidth: 100,
                          transition: "border-color 0.15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = v.color}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "#1f1f1f"}
                        >
                          <div style={{ fontSize: 14 }}>{v.icon}</div>
                          <div style={{ fontSize: 9, color: "#737373", textTransform: "uppercase" }}>{v.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: v.color }}>{fmt(value, v)}</div>
                          <div style={{ fontSize: 9, color: "#525252" }}>{v.unit}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Hourly timeline — collapsible bar */}
          <div
            onClick={() => setShowTimeline(!showTimeline)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "5px 8px", borderRadius: 6, cursor: "pointer", marginTop: 4,
              background: showTimeline ? "#1a1a1a" : "transparent",
              border: "1px solid #1a1a1a", transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              📊 Hourly Timeline (04:00–19:00)
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#525252" strokeWidth="2" style={{ transform: showTimeline ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {showTimeline && (
            <div style={{ overflowX: "auto", marginTop: 4 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={thS}>Hr</th>
                    <th style={thS}>🌡️</th>
                    <th style={thS}>☁️</th>
                    <th style={thS}>☀️</th>
                    <th style={thS}>💨</th>
                    <th style={thS}>💧</th>
                    <th style={thS}>🌧️</th>
                    <th style={thS}>📊</th>
                  </tr>
                </thead>
                <tbody>
                  {times.map((t, i) => {
                    const hr = new Date(t).getHours();
                    if (hr < 4 || hr > 19) return null;
                    const isCur = hr === curH;
                    return (
                      <tr key={i} style={{ background: isCur ? "rgba(245,158,11,0.08)" : "transparent" }}>
                        <td style={{ ...tdS, fontWeight: isCur ? 700 : 400, color: isCur ? "#f59e0b" : "#a3a3a3" }}>{String(hr).padStart(2, "0")}</td>
                        <td style={tdS}>{hourly.temperature_2m?.[i]?.toFixed(1) ?? "—"}°</td>
                        <td style={tdS}>{Math.round(hourly.cloud_cover?.[i] || 0)}%</td>
                        <td style={tdS}>{Math.round(hourly.shortwave_radiation?.[i] || 0)}</td>
                        <td style={tdS}>{(hourly.wind_speed_10m?.[i] || 0).toFixed(1)}</td>
                        <td style={tdS}>{Math.round(hourly.relative_humidity_2m?.[i] || 0)}%</td>
                        <td style={tdS}>{(hourly.precipitation?.[i] || 0).toFixed(1)}</td>
                        <td style={tdS}>{Math.round(hourly.surface_pressure?.[i] || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MiniStat = ({ icon, value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 12, background: "#141414", border: "1px solid #1f1f1f", fontSize: 11, color: "#a3a3a3" }}>
    <span style={{ fontSize: 11 }}>{icon}</span> {value}
  </div>
);

const Pill = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 12, background: "#141414", border: "1px solid #1f1f1f", fontSize: 11, color: "#a3a3a3" }}>
    {children}
  </div>
);

const thS = {
  textAlign: "left", padding: "4px 6px", background: "#0a0a0a", color: "#525252",
  fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em",
  borderBottom: "1px solid #1a1a1a", whiteSpace: "nowrap", fontSize: 9,
};

const tdS = {
  padding: "3px 6px", borderBottom: "1px solid #141414",
  color: "#a3a3a3", whiteSpace: "nowrap",
};
