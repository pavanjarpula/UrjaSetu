require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const axios = require("axios");
const connectDB = require("./config/db");

const authRoutes = require("./src/routes/auth");
const forecastRoutes = require("./src/routes/forecasts");
const tesRoutes = require("./src/routes/tes");
const telemetryRoutes = require("./src/routes/telemetry");
const chatRoutes = require("./src/routes/chat");
const documentRoutes = require("./src/routes/documents");

const app = express();
const PORT = process.env.PORT || 5000;
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8001";

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use("/api/", limiter);

// Chat-specific rate limiting (stricter due to LLM costs)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many chat requests, please try again later" },
});
app.use("/api/chat", chatLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/tes", tesRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/documents", documentRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "urjasetu-backend" });
});

// Scheduled jobs
// Daily forecast job - runs at 5:00 AM IST
cron.schedule("0 5 * * *", async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    console.log(`[CRON] Running daily forecast for ${dateStr}`);
    await axios.get(`${ML_SERVICE}/forecast/daily`, {
      params: { date: dateStr },
      timeout: 60000,
    });
    console.log(`[CRON] Daily forecast completed for ${dateStr}`);
  } catch (error) {
    console.error("[CRON] Daily forecast failed:", error.message);
  }
});

// Telemetry simulation job - runs every hour
cron.schedule("0 * * * *", async () => {
  try {
    console.log("[CRON] Generating simulated telemetry data");
    // Telemetry simulation is triggered via API
  } catch (error) {
    console.error("[CRON] Telemetry simulation failed:", error.message);
  }
});

// Start server
const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Urjasetu backend running on port ${PORT}`);
      console.log(`ML Service URL: ${ML_SERVICE}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();

module.exports = app;
