# Urjasetu — Solar Forecasting & Ice TES Intelligence Platform

> Live weather data powers ML models that deliver actionable solar generation forecasts with ice-based thermal energy storage sizing for IIT Kharagpur's 5.5 MWp campus solar PV infrastructure.

![React](https://img.shields.io/badge/React-18-black?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-green?style=flat-square&logo=node.js)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python)
![MongoDB](https://img.shields.io/badge/MongoDB%20Atlas-M0%20Free-47A248?style=flat-square&logo=mongodb)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![XGBoost](https://img.shields.io/badge/XGBoost-2.1-FF6F00?style=flat-square)

## Live Deployment

| Service | URL | Platform |
|---------|-----|----------|
| **Frontend** | [frontend-hogwarts1.vercel.app](https://frontend-hogwarts1.vercel.app) | Vercel |
| **Backend API** | [urjasetu-backend.onrender.com](https://urjasetu-backend.onrender.com) | Render |
| **ML Service** | [urjasetu.onrender.com](https://urjasetu.onrender.com) | Render |
| **Database** | MongoDB Atlas M0 (Free) | Cloud |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend — React 18 + Recharts + Chart.js                          │
│  Deployed on Vercel (Global CDN)                                     │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │
│  │ Solar        │ │ Ice TES      │ │ Live         │ │ Solar      │  │
│  │ Forecast     │ │ Sizing       │ │ Telemetry    │ │ Policy RL  │  │
│  │ Dashboard    │ │ Dashboard    │ │ Dashboard    │ │ Dashboard  │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │
│  │ ChatWidget   │ │ WeatherPanel │ │ Auth (JWT)   │ │ TopBar     │  │
│  │ (RAG Chat)   │ │ (Collapsible)│ │ Login/Reg    │ │ (Live Clock)│ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS (REACT_APP_API_URL)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Backend — Node.js 20 + Express.js                                   │
│  Deployed on Render (Free Tier)                                      │
│                                                                      │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────────┐  │
│  │ JWT Auth │ │ Rate      │ │ Cron Jobs │ │ LLM Provider         │  │
│  │ Login/   │ │ Limiting  │ │ Weather   │ │ Abstraction          │  │
│  │ Register │ │ 100/15min │ │ Fetching  │ │ (DeepSeek)           │  │
│  └──────────┘ └───────────┘ └───────────┘ └──────────────────────┘  │
│                                                                      │
│  Routes:                                                             │
│  /api/auth · /api/forecast · /api/tes · /api/telemetry               │
│  /api/weather · /api/chat · /api/documents                           │
└──────────┬────────────────────┬──────────────────┬───────────────────┘
           │                    │                  │
           ▼                    ▼                  ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────────────┐
│ Open-Meteo API   │ │ ML Service      │ │ MongoDB Atlas            │
│ (Free, no key)   │ │ FastAPI          │ │ urjasetu_database        │
│                  │ │                  │ │ ┌──────────┐ ┌─────────┐ │
│ 10 hourly vars   │ │ XGBoost (daily) │ │ │ users    │ │ forecasts│ │
│ temp, cloud,     │ │ P10/P50/P90     │ │ └──────────┘ └─────────┘ │
│ radiation, etc.  │ │ 25 features     │ │ ┌──────────┐ ┌─────────┐ │
│ KGP coords       │ │                  │ │ │ tesruns  │ │ chat    │ │
│ 22.3149°N        │ │ LSTM (hourly)   │ │ └──────────┘ └─────────┘ │
│ 87.3105°E        │ │ 13 features     │ │ ┌──────────────────────┐  │
│                  │ │ 16-hour profile │ │ │ Vector Search Index  │  │
│                  │ │                  │ │ │ (rag_chunks)         │  │
│                  │ │ TES Engine       │ │ └──────────────────────┘  │
│                  │ │ 21 halls, COP   │ │                           │
│                  │ │                  │ │                           │
│                  │ │ DeepSeek LLM    │ │                           │
│                  │ │ for RAG gen     │ │                           │
└──────────────────┘ └─────────────────┘ └──────────────────────────┘
```

**Security principle:** React never calls third-party APIs directly. All API keys (DeepSeek, Tavily, LangSmith) live exclusively in backend environment variables.

---

## Services Provided

### 1. Dynamic Solar Generation Forecasting

The core intelligence engine — predicts how much electricity IIT Kharagpur's 5.5 MWp solar array will produce.

- **Live weather injection** — Open-Meteo hourly data (10 variables: temp, cloud cover, radiation, humidity, precipitation) feeds directly into both ML models at prediction time, not from cache
- **XGBoost daily forecast** — P10/P50/P90 quantile regression from 25 engineered weather features; gives conservative (P10), expected (P50), and optimistic (P90) daily generation estimates in kWh. **Feeds TES sizing and accuracy tracking.**
- **LSTM hourly profile** — 16-hour generation curve (04:00–19:00 IST) from 13 features (10 weather + 3 temporal encodings); shows hour-by-hour expected output for visualization only
- **Fallback chain** — When ML service is unavailable: cached DB data → weather-based sinusoidal curve estimation with cloud attenuation + PV temperature derating
- **Accuracy tracking** — Trailing MAPE with predicted vs actual comparison across configurable day windows (XGBoost only)

**How it works:**
```
User clicks "Get Forecast" 
  -> Backend fetches live Open-Meteo weather for KGP (22.3149N, 87.3105E)
  -> Sends weather JSON to ML Service
  -> XGBoost P10/P50/P90 models predict daily totals (feeds TES + accuracy)
  -> LSTM model generates hourly profile (visualization only)
  -> Results saved to MongoDB, returned to frontend
  -> Frontend renders bar chart (daily) + line chart (hourly) + KPI cards
```

### 2. Ice Thermal Energy Storage (TES) Sizing

Thermodynamic engine that calculates optimal ice storage for each of IIT Kharagpur's 21 Halls of Residence — derived from the BTP research paper.

- **5-step thermodynamic chain:**
  1. Room sensible heat load computation
  2. Carnot-corrected COP (Coefficient of Performance) for ice-making
  3. Phase-change energy balance with Solar Load Ratio (SLR)
  4. Ice mass calculation from thermal energy storage density
  5. 37.5-minute thermal lag adjustment for real-world charging
- **Per-hall discharge schedule** — 20:00–06:00 waterfall allocation across all 21 halls
- **Tier-based allocation** — Large/Medium/Small halls sized by occupancy (183–1392 rooms)
- **Coverage percentage** — Shows what fraction of evening cooling load the ice can offset

### 3. Live Telemetry Dashboard

Real-time monitoring view for the chiller plant and ice tanks (simulated data; O4 hardware sensors pending).

- **12 instrumentation variables** — Chiller COP, ice tank level, charge/discharge rates, temperatures
- **Ice tank state machine** — Tracks 4 states: Charging → Crystallization → Discharging → Melted
- **Visual status indicators** — Color-coded cards with pulse animations for active readings
- **Simulated data generator** — Any authenticated user can trigger realistic 24-hour simulation cycles

### 4. Corrective RAG Chatbot

Full-page ChatGPT-style conversational interface for querying solar/energy documentation.

```
                         User Query
                             |
                             v
                   +-------------------+
                   | Embed Query       |
                   | all-MiniLM-L6-v2  |
                   | (384-dim vector)  |
                   +-------------------+
                             |
                             v
                   +-------------------+
                   | Atlas Vector      |
                   | Search (top-5)    |
                   | cosine similarity |
                   +-------------------+
                             |
                             v
                   +-------------------+
                   | Grade Relevance   |
                   | DeepSeek LLM      |
                   | (yes/no per chunk)|
                   +-------------------+
                             |
                      < 2 relevant?
                      /          \
                    Yes           No
                    |              |
                    v              v
          +---------------+   +-------------------+
          | Rewrite Query |   | Fetch Live Data   |
          | DeepSeek LLM  |   | (forecast + TES)  |
          +---------------+   +-------------------+
                    |              |
                    v              v
          +---------------+   +-------------------+
          | Re-Retrieve   |   | Generate Answer   |
          | (top-5 again) |   | DeepSeek LLM      |
          +---------------+   | + citations       |
                    |          +-------------------+
                    v                   |
          Still < 2 relevant?          v
          /          \          +-------------------+
        Yes           No        | Self-Reflect      |
        |              |        | useful / not_useful|
        v              |        | / hallucination    |
  +-----------+        |        +-------------------+
  | Tavily   |        |                  |
  | Web      |        |          not_useful?
  | Search   |        |          /       \
  +-----------+        |        Yes        No
        |              |        |          |
        v              v        v          v
        +----- Merge Context ------+   Return Answer
                       |
                       v
              +-------------------+
              | MongoDB Session   |
              | (turn history)    |
              +-------------------+
```

**Components:**
- **Embeddings** — all-MiniLM-L6-v2 (384-dim) running locally via sentence-transformers, no external API cost
- **Vector Search** — MongoDB Atlas `$vectorSearch` aggregation on `urjasetu_collection` with `vector_index`
- **LLM** — DeepSeek v4 Flash for grading, rewriting, generation, and self-reflection
- **Web Search** — Tavily API fallback when vector search returns insufficient relevant chunks
- **Live Data** — Injects current forecast (P50 kWh) and TES (ice mass, coverage %) from DB into context
- **Session Storage** — MongoDB `chatsessions` collection with full turn history per session

### 5. Solar Policy RL Dashboard

Reinforcement learning policy visualization for optimal energy trading decisions.

- **Daily summary** with LLM-generated natural language insights
- **Tariff analysis** — Grid import ₹8.5/kWh, Solar export ₹4.2/kWh (WBSEDCL Net Metering 2024-25)
- **Policy visualization** — Action/state/reward timeline charts

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | SPA framework with hooks (useState, useEffect, useRef) |
| **React Router v6** | Client-side routing (/, /forecast, /tes, /telemetry, /policy, /chat) |
| **Recharts** | Declarative SVG charts (BarChart, LineChart, AreaChart, PieChart) |
| **Chart.js + react-chartjs-2** | Doughnut/polar charts for gauge displays |
| **Lucide React** | SVG icon library (Sun, Snowflake, Activity, MessageSquare, etc.) |
| **Custom CSS** | Design tokens (tokens.css) + component styles (components.css), dark theme |

### Backend (Express.js)

| Technology | Purpose |
|------------|---------|
| **Express.js 4** | HTTP server, routing, middleware |
| **Mongoose 9** | MongoDB ODM (8 schemas: User, Forecast, ForecastHourly, TESRun, Telemetry, ChatSession, ChatMessage, RAGDocument) |
| **JWT (jsonwebtoken)** | Stateless authentication with bcrypt password hashing |
| **express-rate-limit** | 100 requests per 15-minute window |
| **node-cron** | Scheduled weather fetching and forecast generation |
| **axios** | HTTP client for ML Service + Open-Meteo calls |
| **cors** | Cross-origin requests from Vercel frontend |

### ML Service (Python FastAPI)

| Technology | Purpose |
|------------|---------|
| **FastAPI 0.115** | Async HTTP server with automatic OpenAPI docs |
| **XGBoost 2.1** | Quantile regression (P10/P50/P90 daily forecasts, 25 features) |
| **TensorFlow 2.17** | LSTM seq2seq (96+64 units, 13 features, 16-hour profile) |
| **scikit-learn 1.5** | Feature preprocessing, StandardScaler for LSTM |
| **pandas / NumPy** | Data manipulation and feature engineering |
| **sentence-transformers** | all-MiniLM-L6-v2 embeddings (384-dim) for RAG |
| **PyMongo 4.8** | Direct MongoDB Atlas connection for vector search |
| **Tavily Python** | Web search fallback for RAG queries |

### Database

| Technology | Purpose |
|------------|---------|
| **MongoDB Atlas M0** | Free-tier cloud database (urjasetu_database) |
| **Atlas Vector Search** | Semantic search on rag_chunks collection (cosine, 384-dim) |
| **8 Collections** | users, forecasts, forecasthourlies, tesruns, telemetries, chatsessions, chatmessages, rag_chunks |

### External APIs

| API | Purpose | Cost |
|-----|---------|------|
| **Open-Meteo** | Real-time + forecast weather data for KGP | Free (no API key) |
| **DeepSeek v4 Flash** | LLM for RAG generation, grading, summarization | ~$1-3/month |
| **Tavily** | Web search fallback for RAG | Free tier (1000 queries/month) |

---

## IIT Kharagpur Halls of Residence

21 named halls with tier-based ice allocation:

| Tier | Hall Name | Rooms | Ice Allocation (kg) | Discharge (kWh) |
|------|-----------|-------|--------------------:|----------------:|
| **Large** | B R Ambedkar Hall | 1,392 | 41,281 | 3,330 |
| **Large** | Lalbahadur Sastry Hall | 1,300 | 38,550 | 3,110 |
| **Large** | Madan Mohan Malviya Hall | 1,180 | 35,010 | 2,823 |
| **Large** | Patel Hall | 1,050 | 31,163 | 2,512 |
| **Large** | Lala Lajpat Rai Hall | 900 | 26,711 | 2,153 |
| **Medium** | Azad Hall | 590 | 17,481 | 1,412 |
| **Medium** | JC Bose Hall | 520 | 15,402 | 1,244 |
| **Medium** | Nehru Hall | 490 | 14,513 | 1,172 |
| **Medium** | Rajendra Prasad Hall | 460 | 13,624 | 1,101 |
| **Medium** | Vidyasagar Hall | 440 | 13,032 | 1,053 |
| **Medium** | Megnad Saha Hall | 420 | 12,441 | 1,005 |
| **Medium** | BC Roy Hall | 400 | 11,848 | 957 |
| **Medium** | Radha Krishnan Hall | 380 | 11,256 | 909 |
| **Small** | Homi Bhabha Hall | 330 | 9,774 | 790 |
| **Small** | Sir Ashutosh Mukherjee Hall | 300 | 8,885 | 718 |
| **Small** | Gokhale Hall | 260 | 7,699 | 622 |
| **Small** | Sarojini Naidu Hall | 250 | 7,403 | 598 |
| **Small** | Mother Teresa Hall | 240 | 7,107 | 574 |
| **Small** | Zakir Hussain Hall | 220 | 6,516 | 526 |
| **Small** | Rani Laxmibai Hall | 200 | 5,924 | 479 |
| **Small** | Sister Nivedita Hall | 183 | 5,422 | 438 |
| | **Total** | **11,888** | **351,522** | **28,362** |

---

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account (email + password) |
| POST | `/api/auth/login` | No | Login, returns JWT token |
| GET | `/api/auth/me` | Yes | Get current user profile |

### Forecasting

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/forecast/dynamic?date=YYYY-MM-DD` | Yes | **Live weather → XGBoost + LSTM in one call** |
| GET | `/api/forecast/daily?date=YYYY-MM-DD` | Yes | Daily P10/P50/P90 from DB |
| GET | `/api/forecast/hourly?date=YYYY-MM-DD` | Yes | Hourly LSTM profile from DB |
| GET | `/api/forecast/accuracy?days=30` | Yes | Trailing MAPE with fallback demo data |
| GET | `/api/forecast/daily-summary?date=YYYY-MM-DD` | Yes | LLM-generated natural language summary |

### Weather

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/weather?date=YYYY-MM-DD` | Yes | Raw Open-Meteo data (19 hourly + 8 daily fields) |

### Ice TES Sizing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tes/sizing?date=YYYY-MM-DD` | Yes | Full TES sizing for 21 halls |
| GET | `/api/tes/recent?days=30` | Yes | Recent TES runs for coverage trend chart |

### Telemetry

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/telemetry/simulate` | Yes | Generate 24h simulated telemetry data |
| GET | `/api/telemetry/latest` | No | Latest chiller plant readings |

### RAG Chat

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat` | Yes | Corrective RAG query (embed → search → grade → rewrite → generate) |
| GET | `/api/documents` | Yes | List RAG document metadata |

---

## Project Structure

```
UrjaSetu/
├── frontend/                    # React 18 SPA
│   ├── src/
│   │   ├── App.js               # Router, layout, SVG logos, TopBar with clock
│   │   ├── pages/
│   │   │   ├── ForecastDashboard.js   # Dynamic forecast with fallback chain
│   │   │   ├── TESDashboard.js        # Ice TES sizing + discharge schedule
│   │   │   ├── TelemetryDashboard.js  # Live chiller plant monitoring
│   │   │   └── PolicyDashboard.js     # Solar Policy RL visualization
│   │   ├── components/
│   │   │   ├── ChatWidget.js          # Full-page ChatGPT-style RAG chat
│   │   │   ├── WeatherPanel.js        # Collapsible weather with 20 variables
│   │   │   └── TopBar.js              # Live clock + nav
│   │   ├── api/
│   │   │   └── client.js              # Axios instance with JWT interceptor
│   │   └── styles/
│   │       ├── tokens.css             # Design tokens (colors, spacing, radius)
│   │       └── components.css         # Component styles + animations
│   ├── vercel.json               # Vercel deployment config
│   └── package.json
├── backend/                     # Express.js API layer
│   ├── server.js                # Entry point, CORS, routes, cron jobs
│   ├── src/
│   │   ├── models/              # 8 Mongoose schemas
│   │   │   ├── User.js
│   │   │   ├── Forecast.js
│   │   │   ├── ForecastHourly.js
│   │   │   ├── TESRun.js
│   │   │   ├── Telemetry.js
│   │   │   ├── ChatSession.js
│   │   │   ├── ChatMessage.js
│   │   │   └── RAGDocument.js
│   │   ├── routes/              # 6 route files, 18+ endpoints
│   │   │   ├── auth.js
│   │   │   ├── forecasts.js     # Dynamic endpoint (weather → ML)
│   │   │   ├── weather.js       # Open-Meteo adapter
│   │   │   ├── tes.js           # TES sizing (calls ML /tes/sizing/for-date)
│   │   │   ├── telemetry.js     # Simulate + latest
│   │   │   ├── chat.js          # Corrective RAG pipeline
│   │   │   └── documents.js     # RAG document management
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT verification + rate limiting
│   │   └── services/
│   │       └── llm.js           # DeepSeek LLM abstraction
│   └── .env
├── ml-service/                  # Python FastAPI microservice
│   ├── app/
│   │   ├── main.py              # 11 endpoints: forecast, TES, embed, health
│   │   ├── tes_engine.py        # Ice TES sizing (21 halls, 5-step thermodynamic chain)
│   │   ├── weather_adapter.py   # Open-Meteo field mapping for XGBoost features
│   │   ├── llm_provider.py      # DeepSeek LLM for RAG generation
│   │   └── rag_engine.py        # Corrective-RAG: embed → grade → rewrite → generate
│   └── requirements.txt
├── models/                      # Trained ML artifacts (~3MB total)
│   ├── xgb_q10.pkl              # XGBoost P10 quantile model
│   ├── xgb_q50.pkl              # XGBoost P50 quantile model
│   ├── xgb_q90.pkl              # XGBoost P90 quantile model
│   ├── xgboost_solar_forecast.pkl  # Legacy single-output model
│   ├── lstm_hourly_generation_model.keras  # LSTM hourly profile
│   ├── feature_list.json        # 25 engineered features
│   └── model_metrics.json       # Training metrics
├── dataset/                     # Training datasets
├── documented pdfs for RAG/     # RAG corpus (PDFs)
├── render.yaml                  # Render deployment blueprint
├── docker-compose.yml           # Local Docker setup
└── README.md
```

---

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB Atlas account (free tier M0)

### Quick Start

```bash
# Clone
git clone https://github.com/pavanjarpula/UrjaSetu.git
cd UrjaSetu

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd ml-service && pip install -r requirements.txt && cd ..

# Terminal 1: ML Service (port 8001)
cd ml-service && python -m uvicorn app.main:app --reload --port 8001

# Terminal 2: Backend (port 5000)
cd backend && node server.js

# Terminal 3: Frontend (port 3000)
cd frontend && npm start
```

### Environment Variables

Create `backend/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/urjasetu_database?retryWrites=true&w=majority
JWT_SECRET=<random-hex-32>
DEEPSEEK_API_KEY=<your-deepseek-key>
DEEPSEEK_MODEL=deepseek-chat
LLM_PROVIDER=deepseek
ML_SERVICE_URL=http://localhost:8001
CLIENT_URL=http://localhost:3000
TAVILY_API_KEY=<your-tavily-key>
```

---

## Design System

The UI follows a **ChatGPT-inspired dark theme** with custom CSS design tokens:

- **Colors:** Dark background (#171717), orange accent (#f97316), blue telemetry (#38bdf8)
- **Typography:** System font stack (Inter → Segoe UI → sans-serif)
- **Animations:** `brand-glow` (logo pulse), `fab-pulse` (chat button), `dot-pulse` (live status), `live-glow` (LIVE badge)
- **Components:** TopBar with live clock, sidebar with SVG nav icons, collapsible panels
- **Responsive:** Works on desktop and tablet (1024px+)

---

## Cost Estimate

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| MongoDB Atlas M0 | Free | $0 |
| DeepSeek API | Pay-per-use | ~$1-3 |
| Open-Meteo API | Free (no key) | $0 |
| Local embeddings (MiniLM-L6) | Free | $0 |
| Vercel (frontend) | Hobby | $0 |
| Render (backend) | Free | $0 |
| Render (ML service) | Free | $0 |
| Tavily (web search) | Free tier | $0 |
| **Total** | | **$1-3/month** |

> Render free tier services spin down after 15 min of inactivity. First request after idle takes ~30s to wake up.

---

## License

BTP Project — IIT Kharagpur
