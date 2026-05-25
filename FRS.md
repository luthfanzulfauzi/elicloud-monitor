# Functional Requirements Specification (FRS)
## EliCloud Monitor

**Version:** 1.1  
**Date:** 2026-05-25  

---

## 1. Introduction

This document specifies the technical implementation details for each functional requirement defined in the FRD. It bridges the gap between "what the system must do" (FRD) and "how it will be built" (implementation).

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + TypeScript | Component reuse, type safety |
| UI Library | shadcn/ui + Tailwind CSS | Fast, consistent, accessible UI |
| Charts | Recharts | Lightweight, React-native charts |
| Backend | Python (FastAPI) | Fast async API, auto OpenAPI docs |
| Database | PostgreSQL | Reliable relational DB, good JSON support |
| ORM | SQLAlchemy + Alembic | Migrations, model safety |
| Task Scheduler | APScheduler (in-process) | ZStack polling cron |
| Authentication | HTTP Basic or JWT (internal) | Simple internal auth |
| Containerization | Docker + Docker Compose | Multi-env deployment |
| Config | python-dotenv / env vars | 12-factor app pattern |

---

## 3. Project Structure

```
elicloudmonitor/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py               # FastAPI app entry; _seed_admin() on startup
│   │   ├── config.py             # Settings from env (incl. ADMIN_DEFAULT_EMAIL/PASSWORD)
│   │   ├── database.py           # DB session setup
│   │   ├── security.py           # hash_password, verify_password, create_access_token, get_current_user
│   │   ├── models/               # SQLAlchemy ORM models
│   │   │   ├── host.py
│   │   │   ├── storage.py
│   │   │   ├── vm.py
│   │   │   ├── volume.py
│   │   │   ├── project.py
│   │   │   ├── tag.py
│   │   │   ├── eip.py
│   │   │   ├── resource_group.py
│   │   │   ├── snapshot.py
│   │   │   └── collection_log.py
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── routers/              # FastAPI route handlers
│   │   │   ├── auth.py           # POST /auth/login, GET /auth/me (public)
│   │   │   ├── users.py          # Full CRUD for AppUser (protected)
│   │   │   ├── hosts.py
│   │   │   ├── storage.py
│   │   │   ├── vms.py
│   │   │   ├── projects.py
│   │   │   ├── resource_groups.py
│   │   │   ├── reports.py
│   │   │   └── dashboard.py
│   │   ├── services/             # Business logic
│   │   │   ├── zstack_client.py  # ZStack API HTTP client (GET only)
│   │   │   ├── sync_service.py   # Data collection orchestration
│   │   │   └── report_service.py # Report generation
│   │   └── scheduler.py          # APScheduler setup
│   └── alembic/                  # DB migrations
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Hosts.tsx
│   │   │   ├── Storage.tsx
│   │   │   ├── VMs.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── ResourceGroups.tsx
│   │   │   ├── Reports.tsx
│   │   │   └── Users.tsx
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── ProtectedRoute.tsx # Redirects to /login if no valid token
│   │   │   ├── layout/
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   └── Sidebar.tsx       # Nav + System section (User Management link)
│   │   │   ├── charts/
│   │   │   │   ├── VMTrendChart.tsx
│   │   │   │   ├── TrendChart.tsx        # Generic single-metric BarChart
│   │   │   │   └── ComputeTrendChart.tsx # Dual Y-axis vCPU + RAM chart
│   │   │   └── tables/
│   │   │       └── DataTable.tsx
│   │   ├── hooks/
│   │   │   ├── useCurrentUser.ts # React Query hook: fetches /auth/me; staleTime=Infinity
│   │   │   └── usePermission.ts  # Returns { view, manage } for a given AppModule
│   │   └── lib/
│   │       ├── api.ts            # Axios API client (attaches Bearer token; 401 → redirect /login)
│   │       ├── auth.ts           # Auth helpers: getToken, setToken, clearToken, isAuthenticated
│   │       └── utils.ts
└── shared/
    └── types/                    # Shared type definitions (if using monorepo)
```

---

## 4. API Specification

### Base URL: `/api/v1`

#### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/summary` | Cluster-wide summary (hosts, VMs, storage) |
| GET | `/dashboard/vm-trend` | VM creation trend (query: `?days=30`) |
| GET | `/dashboard/storage-trend` | Storage provisioned per day (query: `?days=30`) |
| GET | `/dashboard/compute-trend` | Compute provisioned per day — vCPU + RAM (query: `?days=30`) |
| GET | `/dashboard/top-hosts` | Top N hosts by CPU/memory utilization |

#### Hosts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hosts` | List all hosts (pagination, filter by state) |
| GET | `/hosts/{id}` | Single host detail with VM list |
| GET | `/hosts/{id}/history` | Historical snapshots for a host |

#### Storage

| Method | Path | Description |
|--------|------|-------------|
| GET | `/storage` | List all primary storage |
| GET | `/storage/{id}` | Single storage detail |
| GET | `/storage/{id}/history` | Historical snapshots for storage |
| GET | `/storage/trend` | Storage provisioned per day (query: `?start_date=&end_date=`) |

#### VMs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vms` | List VMs (pagination, filter, sort) |
| GET | `/vms/{id}` | Single VM detail with volumes, tags, EIP |
| GET | `/vms/created-by-period` | VM creation count grouped by period |
| GET | `/vms/compute-trend` | Compute provisioned per day — `{date, vcpu, ram_gb}[]` (query: `?start_date=&end_date=`) |

Query params for `/vms`:
- `page`, `per_page` — pagination
- `state`, `project_id`, `host_id`, `tag` — filters
- `search` — name/IP full-text search
- `sort_by`, `sort_dir` — sorting

#### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List all projects |
| GET | `/projects/{id}` | Project detail with VM summary |

#### Resource Groups

| Method | Path | Description |
|--------|------|-------------|
| GET | `/resource-groups` | List all resource groups |
| POST | `/resource-groups` | Create a new resource group |
| GET | `/resource-groups/{id}` | Group detail with aggregated summary |
| PUT | `/resource-groups/{id}` | Update group (name, projects) |
| DELETE | `/resource-groups/{id}` | Delete group |

#### Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/vms/csv` | Export VM list as CSV |
| GET | `/reports/hosts/csv` | Export host list as CSV |
| GET | `/reports/storage/csv` | Export storage list as CSV |
| GET | `/reports/vm-creation/csv` | Export VM creation time-series as CSV |
| GET | `/reports/resource-group/{id}/csv` | Export resource group report as CSV |
| GET | `/reports/vms/pdf` | Export VM list as PDF |

#### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Accepts `{ email, password }` → returns `{ access_token, token_type, expires_in, user }` |
| POST | `/auth/logout` | Invalidates session (client-side token clear; stateless JWT) |
| GET | `/auth/me` | Returns current user profile + `PermissionMap` (requires valid Bearer token) |

- All routes except `POST /auth/login` require `Authorization: Bearer <token>` header
- Invalid / expired token → HTTP 401 `{ detail: "Not authenticated" }`
- Inactive user login attempt → HTTP 403 `{ detail: "Account is inactive" }`
- JWT signed with `SECRET_KEY` env var; algorithm: HS256; expiry: 8 hours
- Seed admin: `admin@elitery.com` / `admin123` created on startup if no users exist in DB
- Password hashing: bcrypt library used directly (`bcrypt.hashpw` / `bcrypt.checkpw`) — not passlib (incompatible with bcrypt>=4.0.0)

#### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all application users |
| POST | `/users` | Create a new user |
| GET | `/users/{id}` | Single user detail |
| PUT | `/users/{id}` | Update user (name, email, role, status) |
| PUT | `/users/{id}/permissions` | Update user's permission matrix |
| DELETE | `/users/{id}` | Delete a user |

#### Admin / Status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | App health, last sync time, sync status |
| POST | `/sync/trigger` | Manually trigger a data collection run |
| GET | `/sync/logs` | Paginated collection log history |

---

## 5. ZStack API Client Spec

### Authentication
- Header: `Authorization: OAuth <session_token>`
- Session token obtained via POST to ZStack login endpoint using AccessKey ID + AccessKey Secret

> **Ultimate rule:** ZStack API is used strictly to query data. `zstack_client.py` implements GET/query methods only. CRUD operations (create, update, delete) apply only to this app's own PostgreSQL database — never to ZStack.

### ZStack Endpoints to Consume (read-only)

| ZStack Resource | ZStack API Action |
|----------------|-------------------|
| Hosts | `QueryHostAction` |
| Primary Storage | `QueryPrimaryStorageAction` |
| VMs | `QueryVmInstanceAction` |
| Volumes | `QueryVolumeAction` |
| Projects | `QueryProjectAction` |
| EIPs | `QueryEipAction` |
| Tags | `QuerySystemTagAction`, `QueryUserTagAction` |

### Sync Logic
1. Fetch all resources via ZStack Query APIs (support pagination via `start` + `limit`)
2. Upsert into local DB using `zstack_uuid` as the idempotency key
3. Soft-delete any local records whose `zstack_uuid` was not seen in the latest sync
4. Write a `CollectionLog` entry on completion

---

## 6. Data Models (SQLAlchemy)

Models follow the ERD. Key implementation notes:

- All models inherit from a `Base` with `id` (UUID, server default) and `updated_at` (auto-update)
- `zstack_uuid` columns have `unique=True, index=True` for fast upsert lookups
- `SnapshotHost` and `SnapshotStorage` have `index=True` on `snapshot_at` for time-series queries
- `VM.zstack_created_at` stored as `TIMESTAMP WITH TIME ZONE`

---

## 7. Frontend Type Definitions (`src/lib/api.ts`)

Key types used across the frontend:

```typescript
// Provisioning trend types
export interface ProvisioningPoint { date: string; value: number }
export interface ComputePoint { date: string; vcpu: number; ram_gb: number }

// User management types
export type UserRole = 'Admin' | 'Operator' | 'Viewer'
export type UserStatus = 'Active' | 'Inactive'
export type AppModule = 'Dashboard' | 'Hosts' | 'VMs' | 'Storage' | 'Projects' |
                        'Resource Groups' | 'Reports' | 'User Management'
export type PermissionMap = Record<AppModule, { view: boolean; manage: boolean }>

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  created_at: string
  last_login: string | null
  permissions: PermissionMap
}

export const APP_MODULES: AppModule[] = [
  'Dashboard', 'Hosts', 'VMs', 'Storage', 'Projects',
  'Resource Groups', 'Reports', 'User Management'
]

// Returns role-default PermissionMap
export function defaultPermissions(role: UserRole): PermissionMap
```

All `fetchX()` functions attempt the real backend API and fall back to mock data on failure.

---

## 8. Frontend Specifications

### Pages and Key Components

#### Login (`/login`)
- Standalone page — rendered outside `MainLayout` (no sidebar/header)
- Centered card: EliCloud Monitor logo/title, email input, password input, Login button
- On submit: `POST /auth/login`; on success → store token, redirect to `/`
- On failure: show inline error ("Invalid credentials" or "Account is inactive")
- If a valid token already exists, redirect to `/` immediately (skip login)
- `App.tsx` wraps all routes under `<ProtectedRoute>` which checks token validity and redirects to `/login` if absent or expired

#### Dashboard (`/`)
- Summary cards: total hosts, running VMs, stopped VMs, total storage used
- Last sync badge (green/yellow/red)
- Bar chart: VM creation trend (30 days) — `VMTrendChart`
- Bar chart: Storage provisioned per day (30 days) — `TrendChart` (blue)
- Dual-axis bar chart: Compute provisioned per day (30 days) — `ComputeTrendChart` (amber=vCPU, teal=RAM)
- Table: top 5 hosts by CPU overcommit
- Progress bars: per-storage utilization

#### Hosts (`/hosts`)
- Sortable, filterable data table
- Columns: Name, IP, State, CPU (used/total), Memory (used/total), VMs, Overcommit Ratio
- Row click → host detail page

#### Storage (`/storage`)
- Data table: Name, Type, State, Capacity, Used, Free, Utilization %
- Progress bar per row for utilization

#### VMs (`/vms`)
- Full data table with search bar and column filters
- Columns: Name, State, Project, Host, Private IP, EIP, vCPU, vRAM, Storage, Created At
- Export button → triggers CSV download

#### Projects (`/projects`)
- Table: Name, VM Count, vCPU Total, vRAM Total, Storage Total

#### Resource Groups (`/resource-groups`)
- Table of groups with Create/Edit/Delete actions
- Group detail: list of included projects + aggregated resource summary
- Export button per group

#### Reports (`/reports`)
- Three metric tabs: VMs Created, Storage Provisioned, Compute Provisioned
- Active tab: `bg-blue-600 text-white`; inactive: `hover:bg-slate-200`
- Date range picker (start date / end date) applied to the active tab's data
- **VMs tab**: summary stat cards + `VMTrendChart` bar chart + daily table (Date, Count)
- **Storage tab**: summary stat cards + `TrendChart` bar chart (blue) + daily table (Date, GB)
- **Compute tab**: summary stat cards + `ComputeTrendChart` dual-axis bar chart + daily table (Date, vCPU, RAM GB)
- Export CSV/PDF buttons (disabled until backend is wired)

#### Users (`/users`)
- **Admin-only page** — non-Admin users (Operator, Viewer) are redirected to `/` by a route-level guard using `useCurrentUser`
- Sidebar System section (User Management link) hidden for non-Admin users via `usePermission('User Management').view`
- Summary stat cards: Total Users, Active, Inactive, Admins
- User table columns: User (avatar + name), Email, Role badge, Status badge, Last Login, Created At, Actions
- Role badges: Admin=violet, Operator=amber, Viewer=slate
- Actions: Edit (Pencil), Permissions (ShieldCheck, violet), Delete (Trash2, double-click to arm then confirm) — shown only when `canManage === true`
- **Create/Edit Dialog**: name, email, role Select, status Select, password field (required for create, optional for edit); role change resets permissions to defaults
- **Permissions Dialog**: 8-row table × View/Manage checkbox columns; Admin permissions are all-checked and disabled; Manage check auto-checks View; View uncheck auto-unchecks Manage
- All mutations call the backend API (`POST/PUT/DELETE /users`) then invalidate the React Query `['users']` cache

---

## 8. Configuration & Environment Variables

```env
# ZStack
ZSTACK_ENDPOINT=http://zstack-mgmt:8080
ZSTACK_ACCESS_KEY_ID=your_access_key_id
ZSTACK_ACCESS_KEY_SECRET=your_access_key_secret
ZSTACK_POLL_INTERVAL_SECONDS=300

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/elicloudmonitor

# App
APP_PORT=8000
APP_ENV=production
SECRET_KEY=changeme

# Frontend
VITE_API_BASE_URL=http://backend:8000/api/v1
```

---

## 9. Docker Compose Services

```yaml
services:
  postgres:       # PostgreSQL 15
  backend:        # FastAPI app on port 8000
  frontend:       # React app (served by nginx) on port 80
```

Volumes:
- `postgres_data` — persistent DB storage
- `report_output` — exported report files

---

## 10. Security Considerations

| Item | Approach |
|------|----------|
| ZStack credentials | Stored in env vars / Docker secrets, never in code |
| DB credentials | Env vars, not hardcoded |
| API access | Internal network only; JWT Bearer auth on all backend routes |
| HTTPS | Terminate TLS at reverse proxy (nginx/traefik) in front of the app |
| ZStack read-only guarantee | `zstack_client.py` implements GET/query methods only — no POST/PUT/DELETE/PATCH to ZStack. CRUD targets app DB only. |

---

## 11. Error Handling

| Scenario | Behavior |
|----------|----------|
| ZStack API unreachable | Log error, skip sync cycle, dashboard shows "last known data" with stale badge |
| ZStack API auth failure | Log error with `[ERROR]` level, alert in dashboard status widget |
| DB connection failure | Fail-fast at startup with clear error message |
| Partial sync (some resources fail) | Log as `partial` status in CollectionLog, continue with successful resources |
| Report export failure | Return HTTP 500 with descriptive JSON error body |
