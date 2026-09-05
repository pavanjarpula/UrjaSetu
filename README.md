# Urjasetu — Solar Forecasting & Ice TES Orchestration Platform

> ML-driven solar generation forecasting with ice-based thermal energy storage sizing for IIT Kharagpur's 5.5 MWp campus solar PV infrastructure.

## Architecture

```
React (browser) → Express API (Node.js) → Python ML Microservice (FastAPI)
                      ↓                        ↓
                 MongoDB Atlas            Anthropic/Gemini LLM
                      ↓
              Open-Meteo Weather API
```

**Key principle:** React never calls third-party APIs directly. All external keys live only in the backend environment.

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB Atlas account (free tier)
- Gemini API key

### 1. Clone and install

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install

# ML Service
cd ml-service && pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your:
# - MONGO_URI (from MongoDB Atlas)
# - GEMINI_API_KEY
# - JWT_SECRET (run: openssl rand -hex 32)
```

### 3. Run locally

```bash
# Terminal 1: ML Service
cd ml-service && python -m uvicorn app.main:app --reload --port 8001

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm start
```

### 4. Or use Docker Compose

```bash
docker compose up --build
```

Frontend: http://localhost:3000  
Backend API: http://localhost:5000  
ML Service: http://localhost:8001

## Project Structure

```
urjasetu/
├── ml-service/           # Python FastAPI microservice
│   ├── app/
│   │   ├── main.py       # Model loading + prediction endpoints
│   │   ├── tes_engine.py # Ice TES sizing computation
│   │   ├── weather_adapter.py  # Open-Meteo field mapping
│   │   ├── llm_provider.py     # Gemini LLM for RAG
│   │   ├── ingest_documents.py # PDF chunking + embedding
│   │   └── eval_set.py   # RAG evaluation questions
│   └── requirements.txt
├── backend/              # Express.js API
│   ├── server.js         # Entry point + cron jobs
│   ├── src/
│   │   ├── models/       # Mongoose schemas
│   │   ├── routes/       # API endpoints
│   │   ├── middleware/    # Auth, validation
│   │   └── services/     # LLM provider, utilities
│   └── .env.example
├── frontend/             # React + Recharts
│   ├── src/
│   │   ├── pages/        # Dashboard pages
│   │   ├── components/   # Chat widget, etc.
│   │   └── api/          # API client
│   └── public/
├── models/               # Trained model artifacts
├── dataset/              # Training datasets
├── docker-compose.yml
├── Dockerfile.ml
├── Dockerfile.backend
├── Dockerfile.frontend
└── DOCUMENT_MANIFEST.md  # RAG corpus sourcing
```

## Features

### 1. Solar Generation Forecasting
- **Daily P10/P50/P90** quantile regression (XGBoost)
- **Hourly 16-hour** generation profile (LSTM seq2seq)
- Live Open-Meteo weather integration with explicit field mapping
- Trailing MAPE/MAE accuracy tracking

### 2. Ice TES Sizing Engine
- 5-step thermodynamic chain from the BTP paper
- Carnot-corrected COP computation
- Phase-change energy balance with SLR
- 37.5-minute thermal lag adjustment
- Waterfall discharge scheduling across 21 halls

### 3. Telemetry (Simulated)
- Full schema for future sensor integration
- Simulated data generator for architecture demo
- Persistent "SIMULATED DATA" banner on all charts
- Ready for real sensor POST ingestion

### 4. Corrective RAG Chatbot
- PDF ingestion with section-aware chunking
- Local embeddings (all-MiniLM-L6-v2)
- MongoDB Atlas Vector Search
- Gemini LLM for generation + grading
- Query rewrite on low-relevance retrieval
- Citation chips with source attribution
- 15-question evaluation set

## Open-Meteo Field Mapping

**Critical:** Forecast API fields differ from training data:

| Forecast API | Training Column |
|-------------|-----------------|
| `temperature_2m` | `temp_2m` |
| `relative_humidity_2m` | `relative_humidity` |
| `direct_normal_irradiance` | `dni` |
| `shortwave_radiation` | `shortwave_radiation` |
| `diffuse_radiation` | `diffuse_radiation` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login, get JWT |
| POST | `/api/auth/register` | Register user |
| GET | `/api/forecast/daily?date=YYYY-MM-DD` | Daily forecast |
| GET | `/api/forecast/hourly?date=YYYY-MM-DD` | Hourly forecast |
| GET | `/api/forecast/accuracy?days=14` | Trailing accuracy |
| GET | `/api/tes/sizing?date=YYYY-MM-DD` | TES sizing result |
| GET | `/api/tes/recent?days=30` | Coverage trend |
| GET | `/api/telemetry/latest` | Latest readings |
| POST | `/api/telemetry/simulate` | Generate sim data |
| POST | `/api/chat` | RAG chat query |
| GET | `/api/documents` | List documents |

## Known Limitations

1. **Telemetry is simulated** — O4 sensor hardware is not yet deployed. All telemetry values are generated synthetically with `source: "simulated"`. The `POST /api/telemetry/ingest` endpoint is ready for real sensor data.

2. **LLM provider defaults to free tier** — The RAG chatbot uses Google Gemini (free tier). To swap to another provider, change `LLM_PROVIDER` in `.env` and update the `llmProvider.js` service.

3. **Vector search fallback** — Without Atlas Search index configured, the RAG system falls back to MongoDB text search. For production vector search, create the index per the architecture plan.

4. **Cold start** — Free-tier backends (Render/Railway) may take 10-30 seconds to wake up after inactivity.

## Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
vercel deploy
```

### Backend + ML Service (Render/Railway)
1. Connect GitHub repo
2. Set environment variables in dashboard
3. Deploy using `docker-compose.yml`

### Database (MongoDB Atlas)
1. Create free M0 cluster
2. Add database user
3. Whitelist IP (or 0.0.0.0/0 for dev)
4. Copy connection string to `MONGO_URI`

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| MongoDB Atlas M0 | $0 |
| Gemini API (free tier) | $0 |
| Open-Meteo API | $0 |
| Local embeddings | $0 |
| Vercel (frontend) | $0 |
| Render (backend) | $0-7 |
| **Total** | **$0-7/month** |

## License

BTP Project — IIT Kharagpur
