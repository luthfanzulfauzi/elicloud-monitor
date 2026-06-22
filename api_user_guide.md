# EliCloud Monitor — API User Guide

**Version:** 1.0  
**Date:** 2026-06-18  
**Base URL:** `http://localhost:8000/api/v1`  
**Interactive docs:** `http://localhost:8000/api/v1/docs`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
   - [Login](#post-authlogin)
   - [Get Current User](#get-authme)
3. [Virtual Machines](#virtual-machines)
   - [List VMs](#get-vms)
   - [VMs Created in Range](#get-vmscreated-in-range)
   - [VM Creation Trend](#get-vmscreated-by-period)
   - [Compute Trend](#get-vmscompute-trend)
4. [Response Schemas](#response-schemas)
5. [Error Reference](#error-reference)
6. [Examples](#examples)

---

## Overview

EliCloud Monitor provides a REST API that returns JSON. All data is served from the application database, refreshed automatically from ZStack every 5 minutes.

**General rules:**
- All endpoints except `POST /auth/login` require a valid JWT Bearer token in the `Authorization` header
- Tokens expire after **8 hours** — call `POST /auth/login` again to get a new token
- All timestamps are in **UTC** (ISO 8601 format)
- All size values are in **GB** unless stated otherwise

---

## Authentication

---

### POST `/auth/login`

Authenticate and receive a JWT token. This is the only endpoint that does not require a token.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | Your registered email address |
| `password` | string | Yes | Your password |

**Sample request**

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword"}'
```

**Response — `200 OK`**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 28800,
  "user": {
    "id": "a1b2c3d4-0000-0000-0000-000000000001",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "Operator"
  }
}
```

**Response fields**

| Field | Type | Description |
|---|---|---|
| `access_token` | string | JWT token — include in all subsequent requests |
| `token_type` | string | Always `"bearer"` |
| `expires_in` | integer | Token lifetime in seconds (28800 = 8 hours) |
| `user.id` | UUID | Your user ID |
| `user.name` | string | Your display name |
| `user.role` | string | Your role (`Admin`, `Operator`, or `Viewer`) |

**Error responses**

| Status | Cause |
|---|---|
| `401 Unauthorized` | Wrong email or password |
| `403 Forbidden` | Account is inactive |

---

### GET `/auth/me`

Returns your current user profile. Use this to verify your token is still valid or to retrieve your user ID.

**Authentication:** Bearer token required

**Sample request**

```bash
curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <your-token>"
```

**Response — `200 OK`**

```json
{
  "user": {
    "id": "a1b2c3d4-0000-0000-0000-000000000001",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "Operator",
    "status": "Active",
    "created_at": "2026-05-01T08:00:00",
    "last_login": "2026-06-18T10:30:00"
  }
}
```

---

## Virtual Machines

All VM endpoints return only **UserVm** instances — ZStack internal networking appliances are excluded from all results.

---

### GET `/vms`

Returns the list of virtual machines.

**Authentication:** Bearer token required

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `state` | string | — | Filter by VM state: `Running`, `Stopped`, `Unknown` |
| `search` | string | — | Search by VM name or IP address (case-insensitive, partial match) |
| `page` | integer | `1` | Page number (1-based) |
| `per_page` | integer | `2000` | Results per page (max: 2000) |

**Sample requests**

All VMs:
```bash
curl -s "http://localhost:8000/api/v1/vms" \
  -H "Authorization: Bearer <your-token>"
```

Running VMs only:
```bash
curl -s "http://localhost:8000/api/v1/vms?state=Running" \
  -H "Authorization: Bearer <your-token>"
```

Search by name or IP:
```bash
curl -s "http://localhost:8000/api/v1/vms?search=web-server" \
  -H "Authorization: Bearer <your-token>"
```

Paginate — second page of 50:
```bash
curl -s "http://localhost:8000/api/v1/vms?page=2&per_page=50" \
  -H "Authorization: Bearer <your-token>"
```

**Response — `200 OK`**

Array of VM objects:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "web-server-01",
    "state": "Running",
    "host": "zs-compute01",
    "platform": "Linux",
    "private_ip": "192.168.10.101",
    "eip": "203.0.113.10",
    "vcpu": 4,
    "vram_gb": 8.0,
    "storage_gb": 100.0,
    "created_at": "2026-03-15T07:30:00",
    "project_name": "Project Alpha",
    "root_volume": {
      "name": "ROOT-vol-001",
      "type": "Root",
      "size_gb": 50.0,
      "storage_name": "ceph-pool-ssd"
    },
    "data_volumes": [
      {
        "name": "DATA-vol-001",
        "type": "Data",
        "size_gb": 50.0,
        "storage_name": "ceph-pool-ssd"
      }
    ]
  }
]
```

**VM object fields**

| Field | Type | Description |
|---|---|---|
| `id` | UUID | VM identifier |
| `name` | string | VM display name |
| `state` | string | `Running` · `Stopped` · `Unknown` · `Destroyed` |
| `host` | string \| null | Hypervisor node name where the VM is running |
| `platform` | string \| null | OS platform (`Linux`, `Windows`, etc.) |
| `private_ip` | string \| null | Internal network IP address |
| `eip` | string \| null | Elastic (public) IP if assigned; `null` if none |
| `vcpu` | integer \| null | Number of virtual CPUs |
| `vram_gb` | number \| null | Virtual RAM in GB |
| `storage_gb` | number | Total attached storage in GB (sum of all volumes) |
| `created_at` | string \| null | ISO 8601 UTC timestamp of VM creation in ZStack |
| `project_name` | string \| null | ZStack project this VM belongs to; `null` for admin-owned VMs |
| `root_volume` | object \| null | Root disk details (see below) |
| `data_volumes` | array | List of additional data disks (may be empty) |

**Volume object fields** (applies to `root_volume` and each item in `data_volumes`)

| Field | Type | Description |
|---|---|---|
| `name` | string | Volume name |
| `type` | string | `Root` or `Data` |
| `size_gb` | number | Provisioned size in GB |
| `storage_name` | string \| null | Storage pool name (Ceph pool alias if applicable) |

---

### GET `/vms/created-in-range`

Returns the full VM records for VMs created within a specified date range. Useful for provisioning audits.

**Authentication:** Bearer token required

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `start_date` | string | 30 days ago | Start of range — ISO 8601 date or datetime (`2026-01-01` or `2026-01-01T00:00:00`) |
| `end_date` | string | now | End of range — ISO 8601 date or datetime |

**Sample request**

```bash
curl -s "http://localhost:8000/api/v1/vms/created-in-range?start_date=2026-06-01&end_date=2026-06-18" \
  -H "Authorization: Bearer <your-token>"
```

**Response — `200 OK`**

Same array format as `GET /vms`, ordered by `created_at` descending.

---

### GET `/vms/created-by-period`

Returns VM creation counts grouped by day for a specified date range. Use this to build provisioning trend charts or reports.

**Authentication:** Bearer token required

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `start_date` | string | 30 days ago | Start of range — ISO 8601 date |
| `end_date` | string | today | End of range — ISO 8601 date |

**Sample request**

```bash
curl -s "http://localhost:8000/api/v1/vms/created-by-period?start_date=2026-06-01&end_date=2026-06-18" \
  -H "Authorization: Bearer <your-token>"
```

**Response — `200 OK`**

```json
[
  { "date": "2026-06-01", "count": 3 },
  { "date": "2026-06-02", "count": 0 },
  { "date": "2026-06-05", "count": 7 },
  { "date": "2026-06-18", "count": 2 }
]
```

Only days with at least one VM creation are included — days with zero VMs are omitted.

**Response fields**

| Field | Type | Description |
|---|---|---|
| `date` | string | Date in `YYYY-MM-DD` format |
| `count` | integer | Number of VMs created on that date |

---

### GET `/vms/compute-trend`

Returns daily aggregated compute resources (vCPU + RAM) for VMs created in the specified date range.

**Authentication:** Bearer token required

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `start_date` | string | 30 days ago | Start of range — ISO 8601 date |
| `end_date` | string | today | End of range — ISO 8601 date |

**Sample request**

```bash
curl -s "http://localhost:8000/api/v1/vms/compute-trend?start_date=2026-06-01&end_date=2026-06-18" \
  -H "Authorization: Bearer <your-token>"
```

**Response — `200 OK`**

```json
[
  { "date": "2026-06-01", "vcpu": 12, "ram_gb": 48.0 },
  { "date": "2026-06-05", "vcpu": 28, "ram_gb": 112.0 },
  { "date": "2026-06-18", "vcpu": 8,  "ram_gb": 16.0 }
]
```

**Response fields**

| Field | Type | Description |
|---|---|---|
| `date` | string | Date in `YYYY-MM-DD` format |
| `vcpu` | integer | Total vCPU provisioned for VMs created on this date |
| `ram_gb` | number | Total RAM in GB provisioned for VMs created on this date |

---

## Response Schemas

### VM State values

| Value | Description |
|---|---|
| `Running` | VM is powered on and operational |
| `Stopped` | VM is powered off |
| `Unknown` | State cannot be determined |
| `Destroyed` | VM is being destroyed (transitional) |
| `Migrating` | VM is live-migrating between hosts |
| `Starting` | VM is booting up |
| `Stopping` | VM is shutting down |

### Date / time format

All date-time fields in responses use ISO 8601 UTC format: `2026-06-18T09:22:40`. When passing dates as query parameters, both `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM:SS` are accepted.

---

## Error Reference

| HTTP Status | `detail` | Description |
|---|---|---|
| `401 Unauthorized` | `"Not authenticated"` | Missing, malformed, or expired Bearer token — re-login to get a new token |
| `401 Unauthorized` | `"Could not validate credentials"` | Token signature is invalid |
| `403 Forbidden` | `"Account is inactive"` | Your account has been deactivated — contact your administrator |
| `422 Unprocessable Entity` | validation error object | A query parameter or request body has an invalid value |

All error responses follow the format:
```json
{ "detail": "<error message>" }
```

---

## Examples

### Get a token and list all running VMs

```bash
# Step 1 — Login and save the token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Step 2 — List running VMs
curl -s "http://localhost:8000/api/v1/vms?state=Running" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

### Count VMs created this month

```bash
curl -s "http://localhost:8000/api/v1/vms/created-by-period?start_date=2026-06-01&end_date=2026-06-30" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
total = sum(d['count'] for d in data)
print(f'VMs created this month: {total}')
for d in data:
    print(f\"  {d['date']}: {d['count']}\")
"
```

---

### Export VM list to CSV

```bash
curl -s "http://localhost:8000/api/v1/vms" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json, csv
vms = json.load(sys.stdin)
w = csv.writer(sys.stdout)
w.writerow(['Name','State','Project','Host','Private IP','EIP','vCPU','vRAM (GB)','Storage (GB)','Created At'])
for v in vms:
    w.writerow([v['name'], v['state'], v.get('project_name',''), v.get('host',''),
                v.get('private_ip',''), v.get('eip',''), v.get('vcpu',''),
                v.get('vram_gb',''), v['storage_gb'], v.get('created_at','')])
" > vms_export.csv
echo "Exported $(wc -l < vms_export.csv) rows to vms_export.csv"
```

---

### Python client

```python
import httpx
from datetime import date

BASE = "http://localhost:8000/api/v1"


def login(email: str, password: str) -> str:
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def list_vms(token: str, state: str | None = None, search: str | None = None) -> list[dict]:
    params = {}
    if state:
        params["state"] = state
    if search:
        params["search"] = search
    r = httpx.get(f"{BASE}/vms", params=params, headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()


def vm_creation_trend(token: str, start: date, end: date) -> list[dict]:
    r = httpx.get(
        f"{BASE}/vms/created-by-period",
        params={"start_date": str(start), "end_date": str(end)},
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    return r.json()


# Usage
token = login("user@example.com", "yourpassword")

running = list_vms(token, state="Running")
print(f"Running VMs: {len(running)}")

trend = vm_creation_trend(token, date(2026, 6, 1), date(2026, 6, 30))
total = sum(d["count"] for d in trend)
print(f"VMs created in June 2026: {total}")
```
