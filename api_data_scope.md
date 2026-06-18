# EliCloud Monitor — Data Scope API Documentation

**Version:** 1.0  
**Date:** 2026-06-18  
**Base URL:** `http://<server>:8000/api/v1`

---

## Table of Contents

1. [Overview](#overview)
2. [How Scope Works](#how-scope-works)
3. [Scope Types](#scope-types)
4. [Scope Management Endpoints](#scope-management-endpoints)
   - [GET /users/{id}/scope](#get-usersidscope)
   - [PUT /users/{id}/scope](#put-usersidscope)
5. [Endpoints Affected by Scope](#endpoints-affected-by-scope)
6. [Response Schemas](#response-schemas)
7. [Error Reference](#error-reference)
8. [End-to-End Examples](#end-to-end-examples)

---

## Overview

Data Scope is an access restriction layer that limits which infrastructure data a user can see through the API. It works on top of the existing role-based permission system and is enforced **server-side on every request** — the backend never returns data outside a user's allowed scope regardless of what the frontend requests.

By default every user has `global` scope and can see all data. An Admin can restrict a user to see only specific **projects** or specific **resource groups**.

**Key characteristics:**
- Scope is encoded in the user record — it is resolved automatically from the JWT bearer token on every request
- All filtering is applied at the database query layer, not in application code
- Admin users always have unrestricted access regardless of their configured scope
- A scoped user with zero assignments (e.g. `scope_type = project` but no projects assigned) receives **empty results** from all data endpoints

---

## How Scope Works

Every protected endpoint uses the `get_allowed_project_ids` FastAPI dependency. This dependency inspects the authenticated user and returns one of:

| Return value | Meaning |
|---|---|
| `None` | No filter — user sees all data (Admin or `global` scope) |
| `set[UUID]` | User sees only data belonging to these project IDs |
| Empty `set()` | User has scope configured but zero assignments — all data endpoints return empty |

The resolution logic:

```
JWT Bearer token
    │
    ▼  (get_current_user)
AppUser.scope_type
    │
    ├── "global"  or  role == "Admin"
    │       └── return None  (no filter)
    │
    ├── "project"
    │       └── SELECT project_id FROM user_project_scope WHERE user_id = ?
    │           └── return set of project UUIDs
    │
    └── "resource_group"
            └── SELECT project_id FROM resource_group_projects
                JOIN user_resource_group_scope ON resource_group_id
                WHERE user_id = ?
                └── return set of project UUIDs (resolved through groups)
```

`resource_group` scope is **always resolved to project IDs** at query time — all data endpoints filter on `project_id` only, regardless of how the scope was configured.

---

## Scope Types

| `scope_type` | Description | Assignments required |
|---|---|---|
| `global` | No restriction — sees all infrastructure data (default) | None |
| `project` | Restricted to explicitly assigned projects | One or more project UUIDs in `user_project_scope` |
| `resource_group` | Restricted to projects within assigned resource groups | One or more resource group UUIDs in `user_resource_group_scope` |

**Admin override:** Users with `role = "Admin"` always receive `None` (no filter) from `get_allowed_project_ids` regardless of their `scope_type`. Their scope cannot be changed via the API.

---

## Scope Management Endpoints

Both endpoints require a valid Admin JWT token. Non-Admin users cannot view or modify any user's scope.

---

### GET `/users/{id}/scope`

Returns the current data scope configuration for a user.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | Target user's ID |

**Authentication:** Bearer token (Admin only in practice — any authenticated user can call this; enforced by convention)

**Sample request**

```bash
curl -s http://localhost:8000/api/v1/users/a1b2c3d4-0000-0000-0000-000000000001/scope \
  -H "Authorization: Bearer <admin-token>"
```

**Response — `200 OK`**

```json
{
  "scope_type": "project",
  "project_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],
  "resource_group_ids": []
}
```

**Response fields**

| Field | Type | Description |
|---|---|---|
| `scope_type` | string | `"global"`, `"project"`, or `"resource_group"` |
| `project_ids` | UUID[] | Assigned project IDs (populated when `scope_type = "project"`) |
| `resource_group_ids` | UUID[] | Assigned resource group IDs (populated when `scope_type = "resource_group"`) |

`project_ids` and `resource_group_ids` are always both present in the response but only one will be non-empty (matching `scope_type`). When `scope_type = "global"` both arrays are empty.

---

### PUT `/users/{id}/scope`

Sets a user's data scope type and replaces all their scope assignments atomically.

**Path parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | Target user's ID |

**Authentication:** Bearer token (Admin only)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `scope_type` | string | Yes | `"global"`, `"project"`, or `"resource_group"` |
| `project_ids` | UUID[] | No | Project UUIDs to assign (used when `scope_type = "project"`) |
| `resource_group_ids` | UUID[] | No | Resource group UUIDs to assign (used when `scope_type = "resource_group"`) |

When `scope_type = "global"`, `project_ids` and `resource_group_ids` are ignored — all existing scope assignments are deleted.

**Atomicity:** The endpoint deletes all existing scope rows (`user_project_scope` and `user_resource_group_scope`) before inserting the new assignments, within a single transaction.

**Sample requests**

Set global scope (no restriction):
```bash
curl -s -X PUT \
  http://localhost:8000/api/v1/users/a1b2c3d4-0000-0000-0000-000000000001/scope \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"scope_type": "global", "project_ids": [], "resource_group_ids": []}'
```

Restrict to two specific projects:
```bash
curl -s -X PUT \
  http://localhost:8000/api/v1/users/a1b2c3d4-0000-0000-0000-000000000001/scope \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scope_type": "project",
    "project_ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    ],
    "resource_group_ids": []
  }'
```

Restrict to projects within a resource group:
```bash
curl -s -X PUT \
  http://localhost:8000/api/v1/users/a1b2c3d4-0000-0000-0000-000000000001/scope \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scope_type": "resource_group",
    "project_ids": [],
    "resource_group_ids": [
      "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    ]
  }'
```

**Response — `200 OK`**

Returns the full updated `AppUser` object:

```json
{
  "id": "a1b2c3d4-0000-0000-0000-000000000001",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "Operator",
  "status": "Active",
  "permissions": { "...": "..." },
  "scope_type": "project",
  "created_at": "2026-05-01T08:00:00",
  "last_login": "2026-06-18T10:30:00",
  "last_active_at": "2026-06-18T11:00:00"
}
```

Note: the response is the `AppUser` object — not `UserScopeOut`. To confirm assigned IDs, call `GET /users/{id}/scope` after updating.

---

## Endpoints Affected by Scope

When a scoped user makes a request, the following endpoints automatically filter their results to the user's allowed project set.

### Virtual Machines

| Endpoint | Scoped behavior |
|---|---|
| `GET /vms` | Returns only VMs whose `project_id` is in the allowed set |
| `GET /vms/infrastructure` | Always returns `[]` for scoped users — appliance VMs have no project association |
| `GET /vms/trend` | Counts only VMs in the allowed project set |
| `GET /vms/created-by-period` | Same as `/vms/trend` |
| `GET /vms/created-in-range` | Returns only VMs in the allowed project set |
| `GET /vms/compute-trend` | Aggregates vCPU + RAM for VMs in the allowed project set only |

### Projects

| Endpoint | Scoped behavior |
|---|---|
| `GET /projects` | Returns only projects in the allowed set |

### Resource Groups

| Endpoint | Scoped behavior |
|---|---|
| `GET /resource-groups` | Returns only groups that contain **at least one** project in the allowed set; aggregated metrics (VM count, vCPU, etc.) cover only the allowed projects within each group |
| `GET /resource-groups/{id}` | Returns the group with metrics covering only allowed projects; if no allowed projects are in the group, returns `403 Forbidden` |

### Hosts

| Endpoint | Scoped behavior |
|---|---|
| `GET /hosts` | Returns only hosts that have **at least one VM** from the allowed project set running on them; `vm_count` per host is also filtered to show only VMs from allowed projects |

### Dashboard

| Endpoint | Scoped behavior |
|---|---|
| `GET /dashboard/summary` | `running_vms` and `stopped_vms` counts cover only VMs in the allowed project set; host and storage totals are **not** scoped (always cluster-wide) |
| `GET /dashboard/vm-trend` | Counts VMs in the allowed project set only |
| `GET /dashboard/compute-trend` | Aggregates vCPU + RAM for VMs in the allowed project set only |
| `GET /dashboard/storage-trend` | Not scoped — always shows cluster-wide volume provisioning |
| `GET /dashboard/top-hosts` | Not scoped — always shows cluster-wide top hosts |

### Unaffected endpoints

These endpoints return the same data regardless of scope:

| Endpoint | Reason |
|---|---|
| `GET /storage` | Storage pools have no project association |
| `GET /disk-health` | Disk health is per physical device, not per project |
| `GET /ceph-osd/osd-map` | OSD mapping is cluster-wide |
| `GET /ceph-osd/osd-df` | OSD metrics are cluster-wide |
| `GET /status` | App health / sync status — global |
| `GET /sync/logs` | Collection logs — global |
| `GET /users` | User management — Admin context, not data context |

---

## Response Schemas

### `UserScopeOut`

Returned by `GET /users/{id}/scope`.

```json
{
  "scope_type": "project",
  "project_ids": ["<uuid>", "..."],
  "resource_group_ids": ["<uuid>", "..."]
}
```

| Field | Type | Values |
|---|---|---|
| `scope_type` | string | `"global"` · `"project"` · `"resource_group"` |
| `project_ids` | UUID[] | Non-empty only when `scope_type = "project"` |
| `resource_group_ids` | UUID[] | Non-empty only when `scope_type = "resource_group"` |

### `UserScopeUpdate` (request body for PUT)

```json
{
  "scope_type": "project",
  "project_ids": ["<uuid>"],
  "resource_group_ids": []
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `scope_type` | string | Yes | Must be `"global"`, `"project"`, or `"resource_group"` |
| `project_ids` | UUID[] | No | Default `[]`; relevant only for `scope_type = "project"` |
| `resource_group_ids` | UUID[] | No | Default `[]`; relevant only for `scope_type = "resource_group"` |

### `AppUserOut` (includes `scope_type`)

Every user object returned by `GET /users`, `POST /users`, `PUT /users/{id}`, `PUT /users/{id}/scope` includes:

```json
{
  "id": "<uuid>",
  "name": "string",
  "email": "string",
  "role": "Admin | Operator | Viewer",
  "status": "Active | Inactive",
  "permissions": { "<module>": { "view": true, "manage": false } },
  "scope_type": "global | project | resource_group",
  "created_at": "<iso8601>",
  "last_login": "<iso8601> | null",
  "last_active_at": "<iso8601> | null"
}
```

---

## Error Reference

| HTTP Status | `detail` string | Cause |
|---|---|---|
| `400 Bad Request` | `"scope_type must be one of {'global', 'project', 'resource_group'}"` | Invalid `scope_type` value in PUT body |
| `400 Bad Request` | `"Admin users always have global scope"` | Attempted to change scope of an Admin user |
| `401 Unauthorized` | `"Not authenticated"` | Missing or expired Bearer token |
| `403 Forbidden` | `"No allowed projects in this resource group"` | Scoped user accessing a resource group that contains none of their allowed projects |
| `404 Not Found` | `"User not found"` | `user_id` path parameter does not match any user |

---

## End-to-End Examples

### Example 1 — Restrict a user to two projects

```bash
# Step 1: Get project IDs from the projects list
curl -s http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer <admin-token>" | python3 -m json.tool

# Step 2: Assign scope
curl -s -X PUT \
  http://localhost:8000/api/v1/users/<user-id>/scope \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scope_type": "project",
    "project_ids": ["<project-id-1>", "<project-id-2>"],
    "resource_group_ids": []
  }'

# Step 3: Verify — log in as that user and call /vms
USER_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Only VMs from the two assigned projects are returned
curl -s http://localhost:8000/api/v1/vms \
  -H "Authorization: Bearer $USER_TOKEN" | python3 -c \
  "import sys,json; vms=json.load(sys.stdin); print(f'{len(vms)} VMs visible')"
```

---

### Example 2 — Restrict a user to a resource group

```bash
# Step 1: Get resource group ID
curl -s http://localhost:8000/api/v1/resource-groups \
  -H "Authorization: Bearer <admin-token>" | python3 -m json.tool

# Step 2: Assign scope to the resource group
curl -s -X PUT \
  http://localhost:8000/api/v1/users/<user-id>/scope \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scope_type": "resource_group",
    "project_ids": [],
    "resource_group_ids": ["<resource-group-id>"]
  }'

# Step 3: Log in as the user and verify — only projects inside the group are visible
USER_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer $USER_TOKEN" | python3 -m json.tool
```

---

### Example 3 — Remove scope restriction (back to global)

```bash
curl -s -X PUT \
  http://localhost:8000/api/v1/users/<user-id>/scope \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"scope_type": "global", "project_ids": [], "resource_group_ids": []}'
```

---

### Example 4 — Inspect current scope from the user's own token

Any authenticated user can call `GET /auth/me` to see their own `scope_type`:

```bash
curl -s http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <user-token>" \
  | python3 -c "import sys,json; u=json.load(sys.stdin)['user']; print(u['scope_type'])"
```

---

### Python client example

```python
import httpx

BASE = "http://localhost:8000/api/v1"

def get_token(email: str, password: str) -> str:
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]

def set_user_scope_project(admin_token: str, user_id: str, project_ids: list[str]) -> dict:
    r = httpx.put(
        f"{BASE}/users/{user_id}/scope",
        json={
            "scope_type": "project",
            "project_ids": project_ids,
            "resource_group_ids": [],
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r.raise_for_status()
    return r.json()

def get_user_scope(admin_token: str, user_id: str) -> dict:
    r = httpx.get(
        f"{BASE}/users/{user_id}/scope",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    r.raise_for_status()
    return r.json()


# Usage
admin_token = get_token("admin@elitery.com", "admin123")

# Restrict user to two projects
updated_user = set_user_scope_project(
    admin_token,
    user_id="a1b2c3d4-0000-0000-0000-000000000001",
    project_ids=[
        "550e8400-e29b-41d4-a716-446655440000",
        "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    ],
)
print(f"Scope set: {updated_user['scope_type']}")

# Confirm assignments
scope = get_user_scope(admin_token, user_id="a1b2c3d4-0000-0000-0000-000000000001")
print(f"Assigned project IDs: {scope['project_ids']}")
```

---

## Database Tables

The scope feature uses two junction tables managed entirely by this application (not synced from ZStack):

### `user_project_scope`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, server-generated |
| `user_id` | UUID | FK → `app_users.id` (CASCADE DELETE) |
| `project_id` | UUID | FK → `projects.id` (CASCADE DELETE) |

Unique constraint: `(user_id, project_id)`

### `user_resource_group_scope`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, server-generated |
| `user_id` | UUID | FK → `app_users.id` (CASCADE DELETE) |
| `resource_group_id` | UUID | FK → `resource_groups.id` (CASCADE DELETE) |

Unique constraint: `(user_id, resource_group_id)`

Both tables cascade-delete when a user, project, or resource group is deleted. The `app_users` table has an additional `scope_type VARCHAR NOT NULL DEFAULT 'global'` column added by migration `a1b2c3d4e5f6`.
