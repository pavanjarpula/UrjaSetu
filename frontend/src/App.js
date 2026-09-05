import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { getMe } from "./api/client";
import ForecastDashboard from "./pages/ForecastDashboard";
import TESDashboard from "./pages/TESDashboard";
import TelemetryDashboard from "./pages/TelemetryDashboard";
import SolarPolicyDashboard from "./pages/SolarPolicyDashboard";
import LoginPage from "./pages/LoginPage";
import ChatWidget from "./components/ChatWidget";

const NAV_ITEMS = [
  { section: "Analytics" },
  { to: "/", label: "Solar Forecast", icon: "☀️" },
  { to: "/tes", label: "Ice TES Sizing", icon: "❄️" },
  { to: "/telemetry", label: "Live Telemetry", icon: "📡", badge: "LIVE" },
  { section: "Research" },
  { to: "/policy", label: "Solar Policy RL", icon: "📊" },
];

function Sidebar({ user, onLogout }) {
  const location = useLocation();

  return (
    <nav className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">⚡</div>
        <div className="sidebar-brand-text">
          <h1>Urjasetu</h1>
          <p>Solar + Ice TES Platform</p>
        </div>
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item, i) => {
          if (item.section) {
            return (
              <div key={item.section} className="sidebar-section-label">
                {item.section}
              </div>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-link ${location.pathname === item.to ? "active" : ""}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <span className="sidebar-link-badge">{item.badge}</span>}
            </Link>
          );
        })}
      </div>

      {user && (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user.name?.charAt(0)?.toUpperCase() || "U"}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-role">Operator</div>
            </div>
            <button onClick={onLogout} className="btn btn-ghost btn-icon" title="Logout">
              🚪
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-container" style={{ minHeight: "100vh" }}>
      <div className="spinner" />
      <div className="loading-text">Loading platform...</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      getMe()
        .then((data) => setUser(data.user))
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData) => setUser(userData.user);
  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <BrowserRouter>
        <LoginPage onLogin={handleLogin} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar user={user} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ForecastDashboard />} />
            <Route path="/tes" element={<TESDashboard />} />
            <Route path="/telemetry" element={<TelemetryDashboard />} />
            <Route path="/policy" element={<SolarPolicyDashboard />} />
          </Routes>
        </main>
        <ChatWidget />
      </div>
    </BrowserRouter>
  );
}
