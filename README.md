# Urjasetu — Solar Forecasting & Ice TES Intelligence Platform

> Live weather → ML models → actionable solar generation forecasts with ice-based thermal energy storage sizing for IIT Kharagpur's 5.5 MWp campus solar PV infrastructure.

![React](https://img.shields.io/badge/React-18-black?style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-20-green?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square)
![MongoDB](https://img.shields.io/badge/MongoDB%20Atlas-M0%20Free-47A248?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square)

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (React + Recharts)                                     │
│  Vercel                                                           │
└──────────────┬───────────────────────────────────────────────────┘
               │ API calls (proxy / REACT_APP_API_URL)
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Backend (Express.js)                        Render              │
│  JWT Auth · Rate Limiting · Cron Jobs                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐        │
│  │ /api/auth    │  │ /api/forecast│  │ /api/telemetry   │        │
│  │ /api/chat    │  │ /api/tes     │  │ /api/weather     │        │
│  └─────────────┘  └──────┬───────┘  └─────────────────┘        │
└───────────────────────────┼──────────────────────────────────────┘
                            │ HTTP
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
   ┌──────────────┐ ┌────────────┐ ┌────────────────┐
   │ Open-Meteo   │ │ ML Service │ │ MongoDB Atlas  │
   │ Weather API  │ │ (FastAPI)  │ │ (DB + Vector)  │
   │ (free, no    │ │ XGBoost +  │ │                │
   │  API key)    │ │ LSTM + RAG │ │                │
   └──────────────┘ └────────────┘ └────────────────┘
                            │
                     ┌──────┴──────┐
                     │ DeepSeek    │
                     │ LLM API     │
                     └─────────────┘
```

**Key principle:** React never calls third-party APIs directly. All external keys live only in backend environment variables.

## Features

### 1. Dynamic Solar Generation Forecasting
- **Live weather injection** — Open-Meteo hourly data feeds directly into both models at prediction time
- **XGBoost daily** — P10/P50/P90 quantile regression from 25 engineered weather features
- **LSTM hourly** — 16-hour generation profile (04:00–19:00) from 10 weather variables
- **Fallback chain** — Weather-based curve estimation when ML service is unavailable
- **Accuracy tracking** — Trailing MAPE with predicted vs actual comparison

### 2. Ice Thermal Energy Storage (TES) Sizing
- 5-step thermodynamic chain from the BTP paper
- Carnot-corrected COP computation
- Phase-change energy balance with SLR
- 37.5-minute thermal lag adjustment
- Waterfall discharge scheduling across 21 named halls of residence

### 3. Live Telemetry Dashboard
- Real-time chiller plant monitoring (simulated, O4 sensors pending)
- Ice tank state tracking (charging/crystallization/discharging/melted)
- 12 instrumentation variables with visual status
- Simulated data generator for architecture demo

### 4. Corrective RAG Chatbot
- Full-page ChatGPT-style interface with session sidebar
- Local embeddings (all-MiniLM-L6-v2, 384-dim)
- MongoDB Atlas Vector Search
- DeepSeek LLM for generation + grading
- Query rewrite on low-relevance retrieval
- Conversation history in localStorage (max 20 sessions)
- Citation chips with source attribution

### 5. Solar Policy RL Dashboard
- Reinforcement learning policy visualization
- Daily summary with LLM-generated insights
- Tariff analysis (Grid import ₹8.5/kWh, Solar export ₹4.2/kWh)

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB Atlas account (free tier)

### 1. Clone and install

```bash
git clone https://github.com/pavanjarpula/UrjaSetu.git
cd UrjaSetu

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# ML Service
cd ../ml-service && pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials
```

Required environment variables:
| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random hex string (`openssl rand -hex 32`) |
| `DEEPSEEK_API_KEY` | DeepSeek LLM API key |
| `TAVILY_API_KEY` | Tavily web search API key |
| `ML_SERVICE_URL` | `http://localhost:8001` for local dev |

### 3. Run locally

```bash
# Terminal 1: ML Service
cd ml-service && python -m uvicorn app.main:app --reload --port 8001

# Terminal 2: Backend
cd backend && node server.js

# Terminal 3: Frontend
cd frontend && npm start
```

Frontend: http://localhost:3000
Backend API: http://localhost:5000
ML Service: http://localhost:8001

## Project Structure

```
urjasetu/
├── ml-service/                # Python FastAPI microservice
│   ├── app/
│   │   ├── main.py            # XGBoost + LSTM + embeddings
│   │   ├── tes_engine.py      # Ice TES sizing (21 halls)
│   │   ├── weather_adapter.py # Open-Meteo → training features
│   │   └── llm_provider.py    # DeepSeek LLM for RAG
│   └── requirements.txt
├── backend/                   # Express.js API
│   ├── server.js              # Entry point + cron jobs
│   ├── src/
│   │   ├── models/            # Mongoose schemas (8 models)
│   │   ├── routes/            # 6 route files, 18+ endpoints
│   │   ├── middleware/         # JWT auth, rate limiting
│   │   └── services/          # LLM provider abstraction
│   └── .env
├── frontend/                  # React + Recharts + Chart.js
│   ├── src/
│   │   ├── pages/             # 4 dashboard pages
│   │   ├── components/        # WeatherPanel, ChatWidget, etc.
│   │   ├── api/               # API client with JWT
│   │   └── styles/            # Design tokens + components
│   └── package.json
├── models/                    # Trained XGBoost + LSTM artifacts
├── dataset/                   # Training datasets
└── DOCUMENT_MANIFEST.md       # RAG corpus sourcing
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login, get JWT |
| POST | `/api/auth/register` | No | Register user |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/forecast/dynamic?date=` | Yes | **Live weather → XGBoost + LSTM** |
| GET | `/api/forecast/daily?date=` | No | Daily P10/P50/P90 |
| GET | `/api/forecast/hourly?date=` | No | Hourly LSTM profile |
| GET | `/api/forecast/accuracy?days=` | Yes | Trailing MAPE |
| GET | `/api/forecast/daily-summary?date=` | Yes | LLM-generated summary |
| GET | `/api/weather?date=` | Yes | Raw Open-Meteo data |
| GET | `/api/tes/sizing?date=` | Yes | TES sizing result |
| GET | `/api/tes/recent?days=` | Yes | Coverage trend |
| POST | `/api/telemetry/simulate` | Yes | Generate sim data |
| GET | `/api/telemetry/latest` | No | Latest readings |
| POST | `/api/chat` | Yes | RAG chat query |
| GET | `/api/documents` | Yes | List RAG documents |

## Open-Meteo Field Mapping

**Critical:** Forecast API fields differ from training data:

| Forecast API | Training Column |
|-------------|-----------------|
| `temperature_2m` | `temp_2m` |
| `relative_humidity_2m` | `relative_humidity` |
| `direct_normal_irradiance` | `dni` |
| `shortwave_radiation` | `shortwave_radiation` |
| `diffuse_radiation` | `diffuse_radiation` |

## Halls of Residence

21 halls with tier-based ice allocation:

| Tier | Halls | Rooms |
|------|-------|-------|
| **Large** | Ladies Hostel, Technology Tower, BC Roy, GD Birla, Mehta Family | 5,500 |
| **Medium** | Jawahar, Nehru, Azad, Rajendra Prasad, Patel, Lajpat Rai, Subhas, Vidyadhar | 3,380 |
| **Small** | Sengupto, MM Malaviya, Radha Krishnan, Sarojini Naidu, Gangadhar Meher, BC Roy, Homi Bhabha, Vikram Sarabhai | 1,493 |

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build
vercel deploy --prod
```

Set environment variable:
- `REACT_APP_API_URL` = Your Render backend URL

### Backend + ML Service → Render

1. Connect GitHub repo to Render
2. Create a **Web Service** for backend:
   - Build command: `cd backend && npm install`
   - Start command: `cd backend && node server.js`
   - Environment: Node 20
3. Create a **Web Service** for ML service:
   - Build command: `cd ml-service && pip install -r requirements.txt`
   - Start command: `cd ml-service && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Environment: Python 3.11
4. Set all environment variables in Render dashboard

### Database → MongoDB Atlas

1. Create free M0 cluster
2. Create database user
3. Whitelist IP `0.0.0.0/0` (for Render)
4. Copy connection string to `MONGO_URI`

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| MongoDB Atlas M0 | $0 |
| DeepSeek API | ~$1-3 |
| Open-Meteo API | $0 (free) |
| Local embeddings | $0 |
| Vercel (frontend) | $0 |
| Render (backend) | $0-7 |
| Render (ML service) | $0-7 |
| **Total** | **$1-17/month** |

## License

BTP Project — IIT Kharagpur
