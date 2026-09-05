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
  { to: "/", label: "Solar Forecast", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )},
  { to: "/tes", label: "Ice TES Sizing", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07M12 6l-2 2 2 2 2-2-2-2M6 12l2 2-2 2-2-2 2-2M18 12l-2 2 2 2 2-2-2-2M12 18l2-2-2-2-2 2 2 2"/>
    </svg>
  )},
  { to: "/telemetry", label: "Live Telemetry", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ), badge: "LIVE" },
  { section: "Research" },
  { to: "/policy", label: "Solar Policy RL", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  )},
];

function TopBar({ user, onLogout, onOpenChat }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 60000); return () => clearInterval(t); }, []);
  const timeStr = time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = time.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand-mobile">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span className="topbar-brand-name">Urjasetu</span>
        </div>
        <div className="topbar-time">
          <span className="topbar-time-value">{timeStr}</span>
          <span className="topbar-time-date">{dateStr}</span>
        </div>
      </div>
      <div className="topbar-right">
        <button onClick={onOpenChat} className="topbar-chat-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          AI Chat
        </button>
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
        <div className="sidebar-brand-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
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
  const [chatOpen, setChatOpen] = useState(false);

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
          <TopBar user={user} onLogout={handleLogout} onOpenChat={() => setChatOpen(true)} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<ForecastDashboard />} />
              <Route path="/tes" element={<TESDashboard />} />
              <Route path="/telemetry" element={<TelemetryDashboard />} />
              <Route path="/policy" element={<SolarPolicyDashboard />} />
            </Routes>
          </main>
        </div>

        {/* Chat FAB */}
        {!chatOpen && (
          <button className="chat-fab" onClick={() => setChatOpen(true)} title="Open AI Chat">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        )}

        {/* Full-page chat overlay */}
        {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />}
      </div>
    </BrowserRouter>
  );
}
