import React, { useState } from "react";
import { login, register } from "../api/client";

export default function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = isRegister
        ? await register(name, email, password)
        : await login(email, password);
      localStorage.setItem("token", data.token);
      onLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo">
          <h1>⚡ Urjasetu</h1>
          <p>Solar PV + Ice TES Intelligence Platform</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@iitkgp.ac.in"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "var(--color-red)", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="spinner spinner-sm" style={{ borderTopColor: "var(--text-inverse)" }} />
                {isRegister ? "Creating account..." : "Signing in..."}
              </span>
            ) : (
              isRegister ? "Create Account" : "Sign In"
            )}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
          >
            {isRegister ? "Already have an account? Sign in" : "New user? Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}
