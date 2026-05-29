# Functional Requirements Specification (FRS)
## EliCloud Monitor

**Version:** 1.1  
**Date:** 2026-05-29  

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
│   │   │   ├── collection_log.py
│   │   │   ├── storage_node.py   # StorageNode registry
│   │   │   └── disk_health.py    # DiskHealthRecord (parsed smartctl)
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
│   │   │   ├── dashboard.py
│   │   │   ├── storage_nodes.py  # CRUD for StorageNode registry
│   │   │   └── disk_health.py    # Disk health query + refresh trigger
│   │   ├── services/             # Business logic
│   │   │   ├── zstack_client.py  # ZStack API HTTP client (GET only) + ZQL queries
│   │   │   ├── sync_service.py   # Data collection orchestration
│   │   │   ├── report_service.py # Report generation
│   │   │   └── smartctl_service.py # SCP collection + smartctl parser
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
│   │   │   ├── DiskHealth.tsx    # NVMe disk health monitoring page
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
| GET | `/auth/me` | Returns current user profile + `PermissionMap`; updates `last_active_at` on every call (requires valid Bearer token) |

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

#### Storage Nodes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/storage-nodes` | List all storage nodes |
| POST | `/storage-nodes` | Register a new storage node |
| GET | `/storage-nodes/{id}` | Single storage node detail |
| PUT | `/storage-nodes/{id}` | Update storage node config |
| DELETE | `/storage-nodes/{id}` | Remove a storage node |

#### Disk Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/disk-health` | List latest DiskHealthRecord for all devices (filter: `?hostname=&health=`) |
| GET | `/disk-health/{hostname}` | All disk records for a specific storage node hostname |
| POST | `/disk-health/refresh` | Trigger on-demand SCP collection + re-parse for all enabled nodes |
| POST | `/disk-health/refresh/{storage_node_id}` | Trigger refresh for a single storage node |
| GET | `/disk-health/export/csv` | Export disk health table as CSV |

#### Admin / Status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | App health, last sync time, sync status |
| POST | `/sync/trigger` | Manually trigger a data collection run |
| GET | `/sync/logs` | Paginated collection log history |

---

## 5. ZStack API Client Spec

### Authentication
- Header: `Authorization: ZStack <AccessKeyID>:<Base64(HMAC-SHA1(secret, "METHOD\nDate\n/v1/path"))>`
- `Date` header: RFC 1123 GMT format — must not drift >15 min from ZStack server clock
- URI for signing: `/v1/<path>` — no `/zstack` prefix, no query string
- Actual request URL: `<ZSTACK_ENDPOINT>/zstack/v1/<path>`
- Authentication is stateless — no session token. Each request is independently signed.

> **Ultimate rule:** ZStack API is used strictly to query data. `zstack_client.py` implements GET/query methods only. CRUD operations (create, update, delete) apply only to this app's own PostgreSQL database — never to ZStack.

### ZStack Endpoints to Consume (read-only)

| ZStack Resource | Method | ZStack API / Endpoint |
|----------------|--------|-----------------------|
| Hosts | REST | `QueryHostAction` → `GET /v1/hosts` |
| Primary Storage | REST | `QueryPrimaryStorageAction` → `GET /v1/primary-storage` |
| VMs | REST | `QueryVmInstanceAction` → `GET /v1/vm-instances` |
| Volumes | REST | `QueryVolumeAction` → `GET /v1/volumes` |
| Projects | REST | `QueryIAM2ProjectAction` → `GET /v1/iam2/projects` |
| EIPs | REST | `QueryEipAction` → `GET /v1/eips` |
| Tags | REST | `QuerySystemTagAction`, `QueryUserTagAction` |
| **VM → Project ownership** | **ZQL** | `GET /v1/zql?zql=query+accountresourceref+...` |

### ZQL vs ZStack REST API

ZStack REST API endpoints expose fields from each resource's `Inventory` class only. `VmInstanceInventory` has no account/project ownership field — querying with `q=accountUuid=...` or `q=__projectUuid__=...` returns `503: field not found`.

**ZQL** (`GET /v1/zql`) is a separate read-only query interface that queries ZStack's internal entity model directly. It can access internal tables not exposed as REST endpoints. ZQL is **strictly read-only** (query/SELECT only — no insert/update/delete).

The `accountresourceref` entity (ZStack's internal `AccountResourceRefVO` table) is only accessible via ZQL. It contains `ownerAccountUuid` per resource, enabling VM → Project association.

### Sync Logic
1. Fetch all resources via ZStack REST APIs (pagination via `start` + `limit`)
2. Fetch VM ownership refs via ZQL `accountresourceref` (pagination via `offset` + `limit`)
3. Upsert into local DB using `zstack_uuid` as the idempotency key
4. Resolve `vm.project_id` using: `ownerAccountUuid` → `project.linkedAccountUuid` → `project.id`
5. Write a `CollectionLog` entry on completion

### VM → Project Mapping (Implemented)

The standard ZStack REST API cannot associate VMs with projects. The working approach:

```
accountresourceref.resourceUuid (VmInstanceVO, isShared=false)
  → VM.zstack_uuid

accountresourceref.ownerAccountUuid
  → Project.linkedAccountUuid
  → Project
```

**Coverage:** 1,181 / 1,217 VMs (97%) match an IAM2 project. 36 VMs owned by admin account have `project_id = null`.

**Implemented in `zstack_client.py`:** `fetch_vm_owner_refs() → dict[str, str]` — paginates `query accountresourceref`, filters `VmInstanceVO + isShared=false` client-side, returns `{vm_uuid: owner_account_uuid}`. Called during every sync run.

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
                        'Resource Groups' | 'Reports' | 'Disk Health' | 'User Management'
export type PermissionMap = Record<AppModule, { view: boolean; manage: boolean }>

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  created_at: string
  last_login: string | null
  last_active_at: string | null
  permissions: PermissionMap
}

export const APP_MODULES: AppModule[] = [
  'Dashboard', 'Hosts', 'VMs', 'Storage', 'Projects',
  'Resource Groups', 'Reports', 'Disk Health', 'User Management'
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

#### Disk Health (`/disk-health`)
- Data table: all NVMe disks across all storage nodes, latest SMART data
- Columns: Hostname, NVMe Device, Model Number, Capacity, TBW (TB), Endurance Used %, Write Endurance (Life Remaining) %, Available Spare %, Disk Health, Summary, Notes
- Disk Health badge: `PASSED`=green, `FAILED`=red
- Filter bar: Hostname dropdown, Health Status dropdown (All / PASSED / FAILED)
- Last collected timestamp shown per storage node or as a global badge
- "Refresh" button → `POST /disk-health/refresh`; shows loading state while running
- Export CSV button → `GET /disk-health/export/csv`
- Falls back to mock data when backend is unavailable

#### Users (`/users`)
- **Admin-only page** — non-Admin users (Operator, Viewer) are redirected to `/` by a route-level guard using `useCurrentUser`
- Sidebar System section (User Management link) hidden for non-Admin users via `usePermission('User Management').view`
- Summary stat cards: Total Users, Active, Inactive, Admins
- User table columns: User (avatar + name), Email, Role badge, Status badge, Session status, Last Login, Created At, Actions
- **Session status** badge: green dot = Online (last_active_at <5 min), amber dot = Idle (5 min–8 hr), gray dot = Offline (>8 hr or null) — computed client-side from `last_active_at`
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
