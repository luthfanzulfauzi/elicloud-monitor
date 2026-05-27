# Entity Relationship Diagram (ERD)
## EliCloud Monitor

**Version:** 1.1  
**Date:** 2026-05-25  

---

## 1. Entity Overview

| Entity | Description |
|--------|-------------|
| `Host` | Physical server (hypervisor node) in ZStack |
| `PrimaryStorage` | Storage backend attached to ZStack cluster |
| `VM` | Virtual Machine instance in ZStack |
| `Volume` | Disk volume attached to a VM |
| `Project` | ZStack project/tenant grouping VMs |
| `Tag` | Metadata tag applied to VMs |
| `EIP` | Elastic (public) IP address bound to a VM |
| `ResourceGroup` | Custom grouping of projects (app-managed) |
| `ResourceGroupProject` | Join table: ResourceGroup <-> Project |
| `SnapshotHost` | Point-in-time metrics snapshot for a Host |
| `SnapshotStorage` | Point-in-time metrics snapshot for Storage |
| `CollectionLog` | Audit log of each API data collection run |
| `AppUser` | Application user with role and per-module permissions (not a ZStack entity) |
| `StorageNode` | Registry of storage servers that expose smartctl output via SCP (app-managed) |
| `DiskHealthRecord` | Latest parsed NVMe SMART metrics per (hostname, nvme_device) pair (app-managed) |

---

## 2. Entity Definitions

### Host
```
Host {
    id              UUID        PK
    zstack_uuid     VARCHAR     UNIQUE NOT NULL   -- ZStack native UUID
    name            VARCHAR     NOT NULL
    management_ip   VARCHAR
    state           VARCHAR                       -- Enabled, Disabled, etc.
    hypervisor_type VARCHAR                       -- KVM, etc.
    cpu_total       INT                           -- Physical cores
    cpu_allocated   INT                           -- Allocated vCPU
    memory_total    BIGINT                        -- Bytes
    memory_allocated BIGINT                       -- Bytes
    created_at      TIMESTAMP
    updated_at      TIMESTAMP
}
```

### PrimaryStorage
```
PrimaryStorage {
    id              UUID        PK
    zstack_uuid     VARCHAR     UNIQUE NOT NULL
    name            VARCHAR     NOT NULL
    storage_type    VARCHAR                       -- NFS, Ceph, LocalStorage, etc.
    url             VARCHAR
    state           VARCHAR
    capacity_total  BIGINT                        -- Bytes
    capacity_avail  BIGINT                        -- Bytes
    created_at      TIMESTAMP
    updated_at      TIMESTAMP
}
```

### Project
```
Project {
    id              UUID        PK
    zstack_uuid     VARCHAR     UNIQUE NOT NULL
    name            VARCHAR     NOT NULL
    description     TEXT
    created_at      TIMESTAMP
    updated_at      TIMESTAMP
}
```

### VM
```
VM {
    id              UUID        PK
    zstack_uuid     VARCHAR     UNIQUE NOT NULL
    name            VARCHAR     NOT NULL
    description     TEXT
    state           VARCHAR                       -- Running, Stopped, etc.
    host_id         UUID        FK -> Host
    project_id      UUID        FK -> Project
    private_ip      VARCHAR
    vcpu_num        INT
    memory_size     BIGINT                        -- Bytes
    platform        VARCHAR                       -- Linux, Windows, etc.
    image_name      VARCHAR
    zstack_created_at TIMESTAMP                   -- Original creation time from ZStack
    created_at      TIMESTAMP
    updated_at      TIMESTAMP
}
```

### Volume
```
Volume {
    id                  UUID    PK
    zstack_uuid         VARCHAR UNIQUE NOT NULL
    name                VARCHAR NOT NULL
    type                VARCHAR                   -- Root, Data
    state               VARCHAR
    vm_id               UUID    FK -> VM (nullable for detached)
    primary_storage_id  UUID    FK -> PrimaryStorage
    size                BIGINT                    -- Bytes (actual allocated)
    capacity            BIGINT                    -- Bytes (provisioned)
    created_at          TIMESTAMP
    updated_at          TIMESTAMP
}
```

### Tag
```
Tag {
    id          UUID    PK
    vm_id       UUID    FK -> VM
    tag_key     VARCHAR NOT NULL
    tag_value   VARCHAR
}
```

### EIP
```
EIP {
    id              UUID    PK
    zstack_uuid     VARCHAR UNIQUE NOT NULL
    ip_address      VARCHAR NOT NULL
    vm_id           UUID    FK -> VM (nullable if unattached)
    state           VARCHAR
    created_at      TIMESTAMP
    updated_at      TIMESTAMP
}
```

### ResourceGroup
```
ResourceGroup {
    id          UUID    PK
    name        VARCHAR UNIQUE NOT NULL
    description TEXT
    created_by  VARCHAR
    created_at  TIMESTAMP
    updated_at  TIMESTAMP
}
```

### ResourceGroupProject (Join Table)
```
ResourceGroupProject {
    id                  UUID    PK
    resource_group_id   UUID    FK -> ResourceGroup
    project_id          UUID    FK -> Project
    UNIQUE(resource_group_id, project_id)
}
```

### SnapshotHost
```
SnapshotHost {
    id                  UUID        PK
    host_id             UUID        FK -> Host
    snapshot_at         TIMESTAMP   NOT NULL
    cpu_total           INT
    cpu_allocated       INT
    memory_total        BIGINT
    memory_allocated    BIGINT
    vm_count            INT
}
```

### SnapshotStorage
```
SnapshotStorage {
    id                  UUID    PK
    primary_storage_id  UUID    FK -> PrimaryStorage
    snapshot_at         TIMESTAMP NOT NULL
    capacity_total      BIGINT
    capacity_avail      BIGINT
    volume_count        INT
}
```

### CollectionLog
```
CollectionLog {
    id              UUID        PK
    started_at      TIMESTAMP   NOT NULL
    finished_at     TIMESTAMP
    status          VARCHAR                   -- success, partial, failed
    hosts_synced    INT
    storages_synced INT
    vms_synced      INT
    projects_synced INT
    error_message   TEXT
}
```

### AppUser
```
AppUser {
    id              UUID        PK
    name            VARCHAR     NOT NULL
    email           VARCHAR     UNIQUE NOT NULL
    role            VARCHAR     NOT NULL      -- Admin | Operator | Viewer
    status          VARCHAR     NOT NULL      -- Active | Inactive
    password_hash   VARCHAR                   -- bcrypt hash
    permissions     JSONB       NOT NULL      -- PermissionMap (see below)
    created_at      TIMESTAMP   NOT NULL
    last_login      TIMESTAMP                 -- nullable
}
```

**PermissionMap** (stored as JSONB in `AppUser.permissions`):
```
PermissionMap {
    Dashboard:         { view: bool, manage: bool }
    Hosts:             { view: bool, manage: bool }
    VMs:               { view: bool, manage: bool }
    Storage:           { view: bool, manage: bool }
    Projects:          { view: bool, manage: bool }
    "Resource Groups": { view: bool, manage: bool }
    Reports:           { view: bool, manage: bool }
    "Disk Health":     { view: bool, manage: bool }
    "User Management": { view: bool, manage: bool }
}
```

Role defaults:
- **Admin**: all `view=true, manage=true` (non-editable; locked)
- **Operator**: `view=true` for all modules **except** User Management (`view=false, manage=false`); `manage=true` for Hosts, VMs, Storage, Projects, Resource Groups, Disk Health; `manage=false` for Dashboard, Reports
- **Viewer**: `view=true` for all modules **except** User Management (`view=false, manage=false`); `manage=false` everywhere

> `User Management` is Admin-only — Operators and Viewers have `view=false, manage=false` for this module and cannot access the Users page.

### StorageNode
```
StorageNode {
    id              UUID        PK
    hostname        VARCHAR     UNIQUE NOT NULL   -- display name / hostname label
    ssh_host        VARCHAR     NOT NULL          -- IP or FQDN for SCP connection
    ssh_port        INT         NOT NULL DEFAULT 22
    ssh_user        VARCHAR     NOT NULL
    ssh_key_path    VARCHAR     NOT NULL          -- path to private key on the monitor VM
    remote_dir      VARCHAR     NOT NULL          -- remote directory where smart.txt files are stored
    enabled         BOOLEAN     NOT NULL DEFAULT true
    last_collected_at TIMESTAMP                   -- timestamp of last successful SCP pull
    created_at      TIMESTAMP
    updated_at      TIMESTAMP
}
```

### DiskHealthRecord
```
DiskHealthRecord {
    id                  UUID        PK
    storage_node_id     UUID        FK -> StorageNode
    hostname            VARCHAR     NOT NULL          -- from parsed filename / smartctl header
    nvme_device         VARCHAR     NOT NULL          -- e.g. nvme0n1
    model_number        VARCHAR
    capacity_bytes      BIGINT                        -- Total NVM Capacity in bytes
    data_units_written  BIGINT                        -- raw from smartctl (512000 bytes per unit)
    tbw                 FLOAT                         -- calculated: data_units_written × 512000 / 1e12
    endurance_used_pct  FLOAT                         -- Percentage Used from smartctl
    life_remaining_pct  FLOAT                         -- 100 - endurance_used_pct
    available_spare_pct FLOAT                         -- Available Spare from smartctl
    disk_health         VARCHAR     NOT NULL          -- PASSED | FAILED
    summary             VARCHAR                       -- human-readable one-liner
    notes               TEXT                          -- additional observations
    raw_output          TEXT                          -- full smartctl text (for debugging)
    collected_at        TIMESTAMP   NOT NULL          -- when this record was parsed
    UNIQUE(hostname, nvme_device)
}
```

---

## 3. Relationships

```
Host            ||--o{ VM                   : "runs"
Host            ||--o{ SnapshotHost         : "has snapshots"
PrimaryStorage  ||--o{ Volume               : "stores"
PrimaryStorage  ||--o{ SnapshotStorage      : "has snapshots"
Project         ||--o{ VM                   : "owns"
Project         ||--o{ ResourceGroupProject : "belongs to"
ResourceGroup   ||--o{ ResourceGroupProject : "contains"
VM              ||--o{ Volume               : "has"
VM              ||--o{ Tag                  : "has"
VM              ||--o| EIP                  : "may have"
StorageNode     ||--o{ DiskHealthRecord     : "has disk records"
```

---

## 4. ERD Diagram (Text Notation)

```
┌──────────────┐        ┌──────────────┐        ┌──────────────────┐
│   Host       │───────<│     VM       │>───────│     Project      │
│──────────────│  runs  │──────────────│ owns   │──────────────────│
│ id (PK)      │        │ id (PK)      │        │ id (PK)          │
│ zstack_uuid  │        │ zstack_uuid  │        │ zstack_uuid      │
│ name         │        │ name         │        │ name             │
│ cpu_total    │        │ state        │        └────────┬─────────┘
│ cpu_alloc    │        │ private_ip   │                 │
│ mem_total    │        │ vcpu_num     │        ┌────────┴─────────┐
│ mem_alloc    │        │ memory_size  │        │ResourceGrpProject│
└──────┬───────┘        └──┬─────┬────┘        │──────────────────│
       │                   │     │              │ resource_group_id│
┌──────┴───────┐    ┌──────┴┐  ┌─┴────┐   ┌────┴ project_id      │
│SnapshotHost  │    │Volume │  │ Tag  │   │    └──────────────────┘
│──────────────│    │───────│  │──────│   │    ┌──────────────────┐
│ host_id (FK) │    │vm_id  │  │vm_id │   │    │  ResourceGroup   │
│ snapshot_at  │    │size   │  │key   │   └───>│──────────────────│
│ cpu_total    │    │storage│  │value │        │ id (PK)          │
└──────────────┘    │_id(FK)│  └──────┘        │ name             │
                    └───┬───┘                  └──────────────────┘
              ┌─────────┘
   ┌──────────┴──────┐
   │  PrimaryStorage │
   │─────────────────│
   │ id (PK)         │
   │ zstack_uuid     │
   │ name            │
   │ capacity_total  │
   │ capacity_avail  │
   └────────┬────────┘
            │
   ┌────────┴────────┐
   │SnapshotStorage  │
   │─────────────────│
   │ storage_id (FK) │
   │ snapshot_at     │
   │ capacity_total  │
   └─────────────────┘
```

---

## 5. Notes

> **Ultimate rule:** ZStack API is strictly query-only. CRUD operations exist only for app-managed entities (ResourceGroup, AppUser, CollectionLog) in this app's own database. Entities synced from ZStack (Host, VM, Volume, PrimaryStorage, Project, EIP, Tag, SnapshotHost, SnapshotStorage) are never written back to ZStack.

- All `zstack_uuid` fields map to ZStack's internal UUIDs — used for sync/idempotent upserts
- `VM.zstack_created_at` preserves original creation timestamp from ZStack for audit/reporting
- `SnapshotHost` and `SnapshotStorage` are append-only tables — never updated, only inserted
- `CollectionLog` records every sync run for traceability
- `ResourceGroup` is application-managed (not synced from ZStack) — full CRUD allowed in app DB
- `AppUser` is application-managed (not synced from ZStack) — full CRUD allowed in app DB
- `AppUser.permissions` JSONB column avoids a separate permissions join table while remaining queryable
- `StorageNode` is application-managed — full CRUD allowed in app DB; SSH credentials point to files on the monitor VM filesystem
- `DiskHealthRecord` is upserted on each collection run keyed on `(hostname, nvme_device)` — always reflects the latest smartctl parse result; raw output preserved for debugging
- `DiskHealthRecord.tbw` is a derived/calculated column stored for query convenience — recalculated on each parse
