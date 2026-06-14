# EliCloud Monitor — Query VM Detail via API

Base URL (localhost): `http://localhost:8000/api/v1`  
Base URL (production): `https://elicloudmonitor.elitery.com/api/v1`

---

## Step 1 — Get Auth Token

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elitery.com","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

Token is stored in `$TOKEN` and used in all requests below.

---

## Step 2 — Query VM by Name

```bash
curl -s "http://localhost:8000/api/v1/vms?search=DRILL-infolokerpublic" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

**Output:**
```json
[
  {
    "id": "f820ce48-604d-4ee5-b565-73e685bb53a7",
    "name": "DRILL-infolokerpublic",
    "state": "Running",
    "host": "JK3-ELIT-Node-16",
    "platform": "Linux",
    "private_ip": "10.110.33.170",
    "eip": null,
    "vcpu": 32,
    "vram_gb": 64.0,
    "storage_gb": 500.0,
    "created_at": "2026-06-08T15:51:17+00:00",
    "project_name": "Diskominfo-DRC-Elicloud",
    "root_volume": {
      "name": "ROOT-for-DRILL-infolokerpublic",
      "type": "Root",
      "size_gb": 500.0,
      "storage_name": "Tier4-SSD"
    },
    "data_volumes": []
  }
]
```

> The `search` param matches against both **VM name** and **private IP** (case-insensitive).

---

## Step 3 — Query Project by Name

Take `project_name` from the VM response above.

```bash
curl -s "http://localhost:8000/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
projects = json.load(sys.stdin)
result = [p for p in projects if p['name'] == 'Diskominfo-DRC-Elicloud']
print(json.dumps(result, indent=2))
"
```

**Output:**
```json
[
  {
    "id": "e5bc0f73-5a7c-42fd-8849-a89f14a657af",
    "name": "Diskominfo-DRC-Elicloud",
    "description": "",
    "state": "Enabled",
    "vm_count": 7,
    "vcpu_total": 120,
    "vram_total_gb": 240.0,
    "storage_total_tb": 9.746,
    "quota": {
      "vm_num": 20,
      "vcpu_num": 200,
      "memory_gb": 500.0,
      "storage_tb": 25.0,
      "volume_num": 40,
      "eip_num": 20
    }
  }
]
```

---

## Step 4 — Query Resource Group by Project Name

```bash
curl -s "http://localhost:8000/api/v1/resource-groups" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
rgs = json.load(sys.stdin)
result = [rg for rg in rgs if 'Diskominfo-DRC-Elicloud' in rg.get('projects', [])]
print(json.dumps(result, indent=2))
"
```

**Output:**
```json
[
  {
    "id": "30a41eaa-bed7-4211-aff4-2e576c7069f0",
    "name": "Diskominfo Jabar DRC",
    "projects": [
      "DISKOM-JABAR-BKD",
      "Diskominfo-DRC-Elicloud",
      "..."
    ]
  }
]
```

---

## Full Chain — One Script

Query VM → Project → Resource Group in a single script:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elitery.com","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

VM_NAME="DRILL-infolokerpublic"

python3 - <<EOF
import urllib.request, json

BASE = "http://localhost:8000/api/v1"
TOKEN = "$TOKEN"
VM_NAME = "$VM_NAME"

def get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"Authorization": f"Bearer {TOKEN}"})
    return json.loads(urllib.request.urlopen(req).read())

# 1. VM
vms = get(f"/vms?search={urllib.parse.quote(VM_NAME)}")
import urllib.parse
vms = get(f"/vms?search={urllib.parse.quote(VM_NAME)}")
vm = next((v for v in vms if v["name"] == VM_NAME), None)
if not vm:
    print("VM not found"); exit(1)

# 2. Project
projects = get("/projects")
project = next((p for p in projects if p["name"] == vm["project_name"]), None)

# 3. Resource Group
rgs = get("/resource-groups")
rg = next((r for r in rgs if vm["project_name"] in r.get("projects", [])), None)

result = {
    "vm": vm,
    "project": project,
    "resource_group": rg,
}
print(json.dumps(result, indent=2))
EOF
```

---

## Quick Reference — Available Filters

| Endpoint | Filter params | Example |
|---|---|---|
| `GET /vms` | `search=<name or IP>`, `state=Running\|Stopped`, `page=1`, `per_page=100` | `?search=node-1&state=Running` |
| `GET /vms/infrastructure` | `search=<name or IP>` | `?search=vRouter` |
| `GET /projects` | — | — |
| `GET /hosts` | `state=Enabled\|Disabled` | `?state=Enabled` |
| `GET /resource-groups` | — | — |
| `GET /storage` | — | — |
