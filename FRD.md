# Functional Requirements Document (FRD)
## EliCloud Monitor

**Version:** 1.1  
**Date:** 2026-05-29  

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

### FR-12: Disk Health Monitoring

Data source: smartctl output files collected from storage nodes via SCP — not from ZStack API.

#### FR-12A: Storage Node Registry

| ID | Requirement |
|----|-------------|
| FR-12A.1 | System shall maintain a registry of storage nodes (hostname, SSH host/IP, SSH port, SSH user, SSH key path) stored in the app's own database |
| FR-12A.2 | System shall allow adding, editing, and deleting storage node entries (CRUD in app DB only) |
| FR-12A.3 | System shall support enabling or disabling individual storage nodes |

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
| FR-12C.4 | System shall generate a human-readable Summary and Notes per disk based on health status and metric thresholds |
| FR-12C.5 | System shall store the latest parsed record per (hostname, nvme_device) pair — overwrite on each refresh |

#### FR-12D: Disk Health Dashboard Page

| ID | Requirement |
|----|-------------|
| FR-12D.1 | System shall provide a "Disk Health" page displaying a unified table of all NVMe disks across all storage nodes |
| FR-12D.2 | Table columns: Hostname, NVMe Device, Model Number, Capacity, TBW, Endurance Used, Write Endurance (Life Remaining), Available Spare, Disk Health, Summary, Notes |
| FR-12D.3 | Disk Health column shall be color-coded: PASSED=green, FAILED=red |
| FR-12D.4 | System shall allow filtering the table by Hostname and Disk Health status |
| FR-12D.5 | System shall display the timestamp of the last data collection |
| FR-12D.6 | System shall provide a "Refresh" button to trigger an on-demand SCP collection run |
| FR-12D.7 | System shall allow exporting the disk health table to CSV |

---

## 4. Data Flow

```
ZStack API                         Storage Nodes (SCP)
    │                                      │
    ▼  (AccessKey auth, GET only)          ▼  (SSH/SCP, read-only file download)
Data Collector (cron/scheduler)    smartctl Collector (on-demand / scheduled)
    │                                      │
    ▼  (upsert by zstack_uuid)             ▼  (parse + upsert by hostname+device)
Database (PostgreSQL) ─────────────────────┘
    │
    ▼
Backend REST API
    │
    ▼
Frontend Dashboard (browser)
    │
    ▼
Report Export (CSV / PDF)
```

---

## 5. Constraints

- **ZStack API is strictly query-only.** All ZStack interactions are GET/read. No write operations of any kind to ZStack — ever.
- **CRUD operations are app-internal only.** Creating, editing, or deleting data (users, resource groups, logs) targets this app's own PostgreSQL database exclusively.
- Credentials must not be stored in version control
- The application must run entirely on-premise
