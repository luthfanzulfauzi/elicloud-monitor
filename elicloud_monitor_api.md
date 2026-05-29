# EliCloud Monitor — API Documentation

**Version:** 1.0  
**Base URL:** `http://<server>:8000/api/v1`  
**Interactive docs:** `http://<server>:8000/docs`  
**Data source:** Local PostgreSQL database (synced from ZStack every 5 minutes)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Dashboard](#dashboard)
4. [Hosts](#hosts)
5. [Storage](#storage)
6. [Virtual Machines](#virtual-machines)
7. [Projects](#projects)
8. [Resource Groups](#resource-groups)
9. [Users](#users)
10. [Disk Health](#disk-health)
11. [Storage Nodes](#storage-nodes)
12. [Sync & Status](#sync--status)
13. [Error Reference](#error-reference)
14. [Full Python Client Example](#full-python-client-example)

---

## Overview

EliCloud Monitor exposes a REST API that returns JSON. All responses are served from the application's local PostgreSQL database — not live from ZStack. Data is refreshed automatically every 5 minutes by a background sync job.

**Key rules:**
- All endpoints except `POST /auth/login` require a valid JWT Bearer token
- The API is **read-only for ZStack data** — hosts, VMs, storage, projects are never modified
- Write operations (resource groups, storage nodes, users) only affect the app's own database
- Tokens expire after **8 hours** — re-login to get a new token

---

## Authentication

### POST `/auth/login`

Authenticate and receive a JWT token. This is the only endpoint that does not require a token.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email address |
| `password` | string | Yes | User password |

**Sample request**

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elitery.com","password":"admin123"}'
```

**Sample response**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 28800,
  "user": {
    "id": "80fbde35-c103-4eee-bd9d-9c4ced2ea42a",
    "name": "Administrator",
    "email": "admin@elitery.com",
    "role": "Admin",
    "status": "Active",
    "permissions": {
      "VMs": { "view": true, "manage": true },
      "Hosts": { "view": true, "manage": true },
      "Dashboard": { "view": true, "manage": true }
    },
    "created_at": "2026-05-24T14:29:32.965821Z",
    "last_login": "2026-05-29T12:39:50.484575Z",
    "last_active_at": "2026-05-29T12:40:00.123456Z"
  }
}
```

| Field | Description |
|-------|-------------|
| `access_token` | JWT token to use in all subsequent requests |
| `expires_in` | Token validity in seconds (28800 = 8 hours) |
| `user.permissions` | Per-module `{ view, manage }` flags controlling UI access |
| `user.last_active_at` | Updated on every `GET /auth/me` call — used to derive session status |

**Error responses**

| HTTP | Reason |
|------|--------|
| 401 | Wrong email or password |
| 403 | Account is inactive |

---

### Saving and using the token

**Bash — store in variable**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elitery.com","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Verify
echo $TOKEN

# Use in requests
curl -s http://localhost:8000/api/v1/dashboard/summary \
  -H "Authorization: Bearer $TOKEN"
```

**Python — persistent session**

```python
import requests

BASE = "http://localhost:8000/api/v1"

session = requests.Session()
r = session.post(f"{BASE}/auth/login",
    json={"email": "admin@elitery.com", "password": "admin123"})
r.raise_for_status()
token = r.json()["access_token"]
session.headers.update({"Authorization": f"Bearer {token}"})

# All subsequent calls use the token automatically
r = session.get(f"{BASE}/dashboard/summary")
print(r.json())
```

---

### GET `/auth/me`

Returns the current authenticated user's profile and permission map. Also updates `last_active_at` (used for session status on the Users page).

```bash
curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Response shape is identical to the `user` object inside the login response.

---

## Dashboard

Summary statistics and trend data for the cluster overview page.

---

### GET `/dashboard/summary`

Cluster-wide totals — host count, VM counts, storage, CPU and memory allocation.

```bash
curl -s http://localhost:8000/api/v1/dashboard/summary \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response**

```json
{
  "total_hosts": 20,
  "running_vms": 1104,
  "stopped_vms": 136,
  "total_storage_used_tb": 371.3,
  "total_storage_tb": 575.64,
  "total_cpu_allocated": 10730,
  "total_cpu_total": 28000,
  "total_memory_allocated_gb": 21545.0,
  "total_memory_total_gb": 25675.0,
  "sync_info": {
    "last_sync": "2026-05-29T12:37:02.202151+00:00",
    "status": "success"
  }
}
```

| Field | Description |
|-------|-------------|
| `total_storage_used_tb` | Virtual capacity used across all storage pools |
| `total_cpu_allocated` | vCPU allocated across all VMs |
| `sync_info.status` | `success`, `partial`, or `failed` |

---

### GET `/dashboard/vm-trend`

VM creation count per day for the last N days.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | integer | `30` | Number of past days to include |

```bash
curl -s "http://localhost:8000/api/v1/dashboard/vm-trend?days=7" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response**

```json
[
  { "date": "2026-05-22", "count": 10 },
  { "date": "2026-05-23", "count": 18 },
  { "date": "2026-05-24", "count": 3 },
  { "date": "2026-05-25", "count": 24 },
  { "date": "2026-05-26", "count": 5 },
  { "date": "2026-05-27", "count": 3 },
  { "date": "2026-05-29", "count": 15 }
]
```

Days with zero VM creations are omitted from the response.

---

### GET `/dashboard/storage-trend`

Storage provisioned per day (GB), for the last N days.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | integer | `30` | Number of past days to include |

```bash
curl -s "http://localhost:8000/api/v1/dashboard/storage-trend?days=5" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response**

```json
[
  { "date": "2026-05-24", "value": 190.0 },
  { "date": "2026-05-25", "value": 24191.0 },
  { "date": "2026-05-26", "value": 6104.0 },
  { "date": "2026-05-27", "value": 5060.0 },
  { "date": "2026-05-29", "value": 13314.0 }
]
```

`value` is GB provisioned (total size of new volumes created that day).

---

### GET `/dashboard/compute-trend`

vCPU and RAM provisioned per day, for the last N days.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | integer | `30` | Number of past days to include |

```bash
curl -s "http://localhost:8000/api/v1/dashboard/compute-trend?days=5" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response**

```json
[
  { "date": "2026-05-25", "vcpu": 222, "ram_gb": 432.0 },
  { "date": "2026-05-26", "vcpu": 66,  "ram_gb": 116.0 },
  { "date": "2026-05-27", "vcpu": 10,  "ram_gb": 18.0 },
  { "date": "2026-05-29", "vcpu": 172, "ram_gb": 240.0 }
]
```

---

### GET `/dashboard/top-hosts`

Top N physical hosts ordered by CPU overcommit ratio (highest first).

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `n` | integer | `5` | Number of hosts to return |

```bash
curl -s "http://localhost:8000/api/v1/dashboard/top-hosts?n=3" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response**

```json
[
  {
    "name": "JK3-ELIT-Node-6",
    "management_ip": "10.153.200.17",
    "vcpu_total": 960,
    "vcpu_allocated": 729,
    "memory_total_gb": 1510.0,
    "memory_allocated_gb": 1376.0,
    "vm_count": 101,
    "cpu_overcommit": 0.76,
    "mem_overcommit": 0.91
  }
]
```

---

## Hosts

Physical hypervisor nodes.

---

### GET `/hosts`

List all physical hosts with CPU, memory, and VM count.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `state` | string | — | Filter by state: `Enabled` or `Disabled` |

```bash
# All hosts
curl -s http://localhost:8000/api/v1/hosts \
  -H "Authorization: Bearer $TOKEN"

# Enabled hosts only
curl -s "http://localhost:8000/api/v1/hosts?state=Enabled" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "5a15f249-904a-4d7b-857d-1624f247ae33",
  "name": "JK3-ELIT-Node-12",
  "management_ip": "10.153.200.33",
  "state": "Enabled",
  "vcpu_total": 1120,
  "vcpu_allocated": 492,
  "memory_total_gb": 1510.0,
  "memory_allocated_gb": 1139.0,
  "vm_count": 70,
  "cpu_overcommit": 0.44,
  "mem_overcommit": 0.75
}
```

| Field | Description |
|-------|-------------|
| `cpu_overcommit` | `vcpu_allocated / vcpu_total` — values >1.0 mean overcommitted |
| `mem_overcommit` | `memory_allocated_gb / memory_total_gb` |

---

### GET `/hosts/trend`

Historical CPU and memory snapshots for one or all hosts.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | string (YYYY-MM-DD) | — | Range start |
| `end_date` | string (YYYY-MM-DD) | — | Range end |
| `host_id` | string (UUID) | — | Filter to a single host |

```bash
curl -s "http://localhost:8000/api/v1/hosts/trend?start_date=2026-05-01&end_date=2026-05-29" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "date": "2026-05-29",
  "cpu_allocated": 10730,
  "cpu_total": 28000,
  "memory_allocated_gb": 21545.0,
  "memory_total_gb": 25675.0
}
```

---

## Storage

Primary storage pools.

---

### GET `/storage`

List all primary storage pools — virtual and physical capacity.

```bash
curl -s http://localhost:8000/api/v1/storage \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "1b32b00e-d541-4594-8739-eb7fb93bc322",
  "name": "Tier1-NVME-Enterprise",
  "type": "SharedBlock",
  "state": "Enabled",
  "total_tb": 50.0,
  "used_tb": 38.67,
  "total_physical_tb": 50.0,
  "used_physical_tb": 28.41,
  "volume_count": 210,
  "ceph_pools": null
}
```

| Field | Description |
|-------|-------------|
| `total_tb` / `used_tb` | Virtual (thin-provisioned) capacity |
| `total_physical_tb` / `used_physical_tb` | Actual physical capacity on disk |
| `ceph_pools` | Array of pool breakdowns — present only for Ceph storage types |

---

### GET `/storage/trend`

Storage provisioned per day (GB of new volumes created), with date range filter.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | string (YYYY-MM-DD) | — | Range start |
| `end_date` | string (YYYY-MM-DD) | — | Range end |

```bash
curl -s "http://localhost:8000/api/v1/storage/trend?start_date=2026-05-01&end_date=2026-05-29" \
  -H "Authorization: Bearer $TOKEN"
```

Response: array of `{ "date": "YYYY-MM-DD", "value": <GB> }`

---

### GET `/storage/capacity-trend`

Historical total vs. used capacity snapshots for one or all storage pools.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | string (YYYY-MM-DD) | — | Range start |
| `end_date` | string (YYYY-MM-DD) | — | Range end |
| `storage_id` | string (UUID) | — | Filter to a single pool |

```bash
curl -s "http://localhost:8000/api/v1/storage/capacity-trend?start_date=2026-05-01&end_date=2026-05-29" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "date": "2026-05-29",
  "capacity_total_tb": 575.64,
  "capacity_used_tb": 371.3
}
```

---

## Virtual Machines

Full VM inventory with search, filter, and trend data.

---

### GET `/vms`

List all VMs. Returns up to `per_page` results (default 2000).

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `state` | string | — | Filter: `Running`, `Stopped`, `Paused`, etc. |
| `search` | string | — | Search VM name or IP address |
| `page` | integer | `1` | Page number |
| `per_page` | integer | `2000` | Results per page |

```bash
# All VMs
curl -s http://localhost:8000/api/v1/vms \
  -H "Authorization: Bearer $TOKEN"

# Running VMs only
curl -s "http://localhost:8000/api/v1/vms?state=Running" \
  -H "Authorization: Bearer $TOKEN"

# Search by name
curl -s "http://localhost:8000/api/v1/vms?search=nginx" \
  -H "Authorization: Bearer $TOKEN"

# Pagination
curl -s "http://localhost:8000/api/v1/vms?page=1&per_page=50" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "8294b19a-7031-40e9-aa1b-716a368303c0",
  "name": "jabar-ppdb-minio-nginx",
  "state": "Running",
  "host": "JK3-ELIT-Node-9",
  "platform": "Linux",
  "private_ip": "10.205.35.26",
  "eip": null,
  "vcpu": 16,
  "vram_gb": 16.0,
  "storage_gb": 100.0,
  "created_at": "2026-05-29T18:20:08+00:00",
  "project_name": "Jabar Digital",
  "root_volume": {
    "name": "ROOT-for-jabar-ppdb-minio-nginx",
    "type": "Root",
    "size_gb": 100.0,
    "storage_name": "Tier0-NVME-Primary"
  },
  "data_volumes": []
}
```

| Field | Description |
|-------|-------------|
| `project_name` | IAM2 project — resolved via ZQL; `null` for admin-owned VMs |
| `eip` | Elastic (public) IP — `null` if none assigned |
| `root_volume` | Primary boot disk with storage pool name |
| `data_volumes` | Additional data disks (may be empty) |

---

### GET `/vms/created-by-period`

VM creation count grouped by day, for a date range.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | string (YYYY-MM-DD) | — | Range start |
| `end_date` | string (YYYY-MM-DD) | — | Range end |

```bash
curl -s "http://localhost:8000/api/v1/vms/created-by-period?start_date=2026-05-01&end_date=2026-05-29" \
  -H "Authorization: Bearer $TOKEN"
```

Response: array of `{ "date": "YYYY-MM-DD", "count": <integer> }`

---

### GET `/vms/created-in-range`

Full VM records for VMs created within a date range.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | string (YYYY-MM-DD) | — | Range start |
| `end_date` | string (YYYY-MM-DD) | — | Range end |

```bash
curl -s "http://localhost:8000/api/v1/vms/created-in-range?start_date=2026-05-29&end_date=2026-05-29" \
  -H "Authorization: Bearer $TOKEN"
```

Returns full VM objects (same schema as `GET /vms`) filtered by `created_at` date.

---

### GET `/vms/trend`

VM state snapshots over time (running vs. stopped count per day).

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | string (YYYY-MM-DD) | — | Range start |
| `end_date` | string (YYYY-MM-DD) | — | Range end |

```bash
curl -s "http://localhost:8000/api/v1/vms/trend?start_date=2026-05-01&end_date=2026-05-29" \
  -H "Authorization: Bearer $TOKEN"
```

---

### GET `/vms/compute-trend`

vCPU and RAM provisioned per day for a date range.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | string (YYYY-MM-DD) | — | Range start |
| `end_date` | string (YYYY-MM-DD) | — | Range end |

```bash
curl -s "http://localhost:8000/api/v1/vms/compute-trend?start_date=2026-05-01&end_date=2026-05-29" \
  -H "Authorization: Bearer $TOKEN"
```

Response: array of `{ "date": "YYYY-MM-DD", "vcpu": <integer>, "ram_gb": <float> }`

---

## Projects

ZStack IAM2 projects with resource summaries.

---

### GET `/projects`

List all projects with VM count, resource totals, and quota limits.

```bash
curl -s http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "1c542aaa-d28f-46cd-b8a7-6f6d9e196614",
  "name": "AB - Profindo",
  "description": "",
  "state": "Enabled",
  "vm_count": 2,
  "vcpu_total": 10,
  "vram_total_gb": 34.0,
  "storage_total_tb": 1.875,
  "quota": {
    "vm_num": 20,
    "vcpu_num": 80,
    "memory_gb": 120.0,
    "storage_tb": 10.0,
    "volume_num": 40,
    "eip_num": 20
  }
}
```

| Field | Description |
|-------|-------------|
| `quota` | Resource limits set in ZStack for this project — `null` if no quota is configured |
| `vm_count` | Populated via ZQL `accountresourceref`; `null` if sync not yet run |

---

## Resource Groups

User-defined groupings that aggregate multiple ZStack projects. Full CRUD — these are app-managed, not ZStack resources.

---

### GET `/resource-groups`

List all resource groups with aggregated totals.

```bash
curl -s http://localhost:8000/api/v1/resource-groups \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "6f9827be-d3b9-4091-9ac7-4a3e533343d6",
  "name": "Internal",
  "description": "Elitery Internal Projects",
  "projects": ["Elitery-POC-Internal", "Elitery-Control-Plane", "Elitery-Internal"],
  "project_ids": ["19fced66-...", "8408f55b-...", "f04a6e79-..."],
  "vm_count": 77,
  "vcpu_total": 575,
  "vram_gb": 846.0,
  "storage_gb": 54544.0
}
```

---

### POST `/resource-groups`

Create a new resource group.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Group display name (must be unique) |
| `description` | string | No | Optional description |
| `project_ids` | array[string] | No | UUIDs of projects to include |

```bash
curl -s -X POST http://localhost:8000/api/v1/resource-groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "West Java Cluster",
    "description": "All West Java government projects",
    "project_ids": [
      "1c542aaa-d28f-46cd-b8a7-6f6d9e196614",
      "2e7d3bbb-e39f-4dce-a9b8-7g8h0ie307725"
    ]
  }'
```

Returns the created resource group object (HTTP 201).

---

### GET `/resource-groups/{group_id}`

Get a single resource group by ID.

```bash
GROUP_ID="6f9827be-d3b9-4091-9ac7-4a3e533343d6"
curl -s "http://localhost:8000/api/v1/resource-groups/${GROUP_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

### PUT `/resource-groups/{group_id}`

Update a resource group — rename, update description, or change project membership.

**Request body** (all fields optional)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | New name |
| `description` | string | New description |
| `project_ids` | array[string] | Replaces entire project list |

```bash
curl -s -X PUT "http://localhost:8000/api/v1/resource-groups/${GROUP_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "West Java Cluster - Updated", "project_ids": ["1c542aaa-d28f-46cd-b8a7-6f6d9e196614"]}'
```

---

### DELETE `/resource-groups/{group_id}`

Delete a resource group. Does not affect any ZStack data.

```bash
curl -s -X DELETE "http://localhost:8000/api/v1/resource-groups/${GROUP_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

Returns HTTP 204 on success.

---

## Users

Application user management. All endpoints require Admin role.

---

### GET `/users`

List all application users.

```bash
curl -s http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "f4c11751-5460-42f2-9b20-8f4f2f525a0d",
  "name": "Luthfan Fauzi",
  "email": "luthfan.fauzi@elitery.com",
  "role": "Admin",
  "status": "Active",
  "permissions": {
    "Dashboard": { "view": true, "manage": true },
    "Hosts": { "view": true, "manage": true },
    "VMs": { "view": true, "manage": true },
    "Storage": { "view": true, "manage": true },
    "Projects": { "view": true, "manage": true },
    "Resource Groups": { "view": true, "manage": true },
    "Reports": { "view": true, "manage": true },
    "Disk Health": { "view": true, "manage": true },
    "User Management": { "view": true, "manage": true }
  },
  "created_at": "2026-05-24T14:43:21.647679Z",
  "last_login": "2026-05-29T09:56:47.318966Z",
  "last_active_at": "2026-05-29T09:56:47.575097Z"
}
```

| Field | Description |
|-------|-------------|
| `role` | `Admin`, `Operator`, or `Viewer` |
| `status` | `Active` or `Inactive` — inactive users cannot log in |
| `last_login` | Set on each successful login |
| `last_active_at` | Updated on every `GET /auth/me` call — drives session status display |

---

### POST `/users`

Create a new application user.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name |
| `email` | string | Yes | Login email (must be unique) |
| `role` | string | Yes | `Admin`, `Operator`, or `Viewer` |
| `status` | string | No | `Active` (default) or `Inactive` |
| `password` | string | No | Plain-text password (hashed server-side) |

```bash
curl -s -X POST http://localhost:8000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Ops",
    "email": "john.ops@elitery.com",
    "role": "Operator",
    "status": "Active",
    "password": "SecurePass123!"
  }'
```

Returns the created user object (HTTP 201). Permissions are auto-initialized to role defaults.

---

### GET `/users/{user_id}`

Get a single user by ID.

```bash
USER_ID="f4c11751-5460-42f2-9b20-8f4f2f525a0d"
curl -s "http://localhost:8000/api/v1/users/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

### PUT `/users/{user_id}`

Update user details. All fields are optional. Changing `role` resets permissions to role defaults.

**Request body** (all fields optional)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | New display name |
| `email` | string | New email |
| `role` | string | New role — resets permissions to defaults |
| `status` | string | `Active` or `Inactive` |
| `password` | string | New password (omit to keep current) |

```bash
# Deactivate a user
curl -s -X PUT "http://localhost:8000/api/v1/users/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "Inactive"}'

# Reset password
curl -s -X PUT "http://localhost:8000/api/v1/users/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "NewPassword456!"}'
```

---

### PUT `/users/{user_id}/permissions`

Update a user's per-module permission matrix. Cannot be used on Admin users (Admin permissions are fixed).

**Request body**

```json
{
  "permissions": {
    "Dashboard":       { "view": true,  "manage": false },
    "Hosts":           { "view": true,  "manage": true  },
    "VMs":             { "view": true,  "manage": true  },
    "Storage":         { "view": true,  "manage": false },
    "Projects":        { "view": true,  "manage": false },
    "Resource Groups": { "view": true,  "manage": true  },
    "Reports":         { "view": true,  "manage": false },
    "Disk Health":     { "view": true,  "manage": true  },
    "User Management": { "view": false, "manage": false }
  }
}
```

```bash
curl -s -X PUT "http://localhost:8000/api/v1/users/${USER_ID}/permissions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissions": {"Hosts": {"view": true, "manage": true}, "VMs": {"view": true, "manage": false}}}'
```

---

### DELETE `/users/{user_id}`

Permanently delete a user.

```bash
curl -s -X DELETE "http://localhost:8000/api/v1/users/${USER_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

Returns HTTP 204 on success.

---

## Disk Health

NVMe SMART health data collected from storage nodes via SCP. Data is parsed from `smartctl` output files.

---

### GET `/disk-health`

List all NVMe drive health records.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `hostname` | string | — | Filter by storage node hostname |
| `health` | string | — | Filter by health: `PASSED` or `FAILED` |

```bash
# All drives
curl -s http://localhost:8000/api/v1/disk-health \
  -H "Authorization: Bearer $TOKEN"

# Only failed drives
curl -s "http://localhost:8000/api/v1/disk-health?health=FAILED" \
  -H "Authorization: Bearer $TOKEN"

# Drives from a specific node
curl -s "http://localhost:8000/api/v1/disk-health?hostname=zs-storage01" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "d6f8df38-70b1-456c-9b9c-e824afe03496",
  "hostname": "zs-storage01",
  "nvme_device": "nvme0n1",
  "model_number": "Dell Express Flash NVMe P4610 3.2TB SFF",
  "capacity_tb": 3.2,
  "tbw": 533.0,
  "endurance_used_pct": 4.0,
  "life_remaining_pct": 96.0,
  "available_spare_pct": 99.0,
  "disk_health": "PASSED",
  "summary": "Good",
  "notes": "All indicators nominal",
  "collected_at": "2026-05-29T11:56:04.443714Z"
}
```

| Field | Description |
|-------|-------------|
| `tbw` | Terabytes Written (calculated: `data_units_written × 512000 / 1e12`) |
| `endurance_used_pct` | SMART "Percentage Used" — drive wear gauge |
| `life_remaining_pct` | `100 - endurance_used_pct` |
| `available_spare_pct` | NAND spare blocks remaining (warning threshold: <90%) |
| `disk_health` | `PASSED` or `FAILED` — from SMART overall health assessment |
| `summary` | `Good`, `Warning`, or `Not good` |

---

### POST `/disk-health/refresh`

Trigger an on-demand SCP collection from all enabled storage nodes, followed by re-parsing all downloaded files. May take 30–120 seconds depending on node count.

```bash
curl -s -X POST http://localhost:8000/api/v1/disk-health/refresh \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response**

```json
{
  "nodes_collected": 3,
  "nodes_failed": 0,
  "files_parsed": 143,
  "parse_errors": 0,
  "message": "Collected 3 nodes, parsed 143 files"
}
```

---

### GET `/disk-health/export/csv`

Download all disk health records as a CSV file.

```bash
curl -s "http://localhost:8000/api/v1/disk-health/export/csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o disk_health_export.csv
```

---

### GET `/disk-health/last-updated`

Returns the modification timestamp of the newest smartctl file in the local staging directory, or `null` if no files exist.

```bash
curl -s http://localhost:8000/api/v1/disk-health/last-updated \
  -H "Authorization: Bearer $TOKEN"
```

---

## Storage Nodes

Registry of storage servers used for SCP-based smartctl collection. Full CRUD — app-managed.

---

### GET `/storage-nodes`

List all registered storage nodes.

```bash
curl -s http://localhost:8000/api/v1/storage-nodes \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "hostname": "zs-storage01",
  "ssh_host": "10.153.210.10",
  "ssh_port": 22,
  "ssh_user": "root",
  "ssh_key_path": "/app/ssh_keys/storage.pem",
  "remote_dir": "/root/smartctl",
  "enabled": true,
  "last_collected_at": "2026-05-29T11:56:04.443714Z",
  "last_collect_status": "success",
  "last_collect_error": null,
  "created_at": "2026-05-24T10:00:00.000000Z"
}
```

---

### POST `/storage-nodes`

Register a new storage node.

**Request body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `hostname` | string | Yes | — | Label — must match filename prefix in `*_smart.txt` files |
| `ssh_host` | string | Yes | — | IP or FQDN of the storage server |
| `ssh_port` | integer | No | `22` | SSH port |
| `ssh_user` | string | Yes | — | SSH login user |
| `ssh_key_path` | string | Yes | — | Absolute path to private key inside the backend container |
| `remote_dir` | string | Yes | — | Remote directory containing `*_smart.txt` files |
| `enabled` | boolean | No | `true` | Whether to include in scheduled collection |

```bash
curl -s -X POST http://localhost:8000/api/v1/storage-nodes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "zs-storage02",
    "ssh_host": "10.153.210.11",
    "ssh_port": 22,
    "ssh_user": "root",
    "ssh_key_path": "/app/ssh_keys/storage.pem",
    "remote_dir": "/root/smartctl",
    "enabled": true
  }'
```

Returns the created node object (HTTP 201).

---

### PUT `/storage-nodes/{node_id}`

Update a storage node's configuration. All fields optional.

```bash
NODE_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# Disable a node
curl -s -X PUT "http://localhost:8000/api/v1/storage-nodes/${NODE_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

---

### DELETE `/storage-nodes/{node_id}`

Remove a storage node from the registry. Does not delete any collected data.

```bash
curl -s -X DELETE "http://localhost:8000/api/v1/storage-nodes/${NODE_ID}" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Sync & Status

Background sync status and manual trigger.

---

### GET `/status`

Application health and last ZStack sync summary.

```bash
curl -s http://localhost:8000/api/v1/status \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response**

```json
{
  "status": "ok",
  "last_sync": "2026-05-29T12:37:02.202151+00:00",
  "last_sync_status": "success"
}
```

| `last_sync_status` | Meaning |
|--------------------|---------|
| `success` | All resources synced without error |
| `partial` | Some resources synced; some failed (check sync logs) |
| `failed` | All sync targets failed |

---

### GET `/sync/logs`

Paginated history of all ZStack sync runs.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `per_page` | integer | `20` | Results per page |

```bash
curl -s "http://localhost:8000/api/v1/sync/logs?page=1&per_page=5" \
  -H "Authorization: Bearer $TOKEN"
```

**Sample response (one item)**

```json
{
  "id": "2bf9476e-3add-40b9-990f-065d3d40ec2d",
  "started_at": "2026-05-29T12:36:03.962053+00:00",
  "finished_at": "2026-05-29T12:37:02.202151+00:00",
  "status": "success",
  "hosts_synced": 20,
  "storages_synced": 5,
  "vms_synced": 1230,
  "projects_synced": 120,
  "error_message": null
}
```

---

### POST `/sync/trigger`

Manually trigger an immediate ZStack sync. The sync runs asynchronously — check `GET /status` or `GET /sync/logs` for the result.

```bash
curl -s -X POST http://localhost:8000/api/v1/sync/trigger \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Reference

| HTTP | `detail` | Cause |
|------|----------|-------|
| 401 | `"Not authenticated"` | Missing, expired, or invalid Bearer token |
| 401 | `"Invalid credentials"` | Wrong email or password on login |
| 403 | `"Account is inactive"` | User status is Inactive |
| 404 | `"Not Found"` | Resource ID does not exist |
| 422 | Validation error | Request body or query param failed validation |

**Error response shape**

```json
{
  "detail": "Not authenticated"
}
```

For 422 validation errors:

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "email"],
      "msg": "Field required"
    }
  ]
}
```

---

## Full Python Client Example

A complete example covering authentication, data querying, and writing to app-owned resources.

```python
import requests
from datetime import datetime, timedelta

BASE = "http://localhost:8000/api/v1"


class EliCloudClient:
    def __init__(self, email: str, password: str, base_url: str = BASE):
        self.base = base_url
        self.session = requests.Session()
        self._login(email, password)

    def _login(self, email: str, password: str):
        r = self.session.post(f"{self.base}/auth/login",
            json={"email": email, "password": password})
        r.raise_for_status()
        data = r.json()
        self.session.headers.update({
            "Authorization": f"Bearer {data['access_token']}"
        })
        print(f"Logged in as {data['user']['name']} ({data['user']['role']})")

    # ── Read-only queries ──────────────────────────────────────────────────────

    def summary(self) -> dict:
        return self.session.get(f"{self.base}/dashboard/summary").json()

    def hosts(self, state: str = None) -> list:
        params = {"state": state} if state else {}
        return self.session.get(f"{self.base}/hosts", params=params).json()

    def vms(self, state: str = None, search: str = None) -> list:
        params = {k: v for k, v in {"state": state, "search": search}.items() if v}
        return self.session.get(f"{self.base}/vms", params=params).json()

    def projects(self) -> list:
        return self.session.get(f"{self.base}/projects").json()

    def storage(self) -> list:
        return self.session.get(f"{self.base}/storage").json()

    def disk_health(self, hostname: str = None, health: str = None) -> list:
        params = {k: v for k, v in {"hostname": hostname, "health": health}.items() if v}
        return self.session.get(f"{self.base}/disk-health", params=params).json()

    def vm_trend(self, days: int = 30) -> list:
        return self.session.get(f"{self.base}/dashboard/vm-trend",
            params={"days": days}).json()

    def vms_created_on(self, date: str) -> list:
        """Return all VMs created on a specific date (YYYY-MM-DD)."""
        return self.session.get(f"{self.base}/vms/created-in-range",
            params={"start_date": date, "end_date": date}).json()

    def sync_status(self) -> dict:
        return self.session.get(f"{self.base}/status").json()

    # ── Write operations (app DB only) ─────────────────────────────────────────

    def create_resource_group(self, name: str, description: str,
                               project_ids: list[str]) -> dict:
        r = self.session.post(f"{self.base}/resource-groups",
            json={"name": name, "description": description,
                  "project_ids": project_ids})
        r.raise_for_status()
        return r.json()

    def trigger_sync(self):
        self.session.post(f"{self.base}/sync/trigger")
        print("Sync triggered")

    def refresh_disk_health(self) -> dict:
        r = self.session.post(f"{self.base}/disk-health/refresh")
        r.raise_for_status()
        return r.json()


# ── Usage ──────────────────────────────────────────────────────────────────────

client = EliCloudClient("admin@elitery.com", "admin123")

# Cluster overview
summary = client.summary()
print(f"Hosts: {summary['total_hosts']}")
print(f"VMs: {summary['running_vms']} running, {summary['stopped_vms']} stopped")
print(f"Storage: {summary['total_storage_used_tb']:.1f} / {summary['total_storage_tb']:.1f} TB")
print(f"Last sync: {summary['sync_info']['last_sync']} ({summary['sync_info']['status']})")

# All running VMs
running_vms = client.vms(state="Running")
print(f"\n{len(running_vms)} running VMs")

# VMs created today
today = datetime.utcnow().strftime("%Y-%m-%d")
new_vms = client.vms_created_on(today)
print(f"\n{len(new_vms)} VMs created today ({today}):")
for vm in new_vms:
    print(f"  {vm['name']} | {vm['vcpu']} vCPU | {vm['vram_gb']} GB RAM | {vm['project_name'] or 'no project'}")

# Storage utilization
print("\nStorage pools:")
for pool in client.storage():
    pct = pool['used_tb'] / pool['total_tb'] * 100 if pool['total_tb'] else 0
    print(f"  {pool['name']}: {pool['used_tb']:.1f} / {pool['total_tb']:.1f} TB ({pct:.0f}%)")

# Projects with most VMs
projects = sorted(client.projects(), key=lambda p: p["vm_count"], reverse=True)
print("\nTop 5 projects by VM count:")
for p in projects[:5]:
    print(f"  {p['name']}: {p['vm_count']} VMs, {p['vcpu_total']} vCPU, {p['vram_total_gb']:.0f} GB RAM")

# Disk health summary
drives = client.disk_health()
failed = [d for d in drives if d["disk_health"] == "FAILED"]
warning = [d for d in drives if d["summary"] == "Warning"]
print(f"\nDisk health: {len(drives)} drives, {len(failed)} FAILED, {len(warning)} Warning")
for d in failed:
    print(f"  FAILED: {d['hostname']} / {d['nvme_device']} ({d['model_number']})")
```

---

*Generated from live OpenAPI spec at `http://localhost:8000/openapi.json` on 2026-05-29.*  
*Interactive docs: `http://localhost:8000/docs`*
