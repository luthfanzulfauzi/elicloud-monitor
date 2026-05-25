# EliCloud Monitor

A read-only web dashboard and reporting tool for ZStack private cloud infrastructure. Monitors physical hosts, storage, VMs, and projects with custom resource grouping and exportable reports.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS |
| Backend | Python 3.11 + FastAPI + SQLAlchemy 2.x + APScheduler |
| Database | PostgreSQL 15 |
| Auth | JWT (HS256) + bcrypt |
| Infra | Docker Compose |

## Features

- Real-time monitoring of ZStack hosts, VMs, storage pools, and projects
- Role-based access control (Admin / Operator / Viewer)
- Custom resource grouping
- CSV and PDF export
- Virtual capacity utilization trend charts
- Automated periodic sync from ZStack API

## Quick Start

### Prerequisites
- Docker & Docker Compose
- ZStack management endpoint and AccessKey credentials

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your ZStack credentials and secret key
```

### 2. Start all services

```bash
docker compose up -d
```

The app will be available at `http://localhost`.

### Default credentials

| Field | Value |
|-------|-------|
| Email | `admin@elitery.com` |
| Password | `admin123` |

> Change the default password immediately after first login.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ZSTACK_ENDPOINT` | ZStack management API base URL |
| `ZSTACK_ACCESS_KEY_ID` | ZStack AccessKey ID |
| `ZSTACK_ACCESS_KEY_SECRET` | ZStack AccessKey secret |
| `ZSTACK_POLL_INTERVAL_SECONDS` | Sync interval in seconds (default: 300) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `APP_PORT` | Backend port (default: 8000) |
| `VITE_API_BASE_URL` | Backend API base URL for frontend |

## Project Structure

```
.
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── models/     # SQLAlchemy ORM models
│   │   ├── routers/    # API route handlers
│   │   ├── schemas/    # Pydantic request/response schemas
│   │   └── services/   # ZStack client, sync logic
│   ├── alembic/        # Database migrations
│   └── requirements.txt
├── frontend/           # React application
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── lib/        # API client, utilities
│   │   └── pages/      # Page components
│   └── package.json
└── docker-compose.yml
```

## Important Constraints

- **ZStack API is read-only.** This app never creates, modifies, or deletes ZStack resources.
- **All CRUD operations** (Resource Groups, Users) target only this app's own PostgreSQL database.

## Documentation

| File | Description |
|------|-------------|
| `PRD.md` | Product Requirements Document |
| `ERD.md` | Entity Relationship Diagram |
| `FRD.md` | Functional Requirements Document |
| `FRS.md` | Functional Requirements Specification |

## License

Internal use only — Elitery.
