# ZQL Flow — VM Queries Not Exposed via ZStack REST API

This document covers the full flow for querying VM data that is unavailable through ZStack's standard REST API, including the VM → Project association using ZQL and related workarounds.

---

## Why ZQL Is Needed

ZStack's REST API exposes `VmInstanceInventory` through `GET /v1/vm-instances`. However, this inventory **does not include account/project ownership**. Several attempted approaches fail:

| Approach | Endpoint | Result |
|---|---|---|
| Filter by project | `GET /v1/vm-instances?q=__projectUuid__=<uuid>` | `503: field not found` |
| Filter by account | `GET /v1/vm-instances?q=accountUuid=<uuid>` | `503: field not found` |
| Account resources listing | `GET /v1/accounts/resources` | Only returns shared resources (roles, images, offerings) — never `VmInstanceVO` |

The **only working approach** for resolving VM → Project ownership is **ZQL** (`GET /v1/zql`), which queries ZStack's internal `AccountResourceRefVO` table directly.

---

## ZQL Endpoint

```
GET /zstack/v1/zql?zql=<url-encoded ZQL statement>
```

- **Auth**: same AccessKey HMAC-SHA1 as all other ZStack calls (see auth section below)
- **URI for signing**: `/v1/zql` (no query string, no `/zstack` prefix)
- **Response shape**:
  ```json
  {
    "results": [
      {
        "inventories": [ { ...record... }, ... ],
        "total": 14920
      }
    ]
  }
  ```
  Note: results are wrapped in a `results` array, **not** the `inventories` top-level key used by standard REST endpoints.

---

## 1. VM → Project Association via `accountresourceref`

### Background

ZStack's IAM2 model stores resource ownership in `AccountResourceRefVO`. This table has one row per resource per account and is the authoritative source for VM ownership. It is accessible only via ZQL.

### Join Chain

```
VM.zstack_uuid
    ↕  accountresourceref.resourceUuid  (where resourceType='VmInstanceVO', isShared=false)
accountresourceref.ownerAccountUuid
    ↕  Project.linked_account_uuid
Project
```

### ZQL Statement

```
query accountresourceref limit 1000 offset 0
```

- No WHERE clause — filter client-side (see below)
- Paginate by incrementing `offset` until `len(page) < limit`
- Total records across all resource types: ~14,920
- VM records (after filtering): ~1,181 of 1,217 total VMs

### Client-Side Filter

After fetching each page, keep only records where:
```python
ref["resourceType"] == "VmInstanceVO" and not ref["isShared"]
```

Records with `isShared=true` are VMs that have been explicitly shared to another account — their `ownerAccountUuid` is the sharer, not the VM's home project.

### Full Python Implementation

Located at `backend/app/services/zstack_client.py:fetch_vm_owner_refs()`:

```python
async def fetch_vm_owner_refs() -> dict[str, str]:
    """Return {vm_zstack_uuid: owner_account_uuid} for all VMs via ZQL."""
    base_url = settings.ZSTACK_ENDPOINT.rstrip("/")
    uri = "/v1/zql"
    url = f"{base_url}/zstack{uri}"
    result: dict[str, str] = {}
    offset = 0

    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            zql = f"query accountresourceref limit 1000 offset {offset}"
            encoded = urllib.parse.quote(zql)
            auth, date_str = _make_auth("GET", uri)
            headers = {"Authorization": auth, "Date": date_str}

            resp = await client.get(f"{url}?zql={encoded}", headers=headers)
            resp.raise_for_status()

            inventories = resp.json().get("results", [{}])[0].get("inventories", [])
            for ref in inventories:
                if ref.get("resourceType") == "VmInstanceVO" and not ref.get("isShared"):
                    result[ref["resourceUuid"]] = ref["ownerAccountUuid"]

            offset += 1000
            if len(inventories) < 1000:
                break

    return result
```

### How It Is Used in Sync

Located at `backend/app/services/sync_service.py` (VM sync block):

```python
# 1. Fetch ZQL owner refs
vm_owner_refs = await zs.fetch_vm_owner_refs()
# → {vm_uuid: owner_account_uuid}

# 2. Build reverse map: linkedAccountUuid → app project id
acct_to_project_id = {
    project.linked_account_uuid: project.id
    for project in all_projects
    if project.linked_account_uuid
}

# 3. Resolve project_id per VM during upsert
owner_acct_uuid = vm_owner_refs.get(vm_uuid)
project_id = acct_to_project_id.get(owner_acct_uuid) if owner_acct_uuid else None
```

### Edge Cases

| Case | Behaviour |
|---|---|
| VM owned by admin account (`36c27e8ff05c4780bf6d2fa65700f22e`) | `project_id = None` — admin VMs have no IAM2 project |
| VM not found in `accountresourceref` | `project_id = None` — rare; occurs for system VMs |
| `fetch_vm_owner_refs()` fails entirely | Log warning, skip project_id population — sync continues, does not fail |
| New VM created between syncs | Resolved on next scheduled sync (default: 5-min interval) |

### Coverage (observed against production ZStack)

- Total VMs: 1,217
- VMs resolved to a project: 1,181 (97%)
- VMs with `project_id = None` (admin-owned): 36 (3%)

---

## 2. VM Tags via `user-tags`

User-defined tags on VMs are also not embedded in `VmInstanceInventory`. They require a separate REST call.

### Endpoint

```
GET /zstack/v1/user-tags?q=resourceType=VmInstanceVO&start=0&limit=1000&replyWithCount=true
```

- This uses the **standard REST API** (not ZQL), but the data is separate from the VM inventory
- Tag format in response: `"tag": "key::value"` — split on `::` to get key and value

### Implementation

Located at `backend/app/services/zstack_client.py:fetch_user_tags()`.

During VM sync, tags are grouped by `resourceUuid` (VM UUID), then written to the `Tag` table using a delete-then-insert pattern per VM to stay idempotent:

```python
# tags_by_vm: dict[vm_uuid, list[tag_dict]]
for vm_uuid, tag_list in tags_by_vm.items():
    await db.execute(delete(Tag).where(Tag.vm_id == vm_id))
    for t in tag_list:
        raw_tag = t.get("tag", "")
        parts = raw_tag.split("::", 1)
        db.add(Tag(vm_id=vm_id, tag_key=parts[0], tag_value=parts[1] if len(parts) > 1 else None))
```

---

## 3. VM Elastic IPs (EIPs)

EIP assignments are not part of `VmInstanceInventory`. The link between a VM NIC and its EIP is resolved through a separate endpoint.

### Endpoint

```
GET /zstack/v1/eips?start=0&limit=1000&replyWithCount=true
```

### Join Chain

```
VM.vmNics[0].uuid  →  EIP.vmNicUuid  →  EIP.vipIp
```

### Implementation in Sync

```python
# Build NIC → EIP map from raw_eips
eip_by_vm_nic = {
    e["vmNicUuid"]: e["vipIp"]
    for e in raw_eips
    if e.get("vmNicUuid") and e.get("vipIp")
}

# During VM upsert, resolve EIP from primary NIC
nics = vm_dict.get("vmNics", [])
if nics:
    nic_uuid = nics[0].get("uuid")
    eip = eip_by_vm_nic.get(nic_uuid)   # None if no EIP assigned
```

---

## 4. VM Disk Usage (Volumes)

Total disk size per VM is not a field on `VmInstanceInventory`. It requires cross-referencing the volumes API.

### Endpoint

```
GET /zstack/v1/volumes?start=0&limit=1000&replyWithCount=true
```

### Join

```
Volume.vmInstanceUuid  →  VM.zstack_uuid
```

### Usage in Sync

```python
vol_gb_by_vm: dict[str, float] = {}
for vol in raw_volumes:
    vm_uuid = vol.get("vmInstanceUuid")
    if vm_uuid:
        vol_gb_by_vm[vm_uuid] = vol_gb_by_vm.get(vm_uuid, 0) + (vol.get("size", 0) or 0) / (1024 ** 3)
```

---

## 5. Project Quotas

IAM2 project quotas are stored against the project's `linkedAccountUuid`, not the project UUID itself. They require a direct account quota query.

### Endpoint

```
GET /zstack/v1/accounts/quotas?q=identityUuid=<linkedAccountUuid>&start=0&limit=1000
```

**Note**: the `=` inside the `q=` value must NOT be URL-encoded by the HTTP client. Build the URL string manually:

```python
full_url = f"{url}?q=identityUuid={account_uuid}&start={start}&limit=1000&replyWithCount=true"
```

### Response

```json
{ "inventories": [{ "name": "vm.num", "value": 100 }, ...] }
```

Returns a flat list of `{name, value}` quota pairs. Convert to a dict and store in `Project.quotas` (JSONB column).

---

## Authentication (HMAC-SHA1)

All ZStack API calls — both REST and ZQL — use the same AccessKey signing scheme:

```
Authorization: ZStack <AccessKeyID>:<Base64(HMAC-SHA1(secret, sig_string))>
Date: <RFC 1123 GMT>
```

The signature string:
```
<HTTP_METHOD>\n<Date>\n<URI>
```

Where:
- `<URI>` = `/v1/<path>` — **no** `/zstack` prefix, **no** query string
- `<Date>` = exact value used in the `Date` header
- Clock drift must be within 15 minutes of the ZStack server

### Python helper (from `zstack_client.py`)

```python
def _make_auth(method: str, uri: str) -> tuple[str, str]:
    date_str = formatdate(usegmt=True)
    sig_str = f"{method}\n{date_str}\n{uri}"
    mac = hmac.new(
        settings.ZSTACK_ACCESS_KEY_SECRET.encode(),
        sig_str.encode(),
        hashlib.sha1,
    )
    signature = base64.b64encode(mac.digest()).decode()
    return f"ZStack {settings.ZSTACK_ACCESS_KEY_ID}:{signature}", date_str
```

For ZQL the signing URI is always `/v1/zql` regardless of the ZQL statement content.

---

## Summary — What Requires ZQL vs. REST

| Data | Endpoint type | Endpoint |
|---|---|---|
| VM inventory (state, CPU, memory, host) | REST | `GET /v1/vm-instances` |
| VM → Project ownership | **ZQL** | `GET /v1/zql?zql=query accountresourceref ...` |
| VM tags | REST (separate call) | `GET /v1/user-tags?q=resourceType=VmInstanceVO` |
| VM EIP assignment | REST (join on vmNicUuid) | `GET /v1/eips` |
| VM disk usage | REST (join on vmInstanceUuid) | `GET /v1/volumes` |
| Project quotas | REST (join on linkedAccountUuid) | `GET /v1/accounts/quotas?q=identityUuid=...` |

ZQL is required **only** for the VM → Project ownership link. Everything else uses the standard REST API with client-side joins.
