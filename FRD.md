# Functional Requirements Document (FRD)
## EliCloud Monitor

**Version:** 1.4  
**Date:** 2026-06-18  

---

## 1. Purpose

This document describes the functional requirements for EliCloud Monitor — a read-only web dashboard and reporting tool for ZStack private cloud infrastructure.

---

## 2. System Overview

EliCloud Monitor consists of three layers:
1. **Data Collector** — polls ZStack API and stores data locally
2. **Backend API** — serves structured data to the frontend
3. **Frontend Dashboard** — visualizes data and triggers report exports

---

## 3. Functional Requirements

---

### FR-01: ZStack API Integration

> **Ultimate rule:** ZStack API is used strictly for querying data. All CRUD (create, update, delete) happens only in this application's own database. No write operations of any kind shall ever be sent to ZStack.

| ID | Requirement |
|----|-------------|
| FR-01.1 | System shall authenticate to ZStack API using AccessKey ID and AccessKey Secret |
| FR-01.2 | System shall perform only GET/read/query operations to ZStack — POST, PUT, DELETE, and PATCH to ZStack are absolutely prohibited |
| FR-01.3 | System shall store credentials encrypted at rest (not in plaintext config files) |
| FR-01.4 | System shall support configurable polling interval (default: 5 minutes) |
| FR-01.5 | System shall log each collection run with start time, end time, and status |
| FR-01.6 | System shall handle ZStack API errors gracefully and retry with backoff |
| FR-01.7 | System shall support multiple ZStack management node endpoints (for HA setups) |

---

### FR-02: Host (Physical Server) Management

| ID | Requirement |
|----|-------------|
| FR-02.1 | System shall retrieve and store the list of all physical hosts from ZStack |
| FR-02.2 | System shall display per-host: name, management IP, state, hypervisor type |
| FR-02.3 | System shall display per-host CPU: total physical cores and allocated vCPU |
| FR-02.4 | System shall display per-host memory: total RAM and allocated vRAM |
| FR-02.5 | System shall display per-host VM count |
| FR-02.6 | System shall calculate and display CPU overcommit ratio per host |
| FR-02.7 | System shall calculate and display memory overcommit ratio per host |
| FR-02.8 | System shall allow filtering hosts by state (Enabled/Disabled) |
| FR-02.9 | System shall display a summary card with total cluster CPU, memory, and host count |

---

### FR-03: Primary Storage Management

| ID | Requirement |
|----|-------------|
| FR-03.1 | System shall retrieve and store the list of all primary storage backends from ZStack |
| FR-03.2 | System shall display per-storage: name, type, URL/endpoint, state |
| FR-03.3 | System shall display per-storage: total capacity and available capacity in human-readable units |
| FR-03.4 | System shall display per-storage volume count |
| FR-03.5 | System shall calculate and display storage utilization percentage |
| FR-03.6 | System shall display a cluster-wide storage summary (total/used/free) |

---

### FR-04: VM Inventory

| ID | Requirement |
|----|-------------|
| FR-04.1 | System shall retrieve and store all VMs from ZStack |
| FR-04.2 | System shall display per-VM: name, state, project, tags |
| FR-04.3 | System shall display per-VM: host placement |
| FR-04.4 | System shall display per-VM: private IP addresses |
| FR-04.5 | System shall display per-VM: Elastic IP (EIP) if assigned |
| FR-04.6 | System shall display per-VM: total attached volume count and total volume size |
| FR-04.7 | System shall display per-VM: primary storage backend(s) used by its volumes |
| FR-04.8 | System shall display per-VM: vCPU count and memory allocation |
| FR-04.9 | System shall display per-VM: OS platform and source image name |
| FR-04.10 | System shall preserve and display the original ZStack VM creation timestamp |
| FR-04.11 | System shall support search and filter by: name, state, project, tag, host, IP |
| FR-04.12 | System shall support sorting by all displayed columns |
| FR-04.13 | System shall support pagination for large VM lists |
| FR-04.14 | System shall distinguish ZStack-internal appliance VMs (ApplianceVm: vRouters, Load Balancers) from tenant VMs (UserVm) and display them in a separate "Infrastructure VMs" section; appliance VMs shall be excluded from all running/stopped/total VM counts and provisioning trend calculations |

---

### FR-05: VM Audit & Time-Series Reporting

| ID | Requirement |
|----|-------------|
| FR-05.1 | System shall record the ZStack creation timestamp for every VM |
| FR-05.2 | System shall provide a view showing VM count created per day/week/month/year |
| FR-05.3 | System shall allow date-range filtering for creation time reports |
| FR-05.4 | System shall display a bar chart of VM creation counts over time |
| FR-05.5 | System shall allow breakdown of VM creation by project |
| FR-05.6 | System shall provide a view showing storage provisioned (GB) per day as a bar chart |
| FR-05.7 | System shall provide a view showing compute provisioned per day: vCPU count (left Y-axis) and RAM GB (right Y-axis) as a grouped dual-axis bar chart |
| FR-05.8 | Storage and compute provisioning trend charts shall support date-range filtering |
| FR-05.9 | Each provisioning trend view shall show a summary table of daily values below the chart |

---

### FR-06: Project Management

| ID | Requirement |
|----|-------------|
| FR-06.1 | System shall retrieve and store all ZStack projects |
| FR-06.2 | System shall display per-project: name, description |
| FR-06.3 | System shall display per-project: VM count and total resource consumption (vCPU, vRAM, storage) |
| FR-06.4 | System shall allow navigating from a project to its VM list |

---

### FR-07: Resource Grouping

| ID | Requirement |
|----|-------------|
| FR-07.1 | System shall allow users to create named Resource Groups |
| FR-07.2 | System shall allow assigning one or more ZStack projects to a Resource Group |
| FR-07.3 | System shall allow editing a Resource Group (rename, add/remove projects) |
| FR-07.4 | System shall allow deleting a Resource Group (does not affect ZStack data) |
| FR-07.5 | System shall display aggregated resource summary per Resource Group: total VMs, vCPU, vRAM, storage |
| FR-07.6 | System shall support per-group report export |

---

### FR-08: Report Export

| ID | Requirement |
|----|-------------|
| FR-08.1 | System shall allow exporting VM list to CSV |
| FR-08.2 | System shall allow exporting VM creation time-series report to CSV |
| FR-08.3 | System shall allow exporting host summary to CSV |
| FR-08.4 | System shall allow exporting storage summary to CSV |
| FR-08.5 | System shall allow exporting resource group report to CSV |
| FR-08.6 | System shall allow exporting any report view to PDF |
| FR-08.7 | System shall support scheduled report generation (configurable: daily/weekly/monthly) |
| FR-08.8 | Scheduled reports shall be saved to a configurable output directory |

---

### FR-09: Dashboard

| ID | Requirement |
|----|-------------|
| FR-09.1 | System shall provide a home dashboard with summary widgets |
| FR-09.2 | Dashboard shall show: total hosts, total VMs (running/stopped), total storage used/total |
| FR-09.3 | Dashboard shall show: top 5 hosts by CPU utilization |
| FR-09.4 | Dashboard shall show: top 5 hosts by memory utilization |
| FR-09.5 | Dashboard shall show: storage utilization bar per primary storage |
| FR-09.6 | Dashboard shall show: VM creation trend chart (last 30 days) |
| FR-09.7 | Dashboard shall show: last data collection timestamp and status |
| FR-09.8 | Dashboard shall show: storage provisioned per day (last 30 days) bar chart |
| FR-09.9 | Dashboard shall show: compute provisioned per day (last 30 days) dual-axis bar chart (vCPU + RAM GB) |

---

### FR-10: Configuration

| ID | Requirement |
|----|-------------|
| FR-10.1 | System shall support configuration via environment variables |
| FR-10.2 | System shall support configuration via a config file (YAML or .env) |
| FR-10.3 | Configurable items: ZStack endpoint, AccessKey ID, AccessKey Secret, polling interval, DB connection, port |
| FR-10.4 | System shall validate required configuration at startup and fail-fast with clear error message |

---

### FR-11: User Management & Authentication

#### FR-11A: Authentication

| ID | Requirement |
|----|-------------|
| FR-11A.1 | System shall require users to authenticate before accessing any page |
| FR-11A.2 | System shall provide a Login page accepting email and password |
| FR-11A.3 | System shall authenticate users against stored bcrypt-hashed passwords |
| FR-11A.4 | On successful login, system shall issue a signed JWT (Bearer token) with 8-hour expiry |
| FR-11A.5 | Frontend shall store the JWT in localStorage and attach it as `Authorization: Bearer <token>` on all API requests |
| FR-11A.6 | All backend routes except `/auth/login` shall require a valid JWT; return HTTP 401 if missing or expired |
| FR-11A.7 | System shall update `last_login` timestamp for the user on each successful login |
| FR-11A.12 | System shall update `last_active_at` timestamp for the user on every successful `GET /auth/me` request |
| FR-11A.13 | System shall derive and display a session status per user — **Online** (last active <5 min), **Idle** (5 min – 8 hr), **Offline** (>8 hr or never active) |
| FR-11A.8 | System shall provide a logout action that clears the token and redirects to `/login` |
| FR-11A.9 | System shall provide a `/auth/me` endpoint returning the current user's profile and permission map |
| FR-11A.10 | Frontend shall use the current user's `PermissionMap` to gate UI elements (hide/disable per module) |
| FR-11A.11 | Inactive users shall be rejected at login with an appropriate error message |

#### FR-11B: User Management

| ID | Requirement |
|----|-------------|
| FR-11.1 | System shall support application user accounts with name, email, role, and status |
| FR-11.2 | System shall support three roles: Admin, Operator, Viewer — with the following defaults: Admin=all view+manage (locked); Operator=view all except User Management, manage operational modules; Viewer=view all except User Management, manage none |
| FR-11.3 | System shall provide a per-user permission matrix covering all 9 application modules: Dashboard, Hosts, VMs, Storage, Projects, Resource Groups, Reports, Disk Health, User Management |
| FR-11.4 | Each permission entry shall have independent View and Manage flags |
| FR-11.5 | Admin role permissions shall be fixed (all View+Manage) and not editable per-user; the `User Management` module shall have `view=false, manage=false` for all non-Admin roles by default |
| FR-11.6 | Selecting Manage for a module shall automatically select View; deselecting View shall automatically deselect Manage |
| FR-11.7 | System shall allow creating new users via a dialog form (name, email, role, status) |
| FR-11.8 | Creating a user shall initialize permissions to the role's default permission set |
| FR-11.9 | Changing a user's role shall reset their permissions to the new role's defaults |
| FR-11.10 | System shall allow editing user details (name, email, role, status) |
| FR-11.11 | System shall allow editing a user's permission matrix independently of their role |
| FR-11.12 | System shall allow deleting users with a double-click confirmation pattern (arm then confirm) |
| FR-11.13 | Dashboard shall display summary stats: total users, active users, inactive users, admin count |

---

### FR-11C: Data Scope (API Access Restriction)

This sub-feature extends User Management with a data scope control that restricts which infrastructure data a user can see via the API and UI.

| ID | Requirement |
|----|-------------|
| FR-11C.1 | Each application user shall have a `scope_type` attribute with one of three values: `global`, `project`, or `resource_group` |
| FR-11C.2 | Users with `scope_type = global` shall see all infrastructure data (same behavior as before this feature) |
| FR-11C.3 | Users with `scope_type = project` shall see only VMs, projects, resource groups, and dashboard statistics belonging to their assigned projects |
| FR-11C.4 | Users with `scope_type = resource_group` shall see only data belonging to projects within their assigned resource groups |
| FR-11C.5 | Admin users shall always have unrestricted (`global`) access regardless of `scope_type` — their scope cannot be changed |
| FR-11C.6 | The backend shall enforce data filtering at the API layer via a shared dependency (`get_allowed_project_ids`) — never rely on frontend-only filtering for access control |
| FR-11C.7 | The `GET /vms/infrastructure` endpoint shall return an empty list for all scoped (non-global) users |
| FR-11C.8 | The `GET /hosts` endpoint shall return only hosts that run at least one VM in the user's allowed project set |
| FR-11C.9 | System shall allow Admin users to set or change any user's data scope type and their associated project or resource group assignments |
| FR-11C.10 | The Users page shall display each user's current data scope as a color-coded badge (Global = emerald, By Project = sky, By Group = violet) |
| FR-11C.11 | The Users page shall provide a Data Scope dialog for Admin users to select scope type and assign specific projects or resource groups, with a search field to filter long lists |
| FR-11C.12 | Scoped users (project or resource_group scope) shall see only the Virtual Machines page in the UI sidebar — Dashboard, Hosts, Storage, Projects, Resource Groups, Reports, and Disk Health shall be hidden and navigating to those routes shall redirect to `/vms` |
| FR-11C.13 | Scoped users shall not see the Infrastructure VMs section on the VMs page |

---

### FR-12: Disk Health Monitoring

Data source: smartctl output files collected from storage nodes via SCP — not from ZStack API.

#### FR-12A: Storage Node Registry

| ID | Requirement |
|----|-------------|
| FR-12A.1 | System shall maintain a registry of storage nodes (hostname, SSH host/IP, SSH port, SSH user, SSH key path) stored in the app's own database |
| FR-12A.2 | System shall allow adding, editing, and deleting storage node entries (CRUD in app DB only) |
| FR-12A.3 | System shall support enabling or disabling individual storage nodes |
| FR-12A.4 | System shall support an `is_ceph_admin` flag per storage node — reserved for future use; all enabled nodes already collect cluster-wide `ceph osd df` data identically |

#### FR-12B: smartctl Data Collection

| ID | Requirement |
|----|-------------|
| FR-12B.1 | System shall connect to each enabled storage node via SCP using the configured SSH credentials |
| FR-12B.2 | System shall download all files matching `{HOSTNAME}_{NVME_DISK}_smart.txt` from the configured remote directory on each storage node |
| FR-12B.3 | System shall parse each downloaded file to extract NVMe SMART metrics |
| FR-12B.4 | System shall support manual refresh (on-demand SCP collection + re-parse) triggered from the UI |
| FR-12B.5 | System shall record the timestamp of the last successful collection per storage node |
| FR-12B.6 | System shall handle SCP/SSH errors gracefully and log them without crashing the collection run |

#### FR-12C: Parsed SMART Metrics

| ID | Requirement |
|----|-------------|
| FR-12C.1 | System shall extract the following fields from each smartctl output file: Hostname, NVMe Device, Model Number, Total NVM Capacity (Bytes), Data Units Written (for TBW calculation), Percentage Used (Endurance Used), Available Spare, SMART overall-health assessment (PASSED / FAILED) |
| FR-12C.2 | System shall calculate TBW (Terabytes Written) from Data Units Written: `TBW = data_units_written × 512000 / 1e12` |
| FR-12C.3 | System shall calculate Write Endurance (Life Remaining) as `100 - Endurance Used %` |
| FR-12C.4 | System shall generate a human-readable Summary and Notes per disk based on health status and metric thresholds: `Not good` (SMART FAILED, critical warning, spare ≤ threshold, endurance ≥ 100%, or media errors > 0); `Warning` (spare < 90% or endurance used ≥ 70%); `Good` otherwise |
| FR-12C.5 | System shall store the latest parsed record per (hostname, nvme_device) pair — overwrite on each refresh |

#### FR-12D: Disk Health Dashboard Page

| ID | Requirement |
|----|-------------|
| FR-12D.1 | System shall provide a "Disk Health" page displaying a unified table of all NVMe disks across all storage nodes |
| FR-12D.2 | Table shall combine NVMe SMART data with OSD Map and Ceph OSD df data in a single 17-column table: Hostname, NVMe Device, OSD ID, OSD Size, Model, Capacity, TBW, Endurance Used %, Life Remaining %, Available Spare %, Disk Health, Summary, Use%, CRUSH Weight, PGs, Status, Notes |
| FR-12D.3 | Disk Health badge shall reflect the worst condition across all available metrics via a 5-level system computed client-side: **PASSED** (green, all nominal) · **WARNING** (amber, SMART spare <90% or endurance ≥70%, or Ceph use% ≥70%) · **MAJOR** (orange, Ceph use% ≥80%) · **CRITICAL** (red, Ceph use% ≥85% or SMART not-good indicators) · **FAILED** (dark red, `disk_health=FAILED` from smartctl — drive physically dead). Priority: FAILED > CRITICAL > MAJOR > WARNING > PASSED |
| FR-12D.4 | System shall allow filtering the table by Hostname and Disk Health level (PASSED / WARNING / MAJOR / CRITICAL / MISSING) |
| FR-12D.5 | System shall display the timestamp of the last data collection |
| FR-12D.6 | System shall provide a "Refresh" button to trigger on-demand SCP collection + Ceph data refresh simultaneously |
| FR-12D.7 | System shall allow exporting the disk health table to CSV |
| FR-12D.8 | OSD ID and OSD Size columns shall be populated via client-side join: `OsdMapping.hostname::nvme_device → DiskHealthRecord` |
| FR-12D.9 | Use%, CRUSH Weight, PGs, Status columns shall be populated via client-side join: `CephOsdRecord.osd_id → OsdMapping.osd_id` |
| FR-12D.10 | Status badge shall show "active" (reweight > 0) or "out" (reweight = 0) — derived from Ceph reweight, not a raw status field |
| FR-12D.11 | System shall display 6 clickable summary stat cards: Total, PASSED, WARNING, MAJOR, CRITICAL, Missing — clicking any card instantly filters the table to that health level |
| FR-12D.12 | Missing disks shall be visually distinguished with an inline "Missing" badge on their Hostname cell and a muted row background; they are excluded from PASSED/WARNING/MAJOR/CRITICAL counts |

#### FR-12E: Ceph OSD Utilization History

| ID | Requirement |
|----|-------------|
| FR-12E.1 | System shall persist a utilization snapshot for every OSD on each collection run in an append-only `ceph_osd_snapshots` table |
| FR-12E.2 | Each snapshot row shall store: `osd_id`, `utilization`, `kb_used`, `kb_total`, `crush_weight`, `pgs`, `status`, `collected_at` |
| FR-12E.3 | `CephOsdRecord` (latest state) and `CephOsdSnapshot` (history) shall be written atomically in the same DB transaction per collection run |
| FR-12E.4 | System shall expose `GET /ceph-osd/history` with optional `osd_id` filter and `days` parameter (1–365, default 30) returning snapshots ordered by `osd_id, collected_at` |

---

### FR-13: Host Filesystem Monitoring

Data source: Prometheus `node_exporter` HTTP scrape — not ZStack API.

#### FR-13A: Collection

| ID | Requirement |
|----|-------------|
| FR-13A.1 | System shall scrape each ZStack host's `node_exporter` metrics endpoint (default port 9100) on a configurable interval (default: 60 seconds) |
| FR-13A.2 | System shall parse `node_filesystem_size_bytes`, `node_filesystem_avail_bytes`, `node_filesystem_files`, and `node_filesystem_files_free` metrics |
| FR-13A.3 | System shall calculate `used_bytes`, `use_pct`, `inodes_used`, and `inode_use_pct` from raw metrics |
| FR-13A.4 | System shall upsert results into `HostDiskRecord` keyed on `(host_id, mountpoint)` |

#### FR-13B: Display

| ID | Requirement |
|----|-------------|
| FR-13B.1 | Host filesystem disk utilization shall be shown in the Hosts detail view |
| FR-13B.2 | Utilization percentage shall be color-coded: ≥85% = red (danger), ≥70% = amber (warning) |

---

### FR-14: Executive Report Export

#### FR-14A: Report Content

| ID | Requirement |
|----|-------------|
| FR-14A.1 | System shall generate a multi-section "Infrastructure Executive Report" covering: cluster summary, host list, VM list, storage list, project list, and disk health summary |
| FR-14A.2 | Report data shall be assembled client-side from existing API endpoints (no separate report backend required) |

#### FR-14B: Export Formats

| ID | Requirement |
|----|-------------|
| FR-14B.1 | System shall support PDF export (`downloadExecutivePDF` via jsPDF) with multi-page layout, headers, footers, and section tables |
| FR-14B.2 | System shall support XLSX export (`downloadExecutiveXLSX` via ExcelJS) with styled sheets per section, column widths, and header formatting |
| FR-14B.3 | System shall support DOCX export (`downloadExecutiveDOCX` via docx library) with title page, branded header/footer, and per-section tables |
| FR-14B.4 | All three formats shall be accessible from the Reports page under an "Executive Report" section |

---

### FR-12F: Disk Disappearance Tracking

| ID | Requirement |
|----|-------------|
| FR-12F.1 | System shall track when a previously-known disk stops appearing in collection files |
| FR-12F.2 | `DiskHealthRecord` shall include `is_missing` (Boolean, default false) and `missing_since` (DateTime, nullable) columns |
| FR-12F.3 | After each smartctl collection run, the system shall compare parsed `(hostname, nvme_device)` pairs against DB records for all hostnames that appeared in that run; any disk not seen in the latest run shall be marked `is_missing=true` with `missing_since` set to the current timestamp |
| FR-12F.4 | Hostnames that produced zero files in a run (e.g., SCP failure) shall be excluded from the comparison to avoid false-positive missing flags |
| FR-12F.5 | When a missing disk reappears in a subsequent collection run, `is_missing` shall be reset to false and `missing_since` cleared |
| FR-12F.6 | Missing disks shall be excluded from alert checks (only non-missing disks are evaluated for health alerts) |

---

### FR-15: Alerting System

#### FR-15A: Alert Channels

| ID | Requirement |
|----|-------------|
| FR-15A.1 | System shall support configurable webhook-based alert channels (initially Google Chat only) |
| FR-15A.2 | Each channel shall have: name, channel_type (`google_chat`), webhook URL, enabled flag, created_at |
| FR-15A.3 | System shall allow creating, editing, enabling/disabling, and deleting alert channels via the Alerts settings page |
| FR-15A.4 | Creating a channel shall automatically seed three default alert rules: WARNING (24 h), MAJOR (12 h), CRITICAL (1 h) |

#### FR-15B: Alert Rules

| ID | Requirement |
|----|-------------|
| FR-15B.1 | Each channel shall have a set of alert rules keyed on `(channel_id, module, level)` |
| FR-15B.2 | Each rule shall configure: module (e.g., `disk_health`), severity level, repeat interval in hours, and enabled flag |
| FR-15B.3 | System shall allow editing rule interval and enabled state from the Alerts settings page |

#### FR-15C: Alert Logic

| ID | Requirement |
|----|-------------|
| FR-15C.1 | Alert check shall run on a configurable interval (default 300 s via `ALERT_CHECK_INTERVAL_SECONDS`) using APScheduler |
| FR-15C.2 | Alert severity shall mirror the frontend `effectiveLevel()` logic: FAILED/Not-good SMART → CRITICAL; Ceph ≥85% → CRITICAL; Ceph ≥80% → MAJOR; SMART Warning → WARNING; Ceph ≥70% → WARNING; otherwise GOOD |
| FR-15C.3 | System shall deduplicate alerts using an `alert_state` table keyed on `(channel_id, module, item_key, level)`; an alert for a given disk+level is only resent after its configured interval elapses |
| FR-15C.4 | When the level of a disk escalates (e.g., WARNING → CRITICAL), the new level fires immediately since no prior state exists for that level |
| FR-15C.5 | Per check cycle, one grouped message shall be sent per channel covering all due alerts across all levels |
| FR-15C.6 | Alert message shall group disks by severity level (CRITICAL → MAJOR → WARNING), sorted within each group by Ceph utilization descending then Available Spare ascending |

#### FR-15D: Alert Message Format

| ID | Requirement |
|----|-------------|
| FR-15D.1 | Alert messages shall be plain-text with Google Chat markdown (asterisks for bold) |
| FR-15D.2 | Each disk entry shall show: hostname, NVMe device, and reason (SMART notes if non-trivial, Ceph use% if ≥70%) |
| FR-15D.3 | Message shall include a UTC timestamp of when the check ran |

#### FR-15E: Test Alerts

| ID | Requirement |
|----|-------------|
| FR-15E.1 | System shall support a connectivity test (sends a plain confirmation message to the webhook) |
| FR-15E.2 | System shall support per-level test alerts (WARNING / MAJOR / CRITICAL) that use real disk data at that level; if no real disks qualify, dummy data is used with a note |
| FR-15E.3 | Test alerts bypass interval state and are never recorded in `alert_state` |

#### FR-15F: Alerts Settings Page

| ID | Requirement |
|----|-------------|
| FR-15F.1 | System shall provide an Alerts page under the System section of the sidebar, accessible to Admin users only |
| FR-15F.2 | Page shall list all configured channels; each channel row shall be expandable to show its alert rules |
| FR-15F.3 | Each rule row shall allow inline editing of interval (hours) and toggling enabled state |
| FR-15F.4 | Each rule row shall include a "Send Test" button that fires a per-level test alert immediately |

---

## 4. Data Flow

```
ZStack API                  Storage Nodes (SCP)         Hosts (:9100/metrics)
    │                              │                           │
    ▼ (AccessKey auth, GET only)   ▼ (SSH/SCP, read-only)     ▼ (HTTP GET, Prometheus)
ZStack Sync Scheduler     smartctl + lsblk +           Prometheus Scrape
(every 5 min)             ceph_osd_df collectors       Scheduler (every 60 s)
    │                     (on-demand / scheduled)              │
    ▼ (upsert zstack_uuid) ▼ (parse + upsert)                  ▼ (upsert host+mountpoint)
Database (PostgreSQL) ─────────────────────────────────────────┘
    │
    ▼
Backend REST API
    │
    ▼
Frontend Dashboard (browser)
    │
    ▼
Report Export (CSV / PDF / XLSX / DOCX — client-side)
```

---

## 5. Constraints

- **ZStack API is strictly query-only.** All ZStack interactions are GET/read. No write operations of any kind to ZStack — ever.
- **CRUD operations are app-internal only.** Creating, editing, or deleting data (users, resource groups, logs) targets this app's own PostgreSQL database exclusively.
- Credentials must not be stored in version control
- The application must run entirely on-premise
- **lsblk and ceph osd df data are produced externally.** Collector scripts (`lsblk_collect.sh`, `ceph_osd_df_collect.sh`) are deposited on storage nodes; the backend fetches them via SCP — it does not run `lsblk` or `ceph` commands itself
- **All 11 storage nodes produce identical cluster-wide `ceph osd df` data.** Only the newest collected file is parsed to avoid redundant writes
