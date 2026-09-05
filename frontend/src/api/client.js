// In production (Vercel), API calls go through /api/ proxy to Render backend
// In development, API calls go directly to localhost:5000
const API_BASE = process.env.REACT_APP_API_URL || "";

async function request(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.errors?.[0]?.msg || "Request failed");
  }
  return data;
}

// Auth
export const login = (email, password) =>
  request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const register = (email, password, name, role) =>
  request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, role }),
  });

export const getMe = () => request("/api/auth/me");

// Forecasts
export const getDailyForecast = (date) =>
  request(`/api/forecast/daily?date=${date}`);

export const getHourlyForecast = (date) =>
  request(`/api/forecast/hourly?date=${date}`);

export const getForecastAccuracy = (days = 14) =>
  request(`/api/forecast/accuracy?days=${days}`);

// TES
export const getTESSizing = (date) =>
  request(`/api/tes/sizing?date=${date}`);

export const getTESRecent = (days = 30) =>
  request(`/api/tes/recent?days=${days}`);

export const getTESDischarge = (date) =>
  request(`/api/tes/discharge/${date}`);

// Telemetry
export const getTelemetryLatest = (hallId, limit = 100) => {
  const params = new URLSearchParams();
  if (hallId) params.set("hall_id", hallId);
  params.set("limit", limit);
  return request(`/api/telemetry/latest?${params}`);
};

export const getTelemetryHistory = (hallId, start, end) => {
  const params = new URLSearchParams();
  if (hallId) params.set("hall_id", hallId);
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return request(`/api/telemetry/history?${params}`);
};

export const simulateTelemetry = (date, hours = 24) =>
  request("/api/telemetry/simulate", {
    method: "POST",
    body: JSON.stringify({ date, hours }),
  });

// Chat
export const sendChatMessage = (message, sessionId) =>
  request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, session_id: sessionId }),
  });

export const getChatHistory = (sessionId) =>
  request(`/api/chat/history/${sessionId}`);

// Documents
export const getDocuments = (docType) => {
  const params = docType ? `?doc_type=${docType}` : "";
  return request(`/api/documents${params}`);
};

export const getDocumentStats = () => request("/api/documents/stats");

// Daily Summary
export const getDailySummary = (date) =>
  request(`/api/forecast/daily-summary?date=${date}`);
