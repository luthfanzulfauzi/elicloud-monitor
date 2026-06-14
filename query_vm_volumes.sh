#!/usr/bin/env bash
# query_vm_volumes.sh
# Query all VMs and Volumes from the elicloudmonitor PostgreSQL database.
# Output is saved to query_output/vm_volumes_<TIMESTAMP>.<ext>
#
# Usage:
#   ./query_vm_volumes.sh                    # table format (default)
#   ./query_vm_volumes.sh --csv              # CSV format
#   ./query_vm_volumes.sh --vm-only          # VMs only
#   ./query_vm_volumes.sh --vol-only         # Volumes only
#   ./query_vm_volumes.sh --host 10.0.0.1    # custom DB host
#
# Environment variables (override defaults):
#   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD

set -euo pipefail

# ── Defaults (match docker-compose.yml) ───────────────────────────────────────
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-elicloudmonitor}"
DB_USER="${PGUSER:-elicloud}"
export PGPASSWORD="${PGPASSWORD:-elicloud}"

# ── Parse args ────────────────────────────────────────────────────────────────
FORMAT="table"      # table | csv
RUN_VMS=true
RUN_VOLS=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv)       FORMAT="csv" ;;
    --vm-only)   RUN_VOLS=false ;;
    --vol-only)  RUN_VMS=false ;;
    --host)      DB_HOST="$2"; shift ;;
    --port)      DB_PORT="$2"; shift ;;
    --db)        DB_NAME="$2"; shift ;;
    --user)      DB_USER="$2"; shift ;;
    --password)  export PGPASSWORD="$2"; shift ;;
    *) echo "[ERROR] Unknown argument: $1" >&2; exit 1 ;;
  esac
  shift
done

# ── Output dir ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/query_output"
mkdir -p "$OUT_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
EXT="$( [[ "$FORMAT" == "csv" ]] && echo "csv" || echo "txt" )"
OUT_FILE="$OUT_DIR/vm_volumes_${TIMESTAMP}.${EXT}"

# ── psql helper ───────────────────────────────────────────────────────────────
psql_cmd() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
}

if [[ "$FORMAT" == "csv" ]]; then
  PSQL_FLAGS=("--csv" "--tuples-only")
  SEP=","
else
  PSQL_FLAGS=("--expanded" "--no-psqlrc")
  SEP=""
fi

echo "[INFO] Connecting to ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "[INFO] Output → $OUT_FILE"
echo ""

# ── Run queries ───────────────────────────────────────────────────────────────
{
  if [[ "$FORMAT" == "csv" ]]; then
    # CSV: emit header rows manually then data
    if $RUN_VMS; then
      echo "=== VMs ==="
      echo "name,zstack_uuid,state,vm_type,appliance_type,vcpu_num,memory_gb,platform,image_name,private_ip,eip,project,host,zstack_created_at"
      psql_cmd "${PSQL_FLAGS[@]}" <<'SQL'
SELECT
  v.name,
  v.zstack_uuid,
  COALESCE(v.state, '')               AS state,
  COALESCE(v.vm_type, '')             AS vm_type,
  COALESCE(v.appliance_type, '')      AS appliance_type,
  COALESCE(v.vcpu_num::text, '')      AS vcpu_num,
  COALESCE(round(v.memory_size / 1073741824.0, 1)::text, '') AS memory_gb,
  COALESCE(v.platform, '')            AS platform,
  COALESCE(v.image_name, '')          AS image_name,
  COALESCE(v.private_ip, '')          AS private_ip,
  COALESCE(v.eip, '')                 AS eip,
  COALESCE(p.name, '')                AS project,
  COALESCE(h.name, '')                AS host,
  COALESCE(v.zstack_created_at::text, '') AS zstack_created_at
FROM vms v
LEFT JOIN projects  p ON p.id = v.project_id
LEFT JOIN hosts     h ON h.id = v.host_id
ORDER BY v.vm_type NULLS LAST, v.name;
SQL
      echo ""
    fi

    if $RUN_VOLS; then
      echo "=== Volumes ==="
      echo "name,zstack_uuid,type,state,status,size_gb,actual_size_gb,device_id,vm_name,vm_uuid,primary_storage,install_path"
      psql_cmd "${PSQL_FLAGS[@]}" <<'SQL'
SELECT
  vol.name,
  vol.zstack_uuid,
  COALESCE(vol.type, '')              AS type,
  COALESCE(vol.state, '')             AS state,
  COALESCE(vol.status, '')            AS status,
  COALESCE(round(vol.size / 1073741824.0, 1)::text, '')        AS size_gb,
  COALESCE(round(vol.actual_size / 1073741824.0, 1)::text, '') AS actual_size_gb,
  COALESCE(vol.device_id::text, '')   AS device_id,
  COALESCE(vm.name, '')               AS vm_name,
  COALESCE(vm.zstack_uuid, '')        AS vm_uuid,
  COALESCE(ps.name, '')               AS primary_storage,
  COALESCE(vol.install_path, '')      AS install_path
FROM volumes vol
LEFT JOIN vms            vm ON vm.id  = vol.vm_id
LEFT JOIN primary_storage ps ON ps.id = vol.primary_storage_id
ORDER BY vm.name NULLS LAST, vol.device_id NULLS LAST;
SQL
    fi

  else
    # Table format
    if $RUN_VMS; then
      echo "========================================================================"
      echo "  VMs"
      echo "========================================================================"
      psql_cmd --pset="footer=on" --pset="border=2" <<'SQL'
SELECT
  v.name                                          AS "VM Name",
  v.zstack_uuid                                   AS "ZStack UUID",
  v.state                                         AS "State",
  v.vm_type                                       AS "Type",
  v.appliance_type                                AS "Appliance",
  v.vcpu_num                                      AS "vCPU",
  round(v.memory_size / 1073741824.0, 1)          AS "Mem (GB)",
  v.platform                                      AS "Platform",
  v.image_name                                    AS "Image",
  v.private_ip                                    AS "Private IP",
  v.eip                                           AS "EIP",
  p.name                                          AS "Project",
  h.name                                          AS "Host",
  v.zstack_created_at                             AS "Created (ZStack)"
FROM vms v
LEFT JOIN projects  p ON p.id = v.project_id
LEFT JOIN hosts     h ON h.id = v.host_id
ORDER BY v.vm_type NULLS LAST, v.name;
SQL
      echo ""
    fi

    if $RUN_VOLS; then
      echo "========================================================================"
      echo "  Volumes"
      echo "========================================================================"
      psql_cmd --pset="footer=on" --pset="border=2" <<'SQL'
SELECT
  vol.name                                              AS "Volume Name",
  vol.zstack_uuid                                       AS "ZStack UUID",
  vol.type                                              AS "Type",
  vol.state                                             AS "State",
  vol.status                                            AS "Status",
  round(vol.size / 1073741824.0, 1)                     AS "Size (GB)",
  round(vol.actual_size / 1073741824.0, 1)              AS "Actual (GB)",
  vol.device_id                                         AS "Dev ID",
  vm.name                                               AS "VM Name",
  vm.zstack_uuid                                        AS "VM UUID",
  ps.name                                               AS "Primary Storage",
  vol.install_path                                      AS "Install Path"
FROM volumes vol
LEFT JOIN vms            vm ON vm.id  = vol.vm_id
LEFT JOIN primary_storage ps ON ps.id = vol.primary_storage_id
ORDER BY vm.name NULLS LAST, vol.device_id NULLS LAST;
SQL
    fi
  fi

  echo ""
  echo "-- Generated by query_vm_volumes.sh at $(date --utc '+%Y-%m-%dT%H:%M:%SZ') --"

} | tee "$OUT_FILE"

echo ""
echo "[INFO] Saved to: $OUT_FILE"
