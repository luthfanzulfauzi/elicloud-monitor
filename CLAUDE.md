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

## Implementation Status (as of 2026-05-29)

| Area | Status | Notes |
|------|--------|-------|
| ZStack sync + all data models | ✅ Done | AccessKey HMAC-SHA1 auth, full upsert sync |
| Backend routers (dashboard, hosts, storage, vms, projects, resource_groups, users, compute, status) | ✅ Done | |
| Frontend — all 9 pages + charts + export | ✅ Done | Industrial Precision UI; client-side CSV/PDF (Login, Dashboard, Hosts, Storage, VMs, Projects, Resource Groups, Reports, Disk Health, Users) |
| Docker Compose + Dockerfiles | ✅ Done | postgres + backend + frontend services |
| User authentication (login, JWT, protected routes, role gating) | ✅ Done | Phase 2.5 — Login page, ProtectedRoute, JWT Bearer, `/auth/login` + `/auth/me`, seed admin, `useCurrentUser` + `usePermission` hooks, sidebar + page gating; `last_active_at` tracked on every `/auth/me` call; session status (Online/Idle/Offline) shown in Users page |
| VM → Project association sync | ✅ Done | ZQL `query accountresourceref` → `fetch_vm_owner_refs()` in `zstack_client.py`; 97% VM coverage (36 admin-owned VMs have `project_id=null`) |
| Disk Health Monitoring (smartctl SCP collector + DiskHealth page) | ✅ Done | StorageNode registry, `smartctl_service.py`, `/disk-health` + `/storage-nodes` routers, `DiskHealth.tsx` page |
| Alembic migrations | ❌ Pending | `alembic/versions/` is empty — DB uses `create_all()` on startup; new columns require manual `ALTER TABLE` |
| `/reports` backend router (CSV/PDF export) | ❌ Pending | Phase 3 — client-side export exists; server-side scheduled reports not yet built |
| Deployment docs | ❌ Pending | Phase 4 |

---

## VM → Project Association — Implementation Plan (Phase 2.7)

### Background

ZStack's admin REST API does NOT expose VM ownership through `VmInstanceInventory`. All attempts to query VMs by account/project via standard REST (`q=accountUuid=...`, `q=__projectUuid__=...`) return `503: field not found`. The `GET /v1/accounts/resources` endpoint only contains shared resources (roles, images, offerings) — never `VmInstanceVO`.

The working approach uses **ZQL** (`GET /v1/zql?zql=query accountresourceref ...`), which accesses ZStack's internal `AccountResourceRefVO` table directly. This table contains `ownerAccountUuid` per resource including all VMs.

### How the join works

```
VM.zstack_uuid
  ↕  accountresourceref.resourceUuid  (where resourceType='VmInstanceVO', isShared=false)
accountresourceref.ownerAccountUuid
  ↕  project.linkedAccountUuid
Project
```

**Confirmed results:** 1,181 / 1,217 VMs (97%) match an IAM2 project. The remaining 36 are owned by the admin account (no project).

### Files to change

| File | Change |
|------|--------|
| `backend/app/services/zstack_client.py` | Add `fetch_vm_owner_refs() → dict[str, str]`: ZQL-paginated fetch of all `accountresourceref` entries, filter `VmInstanceVO` + `isShared=false` client-side, return `{vm_zstack_uuid: owner_account_uuid}` |
| `backend/app/services/sync_service.py` | After projects are fetched, build `{linkedAccountUuid: project_app_id}` map; call `fetch_vm_owner_refs()`; use the two maps to resolve `vm.project_id` during VM upsert; remove the always-`None` fallback |
| `backend/app/routers/projects.py` | Already loads `project.vms` — will return real counts once `vm.project_id` is populated |

### ZQL call details

```
GET /v1/zql?zql=query+accountresourceref+limit+1000+offset+0
```

- Total refs: ~14,920 across all resource types
- Filter client-side: `resourceType == 'VmInstanceVO' and not isShared`
- Paginate until `len(page) < limit`
- Auth: same AccessKey HMAC-SHA1 as all other ZStack calls

### Edge cases

- VMs owned by admin account (`36c27e8ff05c4780bf6d2fa65700f22e`) → `project_id = None`
- New VMs created after sync → populated on next scheduled sync (5-min interval)
- `fetch_vm_owner_refs()` failure → log warning, skip project_id population (do not fail entire sync)

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
- **Per-module permission matrix**: each user has a `PermissionMap` with `view` and `manage` flags per module (Dashboard, Hosts, VMs, Storage, Projects, Resource Groups, Reports, Disk Health, User Management)
- **Role defaults**:
  - Admin: all `view=true, manage=true` — locked, non-editable
  - Operator: `view=true` for all modules **except** User Management (`view=false, manage=false`); `manage=true` for Hosts, VMs, Storage, Projects, Resource Groups, Disk Health; `manage=false` for Dashboard, Reports
  - Viewer: `view=true` for all modules **except** User Management (`view=false, manage=false`); `manage=false` everywhere
- **`User Management` module is Admin-only** — Operators and Viewers cannot see or access the Users page
- **Seed admin**: `admin@elitery.com` / `admin123` created on startup if DB has no users
- **Password hashing**: bcrypt used directly (not passlib — passlib incompatible with bcrypt>=4.0.0)
- **`security.py`**: `hash_password`, `verify_password`, `create_access_token`, `get_current_user` dependency
- **CRUD**: Create (with password), Edit, Delete users via dialog; double-click pattern on delete to arm then confirm
- **Permission editing**: per-user permission matrix dialog; checking Manage auto-checks View; unchecking View auto-unchecks Manage
- **Route guard**: `Users.tsx` redirects non-Admin users to `/` via `useCurrentUser` hook
- **Sidebar gating**: System section hidden when `usePermission('User Management').view === false`
- Types defined in `src/lib/api.ts`: `AppUser` (includes `last_active_at: string | null`), `UserRole`, `UserStatus`, `AppModule` (9 modules including `'Disk Health'`), `PermissionMap`
- Hooks: `src/hooks/useCurrentUser.ts`, `src/hooks/usePermission.ts`

---

## Out of Scope (Do Not Implement)

- Any ZStack write operations (VM creation, deletion, modification)
- Multi-cloud support (AWS, GCP, Azure)
- Application performance monitoring (APM)
