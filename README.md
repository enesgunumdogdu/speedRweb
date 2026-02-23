# SpeedR

Video-based speed measurement tool for sports. Upload a video, get speed analysis results.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Java (Spring Boot) | 21 (3.4.3) |
| Frontend | React (TypeScript, Vite) | 19.2.0 (7.3.1) |
| Analysis | Python (Flask, OpenCV) | 3.1.0 (4.11.0) |
| Database | PostgreSQL | - |
| HTTP Client | Axios | 1.13.5 |
| Routing | React Router | 7.13.0 |

## Architecture

```
frontend/           React SPA (Vite dev server :5173)
    |
    | REST API
    v
backend/            Spring Boot API (:8080)
    |
    | HTTP + Callback
    v
analysis-service/   Flask + OpenCV (:5001)
```

**Flow**: Upload video -> Create analysis request -> Backend delegates to Python service -> OpenCV processes video -> Callback with results -> Frontend polls and displays.

```
speedrweb/
├── backend/                Spring Boot application
│   └── src/main/java/com/speedrweb/
│       ├── controller/     REST endpoints
│       ├── service/        Business logic + analyzer modules
│       ├── model/          JPA entities
│       ├── repository/     Data access
│       ├── dto/            Request/response objects
│       └── config/         CORS, async, RestTemplate
├── frontend/               React + TypeScript + Vite
│   └── src/
│       ├── pages/          Home, Upload, Result, History
│       ├── components/     SpeedOverlay
│       └── api/            Axios client + video API
└── analysis-service/       Python Flask service
    ├── app.py              Flask routes
    └── analyzer.py         OpenCV ice hockey analyzer
```

## Getting Started

### Prerequisites

- Java 21
- Node.js + npm
- Python 3 + pip
- PostgreSQL

### Database

```bash
createdb speedrweb_dev
```

### Backend

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Runs on http://localhost:8080

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173

### Analysis Service

```bash
cd analysis-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Runs on http://localhost:5001

## API Endpoints

### Videos

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/videos/upload` | Upload video file |
| GET | `/api/videos/{id}` | Get video metadata |
| GET | `/api/videos/{id}/stream` | Stream video (supports range requests) |

### Analysis

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/analysis` | Create analysis request |
| GET | `/api/analysis/{id}` | Get analysis result |
| GET | `/api/analysis?page=0&size=10` | List analysis history (paginated) |
| POST | `/api/analysis/{id}/callback` | Receive results from analysis service |

### Analysis Service (internal)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze/ice-hockey` | Submit video for ice hockey analysis |
| GET | `/health` | Health check |

## Current Status

MVP phase: Ice hockey stick speed measurement.

- Video upload and streaming
- Async analysis pipeline with callback pattern
- OpenCV-based speed detection
- Real-time speed overlay on video playback
- Analysis history with pagination
