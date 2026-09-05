import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
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

function TopBar({ user, onLogout }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand-mobile">
          <span style={{ fontSize: 20 }}>⚡</span>
          <span className="topbar-brand-name">Urjasetu</span>
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-status">
          <span className="topbar-status-dot" />
          <span>System Online</span>
        </div>
        <div className="topbar-divider" />
        <div className="topbar-user">
          <div className="topbar-avatar">{user?.name?.charAt(0)?.toUpperCase() || "U"}</div>
          <div className="topbar-user-info">
            <div className="topbar-user-name">{user?.name || "User"}</div>
            <div className="topbar-user-role">{user?.role === "admin" ? "Admin" : "Operator"}</div>
          </div>
        </div>
        <button className="topbar-logout" onClick={onLogout} title="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  );
}

function Sidebar() {
  const location = useLocation();
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">⚡</div>
        <div className="sidebar-brand-text">
          <h1>Urjasetu</h1>
          <p>Solar + Ice TES Platform</p>
        </div>
      </div>
      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          if (item.section) return <div key={item.section} className="sidebar-section-label">{item.section}</div>;
          return (
            <Link key={item.to} to={item.to} className={`sidebar-link ${location.pathname === item.to ? "active" : ""}`}>
              <span className="sidebar-link-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <span className="sidebar-link-badge">{item.badge}</span>}
            </Link>
          );
        })}
      </div>
      <div className="sidebar-footer">
        <div className="sidebar-footer-brand">
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>v1.0.0 · IIT Kharagpur</span>
        </div>
      </div>
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
      getMe().then((data) => setUser(data.user)).catch(() => localStorage.removeItem("token")).finally(() => setLoading(false));
    } else { setLoading(false); }
  }, []);

  const handleLogin = (data) => setUser(data.user);
  const handleLogout = () => { localStorage.removeItem("token"); setUser(null); };

  if (loading) return <LoadingScreen />;
  if (!user) return <BrowserRouter><LoginPage onLogin={handleLogin} /></BrowserRouter>;

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <div className="main-area">
          <TopBar user={user} onLogout={handleLogout} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<ForecastDashboard />} />
              <Route path="/tes" element={<TESDashboard />} />
              <Route path="/telemetry" element={<TelemetryDashboard />} />
              <Route path="/policy" element={<SolarPolicyDashboard />} />
            </Routes>
          </main>
        </div>
        <ChatWidget />
      </div>
    </BrowserRouter>
  );
}
