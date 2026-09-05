import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { getMe } from "./api/client";
import ForecastDashboard from "./pages/ForecastDashboard";
import TESDashboard from "./pages/TESDashboard";
import TelemetryDashboard from "./pages/TelemetryDashboard";
import SolarPolicyDashboard from "./pages/SolarPolicyDashboard";
import LoginPage from "./pages/LoginPage";
import ChatWidget from "./components/ChatWidget";
import "./App.css";

function Sidebar({ user, onLogout }) {
  const location = useLocation();
  const links = [
    { to: "/", label: "Forecast Dashboard", icon: "☀" },
    { to: "/tes", label: "Ice TES Sizing", icon: "❄" },
    { to: "/telemetry", label: "Telemetry", icon: "📡" },
    { to: "/policy", label: "Solar Policy", icon: "📊" },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <h1>Urjasetu</h1>
        <p>Solar + Ice TES Platform</p>
      </div>
      <ul className="sidebar-nav">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className={location.pathname === link.to ? "active" : ""}
            >
              <span>{link.icon}</span> {link.label}
            </Link>
          </li>
        ))}
      </ul>
      {user && (
        <div className="sidebar-user">
          <p>{user.name}</p>
          <button onClick={onLogout} className="btn btn-secondary btn-sm">
            Logout
          </button>
        </div>
      )}
    </nav>
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

  const handleLogin = (userData) => {
    setUser(userData.user);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="app loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <BrowserRouter>
        <LoginPage onLogin={handleLogin} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
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
