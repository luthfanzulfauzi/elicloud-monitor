# Product Requirements Document (PRD)
## EliCloud Monitor

**Version:** 1.0  
**Date:** 2026-05-25  
**Owner:** Elitery  

---

## 1. Overview

EliCloud Monitor is an internal web application for monitoring and reporting on ZStack private cloud infrastructure. It provides a real-time dashboard and historical reporting for infrastructure capacity, utilization, and audit purposes.

---

## 2. Problem Statement

Operations teams managing ZStack private cloud environments need a centralized view of infrastructure health, capacity, and usage across hosts, storage, VMs, and projects. Existing ZStack UI does not provide flexible reporting, resource grouping, or exportable audit-ready reports.

---

## 3. Goals & Objectives

- Provide a real-time dashboard of ZStack cloud resources
- Enable exportable reports (weekly, monthly, yearly)
- Support custom resource grouping for tenant/department-level reporting
- Support project/tenant level reporting
- Enable audit trail through VM creation time tracking
- **Read-only access to ZStack — zero modification of cloud resources, ever**

> **Ultimate Rule:** CRUD operations exist only within this application's own database (users, resource groups, logs). ZStack API is used strictly to query data — no write operations of any kind to ZStack.

---

## 4. Target Users

| User | Role | Primary Need |
|------|------|--------------|
| Cloud Operations | Infrastructure management | Live monitoring, capacity planning |
| IT Manager | Oversight | Monthly/yearly reports |
| Audit Team | Compliance | VM lifecycle audit reports |
| Department Leads | Business view | Resource group reports |

---

## 5. Scope

### In Scope
- Physical host (server) monitoring: list, capacity, usage (physical and virtual)
- Primary storage monitoring: list, capacity, usage (physical and virtual)
- VM list: name, status, project, tags, host placement, private IP, EIP, total volume, storage
- VM creation time tracking for audit and time-series reporting
- Project list from ZStack
- Custom resource grouping (group multiple projects into named groups)
- Report generation and export
- Dashboard visualization

### Out of Scope
- **Writing/modifying ZStack resources — absolutely prohibited; ZStack API is query-only**
- Network topology mapping
- Application performance monitoring
- Multi-cloud (AWS/GCP/Azure) support

---

## 6. Features

### F-01: Host Monitoring Dashboard
Display list of physical hosts with per-host metrics:
- Total CPU cores vs. allocated vCPU
- Total RAM vs. allocated vRAM
- Total local storage vs. used
- Number of VMs running on host

### F-02: Primary Storage Dashboard
Display list of primary storage with:
- Total capacity vs. used
- Physical vs. virtual allocation ratio
- Number of volumes

### F-03: VM Inventory
Full VM listing with filterable columns:
- VM Name, Status (Running/Stopped/etc.)
- Project, Tags
- Host placement
- Private IP, EIP (Elastic IP)
- Total attached volume size
- Storage backend (which primary storage)

### F-04: VM Audit & Time-Series Reporting
- Track VM creation date/time from ZStack metadata
- Aggregate reports: N VMs created in a given week/month/year
- Exportable as CSV/PDF/DOCX

### F-05: Provisioning Trend Reporting
- Track storage provisioned (GB) per day and display as bar chart
- Track compute provisioned (vCPU count and RAM GB) per day and display as dual-axis bar chart
- Available on both the Dashboard (last 30 days preview) and Reports page (filterable date range)
- Compute chart uses separate Y-axes: left axis for vCPU (amber), right axis for RAM GB (teal)

### F-06: Project List
- List all ZStack projects
- VM count and resource summary per project

### F-07: Custom Resource Groups
- UI to define named resource groups
- Each group maps to one or more ZStack projects
- Group-level capacity and usage report
- Exportable report per group

### F-08: Data Collection Engine
- Poll ZStack API using AccessKey ID + AccessKey Secret
- Configurable polling interval
- Read-only API calls only
- Store snapshots for historical reporting

### F-09: Report Export
- Export any dashboard view to PDF or CSV
- Scheduled report generation (daily/weekly/monthly)
- Report covers: hosts, storage, VMs, projects, resource groups

### F-10: User Management & Authentication
- Login page as the application entry point — all pages require a valid session
- Email + password authentication; passwords stored as bcrypt hashes
- JWT-based session (Bearer token, 8-hour expiry); stored in browser localStorage
- Frontend protected routes — unauthenticated users redirected to `/login`
- `last_login` timestamp updated on each successful login
- Logout clears the token and redirects to `/login`
- Full CRUD for application users (not ZStack users)
- Three roles: Admin, Operator, Viewer with role-default permission sets
- Per-user, per-module permission matrix (View / Manage flags for each of 8 modules)
- Admin permissions are fixed and non-editable
- Double-click delete confirmation to prevent accidental deletion
- Current user's role and permissions gate UI visibility across all modules

---

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Availability | Web app accessible 24/7 within internal network |
| Performance | Dashboard loads within 3 seconds; data refresh ≤ 5 minutes |
| Security | API credentials encrypted at rest; HTTPS only |
| Deployment | Docker Compose for single-node; supports multi-env config |
| Scalability | Support up to 500 hosts, 10,000 VMs, 100 projects |
| Maintainability | Frontend, backend, and shared libraries separated |
| Auditability | All data collection events logged with timestamp |

---

## 8. Constraints

- **ZStack API is strictly read-only (query-only).** All CRUD in this system operates on the app's own PostgreSQL database — never on ZStack.
- Must run on-premise (no public cloud dependency)
- Docker preferred for deployment
- Data residency: all data stays on-premise

---

## 9. Success Metrics

- Ops team can generate a monthly VM creation report in under 2 minutes
- Dashboard reflects ZStack state with no more than 5-minute lag
- Zero write operations to ZStack confirmed by API audit log

---

## 10. Milestones

| Phase | Deliverable | Status |
|-------|-------------|--------|
| Phase 0 | Documentation (PRD, ERD, FRD, FRS, CLAUDE.md) | ✅ Complete |
| Phase 1 | Backend API + ZStack data collector | ⚠️ Mostly Complete — missing: `/reports` router, Alembic migrations, auth endpoints |
| Phase 2 | Frontend dashboard — all pages including Users, Reports with provisioning trends | ✅ Complete |
| Phase 2.5 | User authentication — Login page, JWT auth, protected routes, role/permission gating | ✅ Complete |
| Phase 3 | Reporting engine + export (backend-driven CSV/PDF) | 🔲 Pending |
| Phase 4 | Docker packaging + deployment guide | ⚠️ Partially Complete — Compose + Dockerfiles done; Alembic init + deployment docs missing |
