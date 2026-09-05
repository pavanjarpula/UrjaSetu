import React, { useState, useEffect } from "react";
import { getWeatherData } from "../api/client";

const WEATHER_VARS = [
  // Temperature & Comfort
  { key: "temperature_2m", label: "Temperature", unit: "°C", icon: "🌡️", category: "Temperature & Comfort", color: "#ef4444" },
  { key: "relative_humidity_2m", label: "Humidity", unit: "%", icon: "💧", category: "Temperature & Comfort", color: "#38bdf8" },
  { key: "dew_point_2m", label: "Dew Point", unit: "°C", icon: "💦", category: "Temperature & Comfort", color: "#06b6d4" },
  { key: "apparent_temperature", label: "Feels Like", unit: "°C", icon: "🤒", category: "Temperature & Comfort", color: "#f97316" },

  // Clouds
  { key: "cloud_cover", label: "Cloud Cover", unit: "%", icon: "☁️", category: "Clouds", color: "#94a3b8" },
  { key: "cloud_cover_low", label: "Low Clouds", unit: "%", icon: "☁️", category: "Clouds", color: "#64748b" },
  { key: "cloud_cover_mid", label: "Mid Clouds", unit: "%", icon: "⛅", category: "Clouds", color: "#94a3b8" },
  { key: "cloud_cover_high", label: "High Clouds", unit: "%", icon: "🌤️", category: "Clouds", color: "#cbd5e1" },

  // Precipitation
  { key: "precipitation", label: "Precipitation", unit: "mm", icon: "🌧️", category: "Precipitation", color: "#3b82f6" },
  { key: "rain", label: "Rain", unit: "mm", icon: "🌧️", category: "Precipitation", color: "#2563eb" },
  { key: "snowfall", label: "Snowfall", unit: "cm", icon: "❄️", category: "Precipitation", color: "#e2e8f0" },

  // Wind
  { key: "wind_speed_10m", label: "Wind Speed", unit: "km/h", icon: "💨", category: "Wind", color: "#10b981" },
  { key: "wind_direction_10m", label: "Wind Direction", unit: "°", icon: "🧭", category: "Wind", color: "#14b8a6" },
  { key: "wind_gusts_10m", label: "Wind Gusts", unit: "km/h", icon: "🌬️", category: "Wind", color: "#059669" },

  // Radiation (Solar)
  { key: "shortwave_radiation", label: "Shortwave Rad.", unit: "W/m²", icon: "☀️", category: "Solar Radiation", color: "#f59e0b" },
  { key: "direct_radiation", label: "Direct Rad.", unit: "W/m²", icon: "🔆", category: "Solar Radiation", color: "#d97706" },
  { key: "direct_normal_irradiance", label: "DNI", unit: "W/m²", icon: "📡", category: "Solar Radiation", color: "#fbbf24" },
  { key: "diffuse_radiation", label: "Diffuse Rad.", unit: "W/m²", icon: "🌤️", category: "Solar Radiation", color: "#fcd34d" },
  { key: "global_tilted_irradiance", label: "GTI", unit: "W/m²", icon: "📐", category: "Solar Radiation", color: "#f97316" },

  // Pressure
  { key: "surface_pressure", label: "Pressure", unit: "hPa", icon: "📊", category: "Pressure", color: "#8b5cf6" },

  // Ground
  { key: "soil_temperature_6cm", label: "Soil Temp (6cm)", unit: "°C", icon: "🌍", category: "Ground", color: "#78350f" },
];

const CATEGORIES = [...new Set(WEATHER_VARS.map(v => v.category))];

function windDirection(degrees) {
  if (degrees == null) return "—";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(degrees / 22.5) % 16];
}

function sunriseSunset() {
  // IIT Kharagpur approximate sunrise/sunset
  return { sunrise: "05:35", sunset: "18:10" };
}

export default function WeatherPanel({ date }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    setError(null);
    getWeatherData(date)
      .then(data => setWeather(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) {
    return (
      <div className="card mb-6" style={{ borderLeft: "3px solid #38bdf8" }}>
        <div className="loading-container" style={{ padding: "2rem" }}>
          <div className="spinner spinner-sm" />
          <div className="loading-text">Fetching weather data from Open-Meteo...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card mb-6" style={{ borderLeft: "3px solid #ef4444" }}>
        <div style={{ padding: "1rem 1.25rem", color: "#ef4444", fontSize: 13 }}>
          Weather data unavailable: {error}
        </div>
      </div>
    );
  }

  if (!weather?.hourly) return null;

  const hourly = weather.hourly;
  const times = hourly.time || [];
  const ss = sunriseSunset();

  // Get current hour index (or midday if outside range)
  const now = new Date();
  const currentHour = now.getHours();
  const midIdx = Math.min(
    times.findIndex(t => new Date(t).getHours() === currentHour),
    times.length - 1
  );
  const idx = midIdx >= 0 ? midIdx : Math.floor(times.length / 2);

  const getValue = (key) => {
    const arr = hourly[key];
    if (!arr || arr.length === 0) return null;
    return arr[idx];
  };

  const formatValue = (val, v) => {
    if (val == null) return "—";
    if (v.key === "wind_direction_10m") return windDirection(val);
    if (v.key.includes("cover") || v.key.includes("humidity")) return Math.round(val);
    if (v.key.includes("precipitation") || v.key.includes("rain") || v.key.includes("snowfall")) return val.toFixed(1);
    return typeof val === "number" ? val.toFixed(1) : val;
  };

  // Daily summary
  const daily = weather.daily;
  const dailyTempMax = daily?.temperature_2m_max?.[0];
  const dailyTempMin = daily?.temperature_2m_min?.[0];
  const dailyPrecip = daily?.precipitation_sum?.[0];
  const dailyRadiation = daily?.shortwave_radiation_sum?.[0];
  const dailyUV = daily?.uv_index_max?.[0];
  const dailyWindMax = daily?.wind_speed_10m_max?.[0];

  return (
    <div className="card mb-6" style={{ borderLeft: "3px solid #38bdf8" }}>
      <div className="card-header">
        <div>
          <div className="card-title">🌤️ Live Weather — Open-Meteo</div>
          <div className="card-subtitle">
            IIT Kharagpur ({weather.latitude}°N, {weather.longitude}°E) · {date} · IST
          </div>
        </div>
        <span className="badge badge-ice">{WEATHER_VARS.length} variables</span>
      </div>

      {/* Daily summary strip */}
      <div style={{
        display: "flex", gap: 12, flexWrap: "wrap", padding: "0 0 12px",
        borderBottom: "1px solid #1f1f1f", marginBottom: 16,
      }}>
        {dailyTempMax != null && (
          <div style={dailyPillStyle}>
            <span>🌡️</span> High {dailyTempMax.toFixed(1)}° / Low {dailyTempMin?.toFixed(1)}°
          </div>
        )}
        {dailyPrecip != null && (
          <div style={dailyPillStyle}>
            <span>🌧️</span> {dailyPrecip.toFixed(1)} mm rain
          </div>
        )}
        {dailyRadiation != null && (
          <div style={dailyPillStyle}>
            <span>☀️</span> {dailyRadiation.toFixed(0)} W/m² sum
          </div>
        )}
        {dailyUV != null && (
          <div style={dailyPillStyle}>
            <span>🔆</span> UV {dailyUV.toFixed(1)}
          </div>
        )}
        {dailyWindMax != null && (
          <div style={dailyPillStyle}>
            <span>💨</span> {dailyWindMax.toFixed(0)} km/h max
          </div>
        )}
        <div style={dailyPillStyle}>
          <span>🌅</span> {ss.sunrise} — {ss.sunset}
        </div>
      </div>

      {/* Hourly variable cards grouped by category */}
      {CATEGORIES.map(cat => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#737373",
            textTransform: "uppercase", letterSpacing: "0.05em",
            marginBottom: 8, paddingLeft: 4,
          }}>{cat}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
            {WEATHER_VARS.filter(v => v.category === cat).map(v => {
              const val = getValue(v.key);
              return (
                <div key={v.key} style={{
                  background: "#0d0d0d", border: "1px solid #1f1f1f",
                  borderRadius: 8, padding: "10px 8px", textAlign: "center",
                  transition: "all 0.15s", cursor: "default",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = v.color; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1f1f1f"; e.currentTarget.style.transform = "none"; }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{v.icon}</div>
                  <div style={{ fontSize: 10, color: "#737373", textTransform: "uppercase", letterSpacing: "0.03em" }}>{v.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: v.color, marginTop: 2 }}>
                    {formatValue(val, v)}
                  </div>
                  <div style={{ fontSize: 10, color: "#525252" }}>{v.unit}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Hourly timeline for key variables */}
      <div style={{ marginTop: 16, borderTop: "1px solid #1f1f1f", paddingTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Hourly Timeline (key variables)
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={thStyle}>Hour</th>
                <th style={thStyle}>🌡️ Temp</th>
                <th style={thStyle}>☁️ Cloud</th>
                <th style={thStyle}>☀️ Rad</th>
                <th style={thStyle}>💨 Wind</th>
                <th style={thStyle}>💧 Hum</th>
                <th style={thStyle}>🌧️ Rain</th>
                <th style={thStyle}>📊 Press</th>
              </tr>
            </thead>
            <tbody>
              {times.map((t, i) => {
                const hr = new Date(t).getHours();
                if (hr < 4 || hr > 19) return null;
                const isNow = hr === currentHour;
                return (
                  <tr key={i} style={{ background: isNow ? "rgba(245,158,11,0.08)" : "transparent" }}>
                    <td style={{ ...tdStyle, fontWeight: isNow ? 700 : 400, color: isNow ? "#f59e0b" : "#a3a3a3" }}>
                      {String(hr).padStart(2, "0")}:00
                    </td>
                    <td style={tdStyle}>{getValue("temperature_2m") != null ? hourly.temperature_2m[i]?.toFixed(1) : "—"}°</td>
                    <td style={tdStyle}>{Math.round(hourly.cloud_cover?.[i] || 0)}%</td>
                    <td style={tdStyle}>{Math.round(hourly.shortwave_radiation?.[i] || 0)}</td>
                    <td style={tdStyle}>{(hourly.wind_speed_10m?.[i] || 0).toFixed(1)}</td>
                    <td style={tdStyle}>{Math.round(hourly.relative_humidity_2m?.[i] || 0)}%</td>
                    <td style={tdStyle}>{(hourly.precipitation?.[i] || 0).toFixed(1)}</td>
                    <td style={tdStyle}>{Math.round(hourly.surface_pressure?.[i] || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const dailyPillStyle = {
  display: "flex", alignItems: "center", gap: 4,
  padding: "4px 10px", borderRadius: 20,
  background: "#171717", border: "1px solid #1f1f1f",
  fontSize: 12, color: "#a3a3a3",
};

const thStyle = {
  textAlign: "left", padding: "6px 8px",
  background: "#0d0d0d", color: "#737373",
  fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.03em", borderBottom: "1px solid #1f1f1f",
  whiteSpace: "nowrap", fontSize: 10,
};

const tdStyle = {
  padding: "5px 8px", borderBottom: "1px solid #1a1a1a",
  color: "#a3a3a3", whiteSpace: "nowrap",
};
