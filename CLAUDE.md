# CLAUDE.md
## EliCloud Monitor

This file provides context and conventions for AI-assisted development of EliCloud Monitor.

---

## Project Overview

EliCloud Monitor is a read-only web dashboard and reporting tool for ZStack private cloud infrastructure. It monitors physical hosts, storage, VMs, and projects, and supports custom resource grouping and exportable reports.

**Ultimate rule — two absolute constraints that override everything else:**
1. **CRUD operations happen only in this app's own database.** Resource Groups, Users, Collection Logs — fine. ZStack resources — never.
2. **ZStack API is used strictly for querying data.** Only GET/read methods. No POST, PUT, DELETE, or PATCH to ZStack under any circumstance.

---

## Architecture

```
frontend/   → React + TypeScript (Vite) + shadcn/ui + Tailwind CSS
backend/    → Python (FastAPI) + SQLAlchemy + Alembic + APScheduler
shared/     → Shared type definitions (optional, for monorepo use)
```

Refer to `FRS.md` for the full directory structure and API specification.

---

## AI Model Choice

### Recommended Models

| Use Case | Model | Reason |
|----------|-------|--------|
| Default coding tasks | `claude-sonnet-4-6` | Best balance of speed and quality for everyday development |
| Complex architecture decisions | `claude-opus-4-7` | Deep reasoning for design trade-offs, ERD review, cross-system analysis |
| Fast boilerplate / repetitive tasks | `claude-haiku-4-5-20251001` | Speed-optimized for scaffolding, CRUD generation, type file creation |

### Usage Notes
- Use `claude-opus-4-7` when designing cross-cutting concerns (auth, sync logic, report engine)
- Use `claude-sonnet-4-6` for feature implementation, bug fixes, and code review
- Use `claude-haiku-4-5-20251001` for generating repetitive schemas, migration files, or boilerplate components
- Enable **prompt caching** for all long-context sessions (e.g., when passing full FRS.md or schema files as context)

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `plan.md` | Original product idea and scope |
| `PRD.md` | Product Requirements Document |
| `ERD.md` | Entity Relationship Diagram |
| `FRD.md` | Functional Requirements Document |
| `FRS.md` | Functional Requirements Specification (tech stack, API, structure) |
| `CLAUDE.md` | This file — AI conventions and project context |

---

## Development Conventions

### General
- All code must be compatible with Docker Compose deployment
- Configuration via environment variables only (no hardcoded secrets)
- Backend and frontend are independent services — no direct imports across them
- All migrations via Alembic — never modify the DB schema directly

### Backend (FastAPI / Python)
- Python 3.11+
- Use `async` handlers for all route functions
- Use Pydantic v2 schemas for all request/response models
- Use SQLAlchemy 2.x ORM with `async` sessions
- ZStack API client in `app/services/zstack_client.py` — only GET methods allowed
- Use `upsert` (INSERT ... ON CONFLICT DO UPDATE) keyed on `zstack_uuid` for all sync operations
- All sync runs must write a `CollectionLog` entry (success, partial, or failed)

### Frontend (React / TypeScript)
- React 18 + TypeScript strict mode
- Component library: shadcn/ui + Tailwind CSS
- Charts: Recharts
- API calls via Axios in `src/lib/api.ts`
- No direct fetch() calls in components — always use the API client layer
- Use React Query (TanStack Query) for server state management
- All fetch functions fall back to mock data when the backend is unavailable
- Font scale: `text-[10px]`=10px (minimum), `text-xs`=12px, `text-sm`=14px, `text-base`=16px, `text-lg`=18px — never use below 10px

### Authentication
- JWT (HS256), signed with `SECRET_KEY` env var, 8-hour expiry
- Password hashing: bcrypt via `passlib[bcrypt]`
- All backend routes except `POST /auth/login` require `Authorization: Bearer <token>`; use a FastAPI dependency (`get_current_user`) for this
- Frontend stores token in `localStorage`; Axios request interceptor attaches `Authorization: Bearer` header automatically
- `GET /auth/me` returns `AppUser` + `PermissionMap` — used by frontend to gate UI elements
- `ProtectedRoute` component in `src/components/auth/ProtectedRoute.tsx` — redirects to `/login` if no valid token
- Login page (`/login`) is rendered outside `MainLayout` — no sidebar/header
- On 401 response from any API call, clear token and redirect to `/login`

### Database
- PostgreSQL 15
- All UUIDs generated server-side (PostgreSQL `gen_random_uuid()`)
- `SnapshotHost` and `SnapshotStorage` are append-only — never UPDATE these tables
- `zstack_uuid` columns must be `UNIQUE` and indexed

---

## Implementation Status (as of 2026-05-25)

| Area | Status | Notes |
|------|--------|-------|
| ZStack sync + all data models | ✅ Done | AccessKey HMAC-SHA1 auth, full upsert sync |
| Backend routers (dashboard, hosts, storage, vms, projects, resource_groups, users, compute, status) | ✅ Done | |
| Frontend — all 8 pages + charts + export | ✅ Done | Industrial Precision UI; client-side CSV/PDF |
| Docker Compose + Dockerfiles | ✅ Done | postgres + backend + frontend services |
| User authentication (login, JWT, protected routes, role gating) | ✅ Done | Phase 2.5 — Login page, ProtectedRoute, JWT Bearer, `/auth/login` + `/auth/me`, seed admin, `useCurrentUser` + `usePermission` hooks, sidebar + page gating |
| Alembic migrations | ❌ Pending | `alembic/versions/` is empty — DB uses `create_all()` on startup |
| `/reports` backend router (CSV/PDF export) | ❌ Pending | Phase 3 |
| Deployment docs | ❌ Pending | Phase 4 |

---

## Critical Rules for AI Assistance

1. **[ULTIMATE] CRUD only in this app — never in ZStack.** All create/update/delete operations target this app's own PostgreSQL database only. ZStack is never mutated. If a request would modify ZStack resources, refuse and explain.
2. **[ULTIMATE] ZStack API is query-only.** `zstack_client.py` may only implement GET methods. No POST, PUT, DELETE, or PATCH to ZStack. Ever.
3. **Idempotent sync logic.** All data collection code must be safe to run multiple times — use upsert, not insert.
4. **Credentials in env vars.** Never hardcode ZStack credentials, DB passwords, or secret keys in any file.
5. **Preserve `zstack_created_at`.** This field is the source of truth for VM audit reports — never overwrite it during sync.
6. **Docker-first.** All code should run identically in Docker Compose. Don't add OS-specific dependencies.

---

## Environment Variables Reference

```env
ZSTACK_ENDPOINT=http://zstack-mgmt:8080
ZSTACK_ACCESS_KEY_ID=
ZSTACK_ACCESS_KEY_SECRET=
ZSTACK_POLL_INTERVAL_SECONDS=300
DATABASE_URL=postgresql+asyncpg://user:password@postgres:5432/elicloudmonitor
APP_PORT=8000
APP_ENV=development
SECRET_KEY=
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## Testing Guidelines

- Backend: pytest + pytest-asyncio; use a test DB (not production)
- Frontend: Vitest + React Testing Library
- ZStack client: mock the HTTP layer — never call real ZStack in unit tests
- Integration tests: use Docker Compose with a test DB container

---

## User Management & Authentication

The application includes a full User Management + Authentication system. This is **app-internal only** — users here control access to the EliCloud Monitor UI, not ZStack resources.

- **Roles**: Admin, Operator, Viewer
- **Per-module permission matrix**: each user has a `PermissionMap` with `view` and `manage` flags per module (Dashboard, Hosts, VMs, Storage, Projects, Resource Groups, Reports, User Management)
- **Role defaults**:
  - Admin: all `view=true, manage=true` — locked, non-editable
  - Operator: `view=true` for all modules **except** User Management (`view=false, manage=false`); `manage=true` for Hosts, VMs, Storage, Projects, Resource Groups; `manage=false` for Dashboard, Reports
  - Viewer: `view=true` for all modules **except** User Management (`view=false, manage=false`); `manage=false` everywhere
- **`User Management` module is Admin-only** — Operators and Viewers cannot see or access the Users page
- **Seed admin**: `admin@elitery.com` / `admin123` created on startup if DB has no users
- **Password hashing**: bcrypt used directly (not passlib — passlib incompatible with bcrypt>=4.0.0)
- **`security.py`**: `hash_password`, `verify_password`, `create_access_token`, `get_current_user` dependency
- **CRUD**: Create (with password), Edit, Delete users via dialog; double-click pattern on delete to arm then confirm
- **Permission editing**: per-user permission matrix dialog; checking Manage auto-checks View; unchecking View auto-unchecks Manage
- **Route guard**: `Users.tsx` redirects non-Admin users to `/` via `useCurrentUser` hook
- **Sidebar gating**: System section hidden when `usePermission('User Management').view === false`
- Types defined in `src/lib/api.ts`: `AppUser`, `UserRole`, `UserStatus`, `AppModule`, `PermissionMap`
- Hooks: `src/hooks/useCurrentUser.ts`, `src/hooks/usePermission.ts`

---

## Out of Scope (Do Not Implement)

- Any ZStack write operations (VM creation, deletion, modification)
- Multi-cloud support (AWS, GCP, Azure)
- Application performance monitoring (APM)
