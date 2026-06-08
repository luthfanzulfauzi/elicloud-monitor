# EliCloud Monitor

A read-only internal web dashboard and reporting tool for **ZStack private cloud** infrastructure. Monitors physical hosts, storage pools, VMs, projects, and NVMe disk health — with role-based access, custom resource grouping, exportable reports, and automated data collection.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Quick Start](#quick-start)
5. [Environment Variables](#environment-variables)
6. [Application Walkthrough](#application-walkthrough)
7. [How-To / Knowledge Base](#how-to--knowledge-base)
   - [Setting up ZStack credentials](#setting-up-zstack-credentials)
   - [Setting up Disk Health Monitoring](#setting-up-disk-health-monitoring)
   - [Managing Users](#managing-users)
   - [Resource Groups](#resource-groups)
   - [Exporting Data](#exporting-data)
   - [Scheduler & Automation](#scheduler--automation)
8. [Project Structure](#project-structure)
9. [API Reference](#api-reference)
10. [Constraints](#constraints)
11. [Development Setup](#development-setup)
12. [Documentation Index](#documentation-index)

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| F-01 | Host Monitoring | Physical server list — CPU cores, vCPU allocation, RAM, overcommit ratio, VM count |
| F-02 | Primary Storage | Storage pool list — total/used capacity, utilization %, Ceph pool breakdown |
| F-03 | VM Inventory | Full VM table with search/filter — name, state, project, host, IPs, vCPU, RAM, storage, creation date |
| F-04 | VM Audit Reports | VM creation trend charts, filterable date ranges, daily count table |
| F-05 | Provisioning Trends | Storage provisioned/day and compute provisioned/day (dual-axis vCPU + RAM) charts |
| F-06 | Project List | ZStack projects with resource summary |
| F-07 | Resource Groups | User-defined groups mapping multiple projects; aggregated capacity report |
| F-08 | Report Export | Client-side CSV and PDF export on every page |
| F-09 | Dashboard | Cluster-wide summary cards, top-hosts by utilization, trend chart previews |
| F-10 | User Management | JWT auth, three roles (Admin/Operator/Viewer), per-module permission matrix |
| F-11 | **Disk Health Monitoring** | NVMe SMART data — SCP collection from storage nodes, parsed per-drive metrics, health badges, storage node CRUD |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI Library | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| State | TanStack Query (React Query) |
| Backend | Python 3.11 + FastAPI |
| ORM | SQLAlchemy 2.x (async) + Alembic |
| Database | PostgreSQL 15 |
| Auth | JWT HS256 + bcrypt |
| SSH / SFTP | asyncssh |
| Scheduler | APScheduler (AsyncIOScheduler) |
| Containerization | Docker + Docker Compose |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React)                       │
│  Dashboard · Hosts · Storage · VMs · Projects           │
│  Resource Groups · Reports · Disk Health · Users         │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / REST (JWT Bearer)
┌───────────────────────▼─────────────────────────────────┐
│                 FastAPI Backend (:8000)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ ZStack Sync  │  │ smartctl     │  │ APScheduler   │  │
│  │ (AccessKey)  │  │ SCP + Parse  │  │               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
└─────────┼────────────────┼────────────────────────────--─┘
          │ GET only        │ asyncssh SFTP
          ▼                 ▼
   ┌─────────────┐   ┌─────────────────┐
   │ ZStack API  │   │ Storage Nodes   │
   │ (private    │   │ /root/smartctl/ │
   │  cloud)     │   │ *_smart.txt     │
   └─────────────┘   └─────────────────┘
          │
   ┌──────▼──────────────────────────┐
   │        PostgreSQL 15            │
   │ hosts · vms · storage · projects│
   │ disk_health_records             │
   │ storage_nodes · app_users       │
   └─────────────────────────────────┘
```

**Golden rule:** ZStack API is query-only. This app never creates, modifies, or deletes any ZStack resource. All write operations target only this app's own PostgreSQL database.

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- ZStack management endpoint and AccessKey credentials
- (Optional) SSH access to storage nodes for disk health monitoring

### 1. Clone and configure

```bash
git clone <repo>
cd elicloudmonitor
cp .env.example .env
# Edit .env — see Environment Variables section below
```

### 2. Prepare directories

```bash
mkdir -p smartctl ssh_keys
# Place SSH private keys for storage nodes in ssh_keys/
# e.g.: ssh_keys/storage.pem (chmod 600)
```

### 3. Start all services

```bash
docker compose up -d
```

The app will be available at `http://localhost`.

### 4. First login

| Field | Value |
|-------|-------|
| URL | `http://localhost` |
| Email | `admin@elitery.com` |
| Password | `admin123` |

> **Change the default password immediately** — go to Users → edit the admin account.

### 5. Verify data sync

After startup, the backend automatically syncs from ZStack and parses any smartctl files in `./smartctl/`. Check the dashboard — the "Last Sync" badge should be green within 30 seconds.

---

## Environment Variables

All configuration is via `.env` file or environment variables. Never hardcode secrets.

### ZStack Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `ZSTACK_ENDPOINT` | `http://zstack-mgmt:8080` | ZStack management API base URL |
| `ZSTACK_ACCESS_KEY_ID` | — | ZStack AccessKey ID |
| `ZSTACK_ACCESS_KEY_SECRET` | — | ZStack AccessKey secret |
| `ZSTACK_POLL_INTERVAL_SECONDS` | `300` | How often to sync from ZStack (seconds) |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://elicloud:elicloud@postgres:5432/elicloudmonitor` | PostgreSQL async connection string |

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `changeme-in-production` | JWT signing secret — **must change in production** |
| `APP_PORT` | `8000` | Backend listening port |
| `APP_ENV` | `development` | `development` or `production` |
| `ADMIN_DEFAULT_EMAIL` | `admin@elitery.com` | Seed admin email (used only on first startup) |
| `ADMIN_DEFAULT_PASSWORD` | `admin123` | Seed admin password (used only on first startup) |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

### Disk Health Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `SMARTCTL_DIR` | `/app/smartctl` | Local directory where smartctl `.txt` files are stored (mounted from `./smartctl`) |
| `SMARTCTL_COLLECT_INTERVAL_SECONDS` | `3600` | How often the scheduler runs SCP collection from storage nodes (seconds) |
| `SMARTCTL_KNOWN_HOSTS` | `` | Path to SSH known_hosts file on backend; leave empty to skip host key verification |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base URL (used at build time) |

### Cloudflare Tunnel (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_DOMAIN` | — | Public domain served via Cloudflare Tunnel (e.g. `elicloudmonitor.example.com`) — added to CORS allow-list automatically |
| `CLOUDFLARE_TUNNEL_TOKEN` | — | Cloudflare Tunnel token — if set, a `cloudflared` container is started automatically in Docker Compose |

---

## Application Walkthrough

### Login (`/login`)

Entry point for all users. Enter email and password. On success, a JWT (8-hour expiry) is stored in `localStorage` and the user is redirected to the dashboard. Invalid credentials or inactive accounts are rejected with an inline error.

---

### Dashboard (`/`)

Cluster-wide overview at a glance:

- **Summary cards** — total hosts, running VMs, stopped VMs, storage used, CPU allocation rate, memory allocation rate
- **Last Sync badge** — green (success), yellow (partial), red (failed)
- **VM creation trend** — bar chart, last 30 days
- **Storage provisioned/day** — bar chart, last 30 days
- **Compute provisioned/day** — dual-axis bar chart (amber = vCPU, teal = RAM GB), last 30 days
- **Top hosts by CPU overcommit** — table of most-loaded hypervisors
- **Storage utilization bars** — per-pool progress bars

---

### Hosts (`/hosts`)

Physical hypervisor nodes. Table columns:

| Column | Description |
|--------|-------------|
| Name | Host display name |
| Management IP | Host management interface IP |
| State | Enabled / Disabled |
| CPU Used / Total | Allocated vCPU vs physical cores |
| Memory Used / Total | Allocated vRAM vs physical RAM |
| VMs | Number of VMs currently on this host |
| Overcommit Ratio | Allocated / Physical (>1 = overcommitted) |

Below the table: a **CPU & Memory Trend** chart for the selected host or all hosts, with 7d / 30d / 90d presets.

---

### Storage (`/storage`)

Primary storage pools. Two views — **Physical Capacity** and **Virtual Capacity** — each showing:

| Column | Description |
|--------|-------------|
| Name | Pool display name |
| Type | Ceph, SharedBlock, LocalStorage, etc. |
| State | Enabled / Disabled |
| Total | Total raw capacity |
| Used | Used capacity |
| Free | Free capacity |
| 90% Usable Free | Headroom before hitting 90% threshold |
| Utilization | Progress bar (green → amber → red) |

Ceph pools expand into sub-rows showing each underlying pool. Below: **Virtual Capacity Trend** chart with pool selector and date-range presets.

---

### Virtual Machines (`/vms`)

Full VM inventory — up to 2,000 VMs loaded with client-side search and filtering. The page has two sections:

#### User VMs

| Column | Description |
|--------|-------------|
| Name | VM display name |
| State | Running / Stopped / etc. |
| Project | ZStack project (may be N/A — admin-owned VMs) |
| Host | Hypervisor placement |
| Private IP | Internal network address |
| EIP | Elastic (public) IP if assigned |
| vCPU / vRAM | Compute allocation |
| Storage | Total attached volume size |
| Created At | Original ZStack creation timestamp |

Search bar filters across name and IP. State/project dropdowns narrow results. **Export CSV** downloads the visible rows.

#### Infrastructure VMs

ZStack-internal appliance VMs (vRouters, Load Balancers, etc.) displayed in a separate section below. These are **not counted** in running/stopped/total VM statistics.

| Column | Description |
|--------|-------------|
| Type | Badge: vRouter (violet) / LB (amber) / Replication (cyan) / Appliance (slate) |
| Name | Appliance VM name |
| State | Current state |
| Host | Hypervisor placement |
| OS | Platform |
| Private IP | Internal IP |
| Owner / Project | Associated project if any |
| vCPU / vRAM | Compute allocation |
| Created At | Creation timestamp |

Default pagination: 5 items per page. Search across name and IP.

---

### Projects (`/projects`)

All ZStack IAM2 projects with resource summary — VM count, total vCPU, vRAM, and storage allocation. VM–project ownership is resolved via ZQL (`query accountresourceref`) during each sync run, covering 97% of VMs. The remaining 3% are admin-owned VMs with no associated project.

---

### Resource Groups (`/resource-groups`)

User-defined groupings that aggregate multiple ZStack projects:

- **Create** — give the group a name and select one or more projects
- **Edit** — rename, change project membership
- **Delete** — removes the group definition only; no ZStack data is affected
- **Aggregated metrics** — total VMs, vCPU, vRAM, storage across all projects in the group

---

### Reports (`/reports`)

Three tab views with date-range filtering:

| Tab | Chart | Table |
|-----|-------|-------|
| VMs Created | Bar chart of VMs created/day | Date, Count |
| Storage Provisioned | Bar chart of GB provisioned/day | Date, GB |
| Compute Provisioned | Dual-axis bar (vCPU + RAM GB) | Date, vCPU, RAM GB |

**Export CSV** and **Export PDF** buttons are available on each tab.

---

### Disk Health (`/disk-health`)

NVMe SMART health monitoring across all storage nodes.

#### Summary cards

| Card | Meaning |
|------|---------|
| Total Drives | All NVMe devices in the database |
| PASSED | Drives with SMART health = PASSED |
| Warning | PASSED but with degraded Available Spare (<90%) or high endurance use (≥80%) |
| Not Good | FAILED health, critical warning, spare at/below threshold, media errors |

#### NVMe Drive Details table

| Column | Description |
|--------|-------------|
| Hostname | Storage node label |
| NVMe Device | Device name (e.g. `nvme0n1`) |
| Model | Dell OEM model string |
| Capacity | Drive capacity in TB |
| TBW | Terabytes Written (cumulative) |
| Endurance Used | Percentage Used from SMART (wear gauge) |
| Life Remaining | 100% − Endurance Used |
| Available Spare | NAND spare blocks remaining |
| Disk Health | PASSED (green) / FAILED (red) badge |
| Summary | Good / Warning / Not good |
| Notes | Human-readable explanation |

Row background: red-tinted for "Not good", amber-tinted for "Warning". Filter by hostname or health status.

**Collect & Refresh** — triggers SCP download from all enabled storage nodes followed by re-parse. Shows a result message (nodes collected, files parsed, any failures).

**Export CSV** — downloads the currently filtered view.

#### Storage Nodes table

Manage the SSH config used for SFTP collection:

| Column | Description |
|--------|-------------|
| Hostname | Label (must match filename prefix on remote host) |
| SSH Host | IP or FQDN the backend connects to |
| Port | SSH port (default 22) |
| User | SSH login user |
| Key Path | Absolute path to private key on the backend container |
| Remote Dir | Directory on the storage node containing `*_smart.txt` files |
| Enabled | Whether this node is included in scheduled collection |
| Last Collected | Timestamp of most recent successful SFTP pull |
| Status | Success / Failed / Never |
| Error | Last error message if collection failed |

Add, edit, or delete nodes using the **Add Node** button and row actions.

---

### Users (`/users`) — Admin only

Full user lifecycle management. Non-Admin users are redirected to `/`.

#### User table

| Column | Description |
|--------|-------------|
| User | Avatar + display name |
| Email | Login email |
| Role | Admin (violet) / Operator (amber) / Viewer (slate) |
| Status | Active / Inactive |
| Session | Live session status — **Online** (green dot, active <5 min), **Idle** (amber dot, 5 min–8 hr), **Offline** (gray dot, >8 hr or never) |
| Last Login | Timestamp of the most recent successful login |
| Created At | Account creation date |

#### Actions (Admin only)

- **Edit** (pencil icon) — name, email, role, status, optional password reset
- **Permissions** (shield icon) — per-module View/Manage matrix
- **Delete** (trash icon) — double-click to arm, then click again to confirm

#### Role defaults

| Module | Admin | Operator | Viewer |
|--------|-------|----------|--------|
| Dashboard | view + manage | view | view |
| Hosts | view + manage | view + manage | view |
| VMs | view + manage | view + manage | view |
| Storage | view + manage | view + manage | view |
| Projects | view + manage | view + manage | view |
| Resource Groups | view + manage | view + manage | view |
| Reports | view + manage | view | view |
| Disk Health | view + manage | view + manage | view |
| User Management | view + manage | — | — |

---

## How-To / Knowledge Base

### Setting up ZStack credentials

1. Log in to ZStack as an administrator
2. Navigate to **Platform** → **AccessKey**
3. Create a new AccessKey and note the **ID** and **Secret**
4. Set in `.env`:
   ```env
   ZSTACK_ENDPOINT=http://<your-zstack-ip>:8080
   ZSTACK_ACCESS_KEY_ID=<your-key-id>
   ZSTACK_ACCESS_KEY_SECRET=<your-key-secret>
   ```
5. Restart the backend: `docker compose restart backend`

ZStack sync runs automatically every `ZSTACK_POLL_INTERVAL_SECONDS` (default: 5 minutes). You can also trigger a manual sync via `POST /api/v1/sync/trigger`.

---

### Setting up Disk Health Monitoring

This is a three-step setup: **storage node script**, **SSH key**, **add node in UI**.

#### Step 1 — Run smartctl collector on each storage node

Copy `smartctl/nvme_smartctl.sh` to each storage server. The script must run as root.

```bash
# On the storage node (as root):
chmod +x nvme_smartctl.sh
bash nvme_smartctl.sh
```

The script outputs files to `/root/smartctl/` in the format `{HOSTNAME}_{DEVICE}_smart.txt`. Set up a cron job to keep files fresh:

```bash
# Run every 6 hours
0 */6 * * * /root/nvme_smartctl.sh
```

#### Step 2 — Prepare SSH access

The EliCloud Monitor backend needs read-only SSH access to each storage node.

```bash
# On each storage node — add the monitor VM's public key:
cat /path/to/monitor-vm.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# On the monitor VM — place the private key in the ssh_keys/ directory:
cp your-storage-key.pem ./ssh_keys/storage.pem
chmod 600 ./ssh_keys/storage.pem
```

The `./ssh_keys/` directory is mounted into the backend container as `/app/ssh_keys` (read-only).

#### Step 3 — Add storage nodes in the UI

1. Navigate to **Disk Health** in the sidebar
2. Scroll to the **Storage Nodes** section at the bottom
3. Click **Add Node** and fill in:

| Field | Value |
|-------|-------|
| Hostname | Label matching the hostname prefix in filenames (e.g. `zs-storage01`) |
| SSH Host | IP or FQDN of the storage node |
| SSH Port | `22` (default) |
| SSH User | `root` |
| Key Path | `/app/ssh_keys/storage.pem` |
| Remote Dir | `/root/smartctl` |
| Enabled | Checked |

4. Click **Save**
5. Click **Collect & Refresh** to run an immediate collection and parse

If collection succeeds, the **Last Collected** and **Status** columns update, and drive data populates in the table above.

#### Troubleshooting collection errors

| Error | Likely cause | Fix |
|-------|-------------|-----|
| `Permission denied` | Wrong SSH key or user | Verify key path and authorized_keys on the storage node |
| `Connection refused` | Host unreachable or wrong port | Verify SSH Host IP and firewall rules |
| `No such file` | Wrong remote_dir | Check that the script has run and `/root/smartctl/` exists |
| Files appear but no drives show | Filename format mismatch | Ensure script uses `${HOSTNAME}_${DEVICE}_smart.txt` format |

---

### Managing Users

#### Creating a user (Admin only)

1. Go to **Users** page
2. Click **+ Add User**
3. Enter name, email, role, status, and password
4. Click **Save** — permissions auto-initialize to role defaults

#### Changing a user's permissions

1. Click the **shield icon** on any user row
2. Check/uncheck View and Manage per module
3. Note: checking Manage auto-checks View; unchecking View auto-unchecks Manage
4. Click **Save**

#### Deactivating a user

1. Click the **pencil icon** on the user row
2. Change Status to **Inactive**
3. Save — the user can no longer log in but the account is preserved

#### Resetting a password

1. Click the pencil icon
2. Enter a new password in the optional Password field
3. Save — takes effect on the next login attempt

#### Deleting a user

Click the **trash icon** once to arm (turns red). Click again within 3 seconds to confirm. This is irreversible.

---

### Resource Groups

Resource Groups let you aggregate multiple ZStack projects into a named group for reporting.

#### Creating a group

1. Go to **Resource Groups**
2. Click **New Group**
3. Enter a name, optional description, and select one or more projects
4. Save

#### Editing a group

Click the group name to open the detail view, then use the Edit button. You can rename the group, add or remove projects.

#### Deleting a group

Click Delete on the group card. This only removes the group definition — no ZStack data is affected.

#### Exporting a group report

From the group detail view, click **Export CSV** to download all VMs across all projects in the group.

---

### Exporting Data

Export is available on all major pages. All exports are generated client-side.

| Page | Export format | What it contains |
|------|--------------|-----------------|
| VMs | CSV | All visible rows after filtering |
| Reports → VMs | CSV, PDF | VM creation trend data for the selected date range |
| Reports → Storage | CSV, PDF | Storage provisioned/day for the selected date range |
| Reports → Compute | CSV, PDF | vCPU + RAM provisioned/day for the selected date range |
| Disk Health | CSV | All NVMe drive records currently shown |
| Storage (backend) | CSV | `/api/v1/disk-health/export/csv` — server-generated |

---

### Scheduler & Automation

The backend runs two background jobs via APScheduler:

| Job | Interval | What it does |
|-----|----------|-------------|
| `zstack_sync` | `ZSTACK_POLL_INTERVAL_SECONDS` (default: 5 min) | Polls ZStack API, upserts hosts/VMs/storage/projects |
| `disk_health_collect` | `SMARTCTL_COLLECT_INTERVAL_SECONDS` (default: 1 hour) | SCP downloads smartctl files, parses and upserts disk health records |

Both jobs are safe to run while the system is live (idempotent — upsert, not insert).

You can also trigger jobs manually:

```bash
# Manual ZStack sync
curl -X POST http://localhost:8000/api/v1/sync/trigger \
  -H "Authorization: Bearer <your-token>"

# Manual disk health collect + parse
curl -X POST http://localhost:8000/api/v1/disk-health/refresh \
  -H "Authorization: Bearer <your-token>"
```

---

## Project Structure

```
elicloudmonitor/
├── .env                         # Environment config (not committed)
├── .env.example                 # Template for .env
├── docker-compose.yml           # All services
├── smartctl/                    # Smartctl output files (local staging)
│   └── {HOSTNAME}_{DEVICE}_smart.txt
├── ssh_keys/                    # SSH private keys for storage node access
│   └── storage.pem
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini              # Alembic config
│   ├── alembic/
│   │   ├── env.py               # Async-compatible migration runner
│   │   ├── script.py.mako       # Migration file template
│   │   └── versions/            # Migration files (timestamped)
│   └── app/
│       ├── main.py              # App entry, startup hooks, router wiring (runs alembic upgrade head)
│       ├── config.py            # All settings from env vars
│       ├── database.py          # Async SQLAlchemy engine + session
│       ├── security.py          # JWT, bcrypt, get_current_user dependency
│       ├── scheduler.py         # APScheduler — ZStack sync + disk health jobs
│       ├── models/
│       │   ├── host.py          # Physical host
│       │   ├── storage.py       # Primary storage pool
│       │   ├── vm.py            # Virtual machine
│       │   ├── volume.py        # Disk volume
│       │   ├── project.py       # ZStack project
│       │   ├── tag.py           # VM tag
│       │   ├── eip.py           # Elastic IP
│       │   ├── resource_group.py
│       │   ├── snapshot.py      # Host/storage point-in-time metrics
│       │   ├── collection_log.py
│       │   ├── user.py          # App user + permissions JSONB
│       │   ├── disk_health.py   # NVMe SMART record (one row per device)
│       │   └── storage_node.py  # SSH config registry for storage nodes
│       ├── schemas/             # Pydantic v2 request/response schemas
│       ├── routers/
│       │   ├── auth.py          # POST /auth/login, GET /auth/me
│       │   ├── users.py         # App user CRUD
│       │   ├── hosts.py         # Host list + trend
│       │   ├── storage.py       # Storage list + trend
│       │   ├── vms.py           # VM list + trend
│       │   ├── projects.py      # Project list
│       │   ├── resource_groups.py
│       │   ├── dashboard.py     # Summary + all trend endpoints
│       │   ├── compute.py       # Compute trend
│       │   ├── disk_health.py   # GET /disk-health, POST /refresh, GET /export/csv
│       │   ├── storage_nodes.py # StorageNode CRUD
│       │   └── status.py        # App health, sync logs
│       └── services/
│           ├── zstack_client.py # ZStack AccessKey HMAC-SHA1 HTTP client (GET only)
│           ├── sync_service.py  # ZStack data collection orchestration
│           ├── scp_service.py   # asyncssh SFTP collector — downloads *_smart.txt
│           └── smartctl_service.py  # File parser + DB upsert
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── App.tsx              # Router + protected route wrapper
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Hosts.tsx
│       │   ├── Storage.tsx
│       │   ├── VMs.tsx
│       │   ├── Projects.tsx
│       │   ├── ResourceGroups.tsx
│       │   ├── Reports.tsx
│       │   ├── DiskHealth.tsx   # NVMe health table + StorageNode management
│       │   └── Users.tsx
│       ├── components/
│       │   ├── auth/ProtectedRoute.tsx
│       │   ├── layout/          # MainLayout, Sidebar, Header
│       │   ├── charts/          # VMTrendChart, TrendChart, ComputeTrendChart, etc.
│       │   └── ui/              # shadcn/ui components
│       ├── hooks/
│       │   ├── useCurrentUser.ts
│       │   └── usePermission.ts
│       └── lib/
│           ├── api.ts           # Axios client + all types + fetch functions + mock data
│           ├── auth.ts          # Token helpers
│           ├── export.ts        # CSV / PDF export utilities
│           └── utils.ts         # cn, formatTB, formatDate, etc.
└── docs/
    ├── PRD.md                   # Product Requirements Document
    ├── ERD.md                   # Entity Relationship Diagram
    ├── FRD.md                   # Functional Requirements Document
    └── FRS.md                   # Functional Requirements Specification
```

---

## API Reference

### Base URL: `/api/v1`

All endpoints except `POST /auth/login` require `Authorization: Bearer <token>`.

> Full interactive docs (Swagger UI) available at `http://localhost:8000/docs`

---

### Authentication

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| POST | `/auth/login` | No | `{ email, password }` → `{ access_token, token_type, expires_in, user }` |
| GET | `/auth/me` | Yes | Current user profile + `PermissionMap`; also updates `last_active_at` |

#### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/summary` | Cluster-wide counts + storage totals |
| GET | `/dashboard/vm-trend` | VM creation per day (`?days=30`) |
| GET | `/dashboard/storage-trend` | Storage provisioned per day (`?days=30`) |
| GET | `/dashboard/compute-trend` | vCPU + RAM provisioned per day (`?days=30`) |
| GET | `/dashboard/top-hosts` | Top N hosts by CPU utilization |

#### Hosts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hosts` | List all physical hosts |
| GET | `/hosts/trend` | Host CPU/memory snapshot trend |

#### Storage

| Method | Path | Description |
|--------|------|-------------|
| GET | `/storage` | List all primary storage pools |
| GET | `/storage/trend` | Storage capacity trend (`?days=30`) |
| GET | `/storage/capacity-trend` | Physical capacity trend |

#### VMs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vms` | List all user VMs (UserVm type only) |
| GET | `/vms/infrastructure` | List infrastructure / appliance VMs (ApplianceVm type — vRouter, LB, etc.) |
| GET | `/vms/trend` | VM state trend over time |
| GET | `/vms/created-by-period` | VM creation count grouped by period |
| GET | `/vms/created-in-range` | VMs created in a date range (`?start=&end=`) |
| GET | `/vms/compute-trend` | Compute (vCPU + RAM) provisioned per day |

#### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List all IAM2 projects with resource summary |

#### Resource Groups

| Method | Path | Description |
|--------|------|-------------|
| GET | `/resource-groups` | List all resource groups |
| POST | `/resource-groups` | Create a new resource group |
| GET | `/resource-groups/{id}` | Group detail with aggregated summary |
| PUT | `/resource-groups/{id}` | Update group (name, projects) |
| DELETE | `/resource-groups/{id}` | Delete group |

#### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List all app users |
| POST | `/users` | Create a user |
| GET | `/users/{id}` | Single user |
| PUT | `/users/{id}` | Update user (name, email, role, status, password) |
| PUT | `/users/{id}/permissions` | Update permission matrix |
| DELETE | `/users/{id}` | Delete user |

#### Disk Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/disk-health` | All NVMe drive records (`?hostname=&health=PASSED\|FAILED`) |
| POST | `/disk-health/refresh` | Trigger SCP collect + re-parse on all enabled nodes |
| GET | `/disk-health/export/csv` | Server-generated CSV export |

#### Storage Nodes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/storage-nodes` | List all registered SSH nodes |
| POST | `/storage-nodes` | Register a node |
| PUT | `/storage-nodes/{id}` | Update node config |
| DELETE | `/storage-nodes/{id}` | Remove a node |

#### Sync & Status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | App health, last sync time, sync status |
| POST | `/sync/trigger` | Trigger manual ZStack sync |
| GET | `/sync/logs` | Paginated collection log history |

---

### API Usage Walkthrough

#### Step 1 — Get a token

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elitery.com","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo $TOKEN
```

The token is valid for **8 hours**. From an external server replace `localhost` with the server IP or `APP_DOMAIN`.

#### Step 2 — Query data

```bash
# Cluster summary
curl -s http://localhost:8000/api/v1/dashboard/summary \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# All hosts
curl -s http://localhost:8000/api/v1/hosts \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# All VMs
curl -s http://localhost:8000/api/v1/vms \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# All projects
curl -s http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Storage pools
curl -s http://localhost:8000/api/v1/storage \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Last sync status
curl -s http://localhost:8000/api/v1/status \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Disk health (all drives)
curl -s http://localhost:8000/api/v1/disk-health \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# VM creation trend (last 30 days)
curl -s "http://localhost:8000/api/v1/dashboard/vm-trend?days=30" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

#### Step 3 — Python example (persistent session)

```python
import requests

BASE = "http://localhost:8000/api/v1"

# Login once — reuse token for 8 hours
r = requests.post(f"{BASE}/auth/login",
    json={"email": "admin@elitery.com", "password": "admin123"})
r.raise_for_status()
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Query all VMs
vms = requests.get(f"{BASE}/vms", headers=headers).json()
print(f"{len(vms)} VMs")

# Query projects
projects = requests.get(f"{BASE}/projects", headers=headers).json()
for p in projects:
    print(p["name"], "→", p.get("vm_count", 0), "VMs")

# Trigger a manual sync
requests.post(f"{BASE}/sync/trigger", headers=headers)
```

#### Data source note

All API responses are served from the **local PostgreSQL database** — not live from ZStack. Data is refreshed every `ZSTACK_POLL_INTERVAL_SECONDS` (default: 5 minutes) by the background sync job. Check the last sync time at `GET /status`.

---

## Constraints

1. **ZStack API is strictly read-only.** `zstack_client.py` implements GET/query methods only. No POST, PUT, DELETE, or PATCH to ZStack — ever.
2. **All CRUD in this app's own database only.** Resource Groups, StorageNodes, AppUsers, CollectionLogs — the only tables this app writes to.
3. **VM–project association resolved via ZQL, not REST.** ZStack's standard REST API (`VmInstanceInventory`) does not expose account/project ownership. The app uses ZQL (`GET /v1/zql?zql=query accountresourceref ...`) to fetch ownership data from ZStack's internal `AccountResourceRefVO` table. Coverage: ~97% of VMs. The remaining ~3% are admin-owned VMs with no IAM2 project. See `zql_flow.md` for details.
4. **SSH keys must be mounted into the backend container.** Place keys in `./ssh_keys/` and reference them as `/app/ssh_keys/<filename>` in the StorageNode config.
5. **ApplianceVm types are stored but excluded from user-facing counts.** ZStack-internal VMs (vRouters, Load Balancers, etc.) are synced and stored with `vm_type='ApplianceVm'`. They appear in the dedicated Infrastructure VMs section on the VMs page and are excluded from all running/stopped/total VM statistics and dashboard counts.

---

## Development Setup

### Backend (local, without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set env vars or copy .env to backend/
export DATABASE_URL=postgresql+asyncpg://elicloud:elicloud@localhost:5432/elicloudmonitor
export SECRET_KEY=dev-secret
export SMARTCTL_DIR=/path/to/elicloudmonitor/smartctl

uvicorn app.main:app --reload --port 8000
```

### Frontend (local)

```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
```

Frontend dev server: `http://localhost:5173`

### Running with Docker (recommended)

```bash
docker compose up --build
```

Use `docker compose logs -f backend` to tail backend logs including sync activity.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| `PRD.md` | Product Requirements — goals, scope, features, milestones |
| `ERD.md` | Entity Relationship Diagram — all DB entities and relationships |
| `FRD.md` | Functional Requirements — what the system must do |
| `FRS.md` | Functional Requirements Specification — tech stack, API spec, data models |
| `CLAUDE.md` | AI assistant conventions, coding rules, implementation status |
| `zql_flow.md` | ZQL query flow — VM→Project association, other non-REST queries, auth signing |
| `smartctl/CLAUDE.md` | smartctl file format, parsing conventions, drive model quirks |

---

## License

Internal use only — Elitery.
