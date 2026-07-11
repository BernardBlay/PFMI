# PFMI (Predictive Maintenance Intelligence)

This project is built for the **Build Weekend 1.0** hackathon. It provides a hybrid predictive maintenance platform incorporating Next.js frontend, Python FastAPI machine learning services, OCR logs ingestion, and Postgres database integration.

## Project Structure

```
predictive-maintenance/
├── apps/
│   ├── web/                      # Next.js frontend + API routing
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   ├── api/
│   │   │   │   ├── equipment/
│   │   │   │   ├── alerts/
│   │   │   │   └── maintenance-logs/   # OCR ingestion endpoint
│   │   │   └── ocr-upload/
│   │   ├── lib/
│   │   │   ├── db.ts              # Postgres client
│   │   │   └── ml-client.ts       # calls the Python service
│   │   └── package.json
│   │
│   └── ml-service/                # Python, separate process
│       ├── main.py                # FastAPI app
│       ├── model/
│       │   ├── train.py           # trains on CMAPSS/bearing dataset
│       │   ├── predict.py         # inference endpoint logic
│       │   └── artifacts/         # saved model (.pkl)
│       ├── data/
│       │   └── raw/               # CMAPSS or bearing dataset goes here
│       ├── requirements.txt
│       └── ocr.py                 # OCR pipeline (pytesseract or similar)
│
├── db/
│   └── schema.sql                 # equipment, sensor_readings, maintenance_logs, alerts
│
└── README.md
```

## Getting Started

### Next.js Web App
1. Navigate to `apps/web`
2. Run `npm install`
3. Run `npm run dev` to start the web app at `http://localhost:3000`

### ML Python Service
1. Navigate to `apps/ml-service`
2. Create and activate a python virtual environment
3. Run `pip install -r requirements.txt`
4. Run `uvicorn main:app --reload` to start the ML service API at `http://localhost:8000`
