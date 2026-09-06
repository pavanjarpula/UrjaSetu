# Deployment Guide — Render + Vercel

## Prerequisites

1. **GitHub repo** with all code pushed
2. **MongoDB Atlas** cluster (already created: `urjasetu.2f5foqc.mongodb.net`)
3. **Render** account (free tier)
4. **Vercel** account (free tier)
5. **Gemini API key** (already have)

---

## Step 1: Deploy ML Service (Render)

1. Go to [render.com](https://render.com) → New → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name:** `urjasetu-ml-service`
   - **Runtime:** Python
   - **Build Command:** `pip install -r ml-service/requirements.txt`
   - **Start Command:** `uvicorn ml-service.app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. Add Environment Variables:
   ```
   MODEL_DIR = /opt/render/project/src/models
   DATASET_DIR = /opt/render/project/src/dataset
   MONGO_URI = mongodb+srv://<db_username>:<db_password>@urjasetu.2f5foqc.mongodb.net/?appName=urjasetu
   MONGO_DB_NAME = btp_platform
   ```
5. Create Service → Wait for deployment
6. Note the URL: `https://urjasetu-ml-service.onrender.com`

---

## Step 2: Deploy Backend (Render)

1. New → **Web Service** → Connect same repo
2. Configure:
   - **Name:** `urjasetu-backend`
   - **Runtime:** Node
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && node server.js`
   - **Plan:** Free
3. Add Environment Variables:
   ```
   MONGO_URI = mongodb+srv://<db_username>:<db_password>@urjasetu.2f5foqc.mongodb.net/?appName=urjasetu
   MONGO_DB_NAME = urjasetu_database
   JWT_SECRET = <generate with: openssl rand -hex 32>
   DEEPSEEK_API_KEY = <your_deepseek_api_key>
   DEEPSEEK_MODEL = deepseek-chat
   LLM_PROVIDER = deepseek
   TAVILY_API_KEY = <your_tavily_api_key>
   ML_SERVICE_URL = https://urjasetu-ml-service.onrender.com
   CLIENT_URL = https://urjasetu.vercel.app
   ```
4. Create Service → Wait for deployment
5. Note the URL: `https://urjasetu-backend.onrender.com`

---

## Step 3: Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Configure:
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `build`
4. Add Environment Variable:
   ```
   REACT_APP_API_URL = 
   ```
   (Leave empty - in production, Vercel rewrites handle /api/ proxy)
5. Deploy

---

## Step 4: Update Vercel Rewrites

After backend is deployed, update `vercel.json` with your actual backend URL:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://urjasetu-backend.onrender.com/api/$1"
    }
  ]
}
```

Commit and push → Vercel auto-redeploys.

---

## Step 5: Test the Full Stack

1. Open `https://urjasetu.vercel.app`
2. Register a new account
3. Login
4. Check Forecast Dashboard (should show live Open-Meteo data)
5. Check TES Sizing (should compute ice mass/volume)
6. Check Chat (should answer from documents)
7. Check Telemetry (should show simulated data with banner)

---

## MongoDB Atlas Setup (if not done)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Select your cluster → **Connect**
3. Add IP whitelist: `0.0.0.0/0` (Allow all - required for Render)
4. Create database user if not done:
   - Username: `urjasetu_admin`
   - Password: `<your strong password>`
   - Role: **Read and write to any database**
5. Copy connection string and update in Render dashboard

---

## Local Docker Development

```bash
# Create .env with your MongoDB URI
cp .env.example .env
# Edit .env with your actual values

# Run everything
docker compose up --build

# Access:
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
# ML:       http://localhost:8001
```

---

## Cost Estimate

| Service | Plan | Monthly |
|---------|------|---------|
| MongoDB Atlas | M0 Free | $0 |
| Render (ML) | Free | $0 |
| Render (Backend) | Free | $0 |
| Vercel | Free | $0 |
| **Total** | | **$0/month** |

> **Note:** Render free tier services spin down after 15 min of inactivity.
> First request after idle takes ~30s to wake up.

---

## Troubleshooting

**CORS errors:**
- Ensure `CLIENT_URL` in Render matches your Vercel URL
- Check Vercel rewrites are pointing to correct Render backend URL

**MongoDB connection fails:**
- Verify IP whitelist includes `0.0.0.0/0` in Atlas
- Check username/password in connection string
- Ensure database user has read/write permissions

**ML Service timeout:**
- Free tier may take time to load ML models on first request
- Check health endpoint: `https://urjasetu-ml-service.onrender.com/health`

**Chat returns "no information":**
- Run document ingestion first:
  ```bash
  cd ml-service
  python -c "from app.ingest_documents import main; main()"
  ```
