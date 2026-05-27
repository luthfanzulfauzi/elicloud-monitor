"""
Data collection / sync service.
Polls ZStack (read-only) and upserts into local DB.
Idempotent — safe to run multiple times.
"""
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import AsyncSessionLocal
from ..models import (
    Host, PrimaryStorage, Project, VM, Volume, EIP, Tag,
    SnapshotHost, SnapshotStorage, CollectionLog,
)
from . import zstack_client as zs

log = logging.getLogger(__name__)

GB = 1024 ** 3


def _parse_zstack_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        # ZStack dates: "Nov 14, 2017 10:20:57 PM"
        return datetime.strptime(s, "%b %d, %Y %I:%M:%S %p").replace(tzinfo=timezone.utc)
    except Exception:
        try:
            return parsedate_to_datetime(s)
        except Exception:
            return None


async def run_sync() -> CollectionLog:
    log_entry = CollectionLog(
        started_at=datetime.now(timezone.utc),
        status="running",
    )
    hosts_synced = storages_synced = vms_synced = projects_synced = 0
    errors: list[str] = []

    async with AsyncSessionLocal() as db:
        db.add(log_entry)
        await db.commit()
        await db.refresh(log_entry)

        # --- Projects ---
        try:
            raw_projects = await zs.fetch_projects()
            for p in raw_projects:
                uuid = p["uuid"]
                linked_account_uuid = p.get("linkedAccountUuid")
                stmt = (
                    pg_insert(Project)
                    .values(
                        zstack_uuid=uuid,
                        name=p.get("name", ""),
                        description=p.get("description"),
                        state=p.get("state"),
                        linked_account_uuid=linked_account_uuid,
                        created_at=_parse_zstack_date(p.get("createDate")),
                        updated_at=datetime.now(timezone.utc),
                    )
                    .on_conflict_do_update(
                        index_elements=["zstack_uuid"],
                        set_=dict(
                            name=p.get("name", ""),
                            description=p.get("description"),
                            state=p.get("state"),
                            linked_account_uuid=linked_account_uuid,
                            updated_at=datetime.now(timezone.utc),
                        ),
                    )
                )
                await db.execute(stmt)
            await db.commit()

            # Fetch quotas for each project via its linkedAccountUuid
            all_projects = (await db.execute(select(Project))).scalars().all()
            for proj in all_projects:
                if not proj.linked_account_uuid:
                    continue
                quota_map = await zs.fetch_quotas_for_account(proj.linked_account_uuid)
                if quota_map:
                    await db.execute(
                        pg_insert(Project)
                        .values(zstack_uuid=proj.zstack_uuid, name=proj.name, quotas=quota_map)
                        .on_conflict_do_update(
                            index_elements=["zstack_uuid"],
                            set_=dict(quotas=quota_map, updated_at=datetime.now(timezone.utc)),
                        )
                    )
            await db.commit()

            projects_synced = len(raw_projects)
            log.info("Synced %d projects (with quotas)", projects_synced)
        except Exception as exc:
            errors.append(f"projects: {exc}")
            log.error("Project sync failed: %s", exc)

        # --- Hosts ---
        try:
            raw_hosts = await zs.fetch_hosts()
            host_uuid_map: dict[str, Host] = {}
            for h in raw_hosts:
                uuid = h["uuid"]
                cpu_total = h.get("totalCpuCapacity") or h.get("cpuNum")
                cpu_avail = h.get("availableCpuCapacity", 0)
                cpu_alloc = max(0, (cpu_total or 0) - cpu_avail)
                mem_total = h.get("totalMemoryCapacity")
                mem_avail = h.get("availableMemoryCapacity", 0)
                mem_alloc = max(0, (mem_total or 0) - mem_avail)

                stmt = (
                    pg_insert(Host)
                    .values(
                        zstack_uuid=uuid,
                        name=h.get("name", ""),
                        management_ip=h.get("managementIp"),
                        state=h.get("state"),
                        status=h.get("status"),
                        hypervisor_type=h.get("hypervisorType"),
                        cpu_total=cpu_total,
                        cpu_allocated=cpu_alloc,
                        memory_total=mem_total,
                        memory_allocated=mem_alloc,
                        created_at=_parse_zstack_date(h.get("createDate")),
                        updated_at=datetime.now(timezone.utc),
                    )
                    .on_conflict_do_update(
                        index_elements=["zstack_uuid"],
                        set_=dict(
                            name=h.get("name", ""),
                            management_ip=h.get("managementIp"),
                            state=h.get("state"),
                            status=h.get("status"),
                            cpu_total=cpu_total,
                            cpu_allocated=cpu_alloc,
                            memory_total=mem_total,
                            memory_allocated=mem_alloc,
                            updated_at=datetime.now(timezone.utc),
                        ),
                    )
                    .returning(Host.id, Host.zstack_uuid)
                )
                result = await db.execute(stmt)
                row = result.fetchone()
                if row:
                    host_uuid_map[uuid] = row[0]

            await db.commit()
            # snapshot
            now = datetime.now(timezone.utc)
            all_hosts = (await db.execute(select(Host))).scalars().all()
            for host in all_hosts:
                vm_count = len((await db.execute(
                    select(VM).where(VM.host_id == host.id)
                )).scalars().all())
                db.add(SnapshotHost(
                    host_id=host.id,
                    snapshot_at=now,
                    cpu_total=host.cpu_total,
                    cpu_allocated=host.cpu_allocated,
                    memory_total=host.memory_total,
                    memory_allocated=host.memory_allocated,
                    vm_count=vm_count,
                ))
            await db.commit()
            hosts_synced = len(raw_hosts)
            log.info("Synced %d hosts", hosts_synced)
        except Exception as exc:
            errors.append(f"hosts: {exc}")
            log.error("Host sync failed: %s", exc)

        # --- Primary Storage ---
        try:
            raw_storages = await zs.fetch_primary_storage()
            for s in raw_storages:
                uuid = s["uuid"]

                # Deduplicate Ceph pools by poolName (same pool appears for Root/Data/ImageCache types)
                ceph_pools = None
                if s.get("type") == "Ceph" and s.get("pools"):
                    seen: set[str] = set()
                    deduped = []
                    for pool in s["pools"]:
                        pname = pool.get("poolName", "")
                        if pname in seen:
                            continue
                        seen.add(pname)
                        deduped.append({
                            "poolName": pname,
                            "aliasName": pool.get("aliasName"),
                            "totalCapacity": pool.get("totalCapacity"),
                            "availableCapacity": pool.get("availableCapacity"),
                            "usedCapacity": pool.get("usedCapacity"),
                        })
                    ceph_pools = deduped if deduped else None

                stmt = (
                    pg_insert(PrimaryStorage)
                    .values(
                        zstack_uuid=uuid,
                        name=s.get("name", ""),
                        storage_type=s.get("type"),
                        url=s.get("url"),
                        state=s.get("state"),
                        status=s.get("status"),
                        capacity_total=s.get("totalCapacity"),
                        capacity_avail=s.get("availableCapacity"),
                        capacity_total_physical=s.get("totalPhysicalCapacity"),
                        capacity_avail_physical=s.get("availablePhysicalCapacity"),
                        ceph_pools=ceph_pools,
                        created_at=_parse_zstack_date(s.get("createDate")),
                        updated_at=datetime.now(timezone.utc),
                    )
                    .on_conflict_do_update(
                        index_elements=["zstack_uuid"],
                        set_=dict(
                            name=s.get("name", ""),
                            state=s.get("state"),
                            status=s.get("status"),
                            capacity_total=s.get("totalCapacity"),
                            capacity_avail=s.get("availableCapacity"),
                            capacity_total_physical=s.get("totalPhysicalCapacity"),
                            capacity_avail_physical=s.get("availablePhysicalCapacity"),
                            ceph_pools=ceph_pools,
                            updated_at=datetime.now(timezone.utc),
                        ),
                    )
                )
                await db.execute(stmt)
            await db.commit()
            # storage snapshot
            now = datetime.now(timezone.utc)
            all_storages = (await db.execute(select(PrimaryStorage))).scalars().all()
            for st in all_storages:
                vol_count = len((await db.execute(
                    select(Volume).where(Volume.primary_storage_id == st.id)
                )).scalars().all())
                db.add(SnapshotStorage(
                    primary_storage_id=st.id,
                    snapshot_at=now,
                    capacity_total=st.capacity_total,
                    capacity_avail=st.capacity_avail,
                    volume_count=vol_count,
                ))
            await db.commit()
            storages_synced = len(raw_storages)
            log.info("Synced %d storages", storages_synced)
        except Exception as exc:
            errors.append(f"storages: {exc}")
            log.error("Storage sync failed: %s", exc)

        # --- VMs ---
        try:
            raw_vms = await zs.fetch_vms()
            raw_tags = await zs.fetch_user_tags()
            raw_eips = await zs.fetch_eips()
            raw_volumes = await zs.fetch_volumes()

            # Build VM→project mapping via ZQL accountresourceref
            vm_owner_refs: dict[str, str] = {}
            try:
                vm_owner_refs = await zs.fetch_vm_owner_refs()
                log.info("Fetched %d VM owner refs via ZQL", len(vm_owner_refs))
            except Exception as ref_exc:
                log.warning("Could not fetch VM owner refs (project_id will not be updated): %s", ref_exc)

            # Build lookup maps
            all_projects = (await db.execute(select(Project))).scalars().all()
            project_map: dict[str, object] = {r.zstack_uuid: r.id for r in all_projects}
            # linked_account_uuid → project app id (for ZQL-based owner matching)
            acct_to_project_id: dict[str, object] = {
                r.linked_account_uuid: r.id
                for r in all_projects
                if r.linked_account_uuid
            }
            host_map: dict[str, object] = {
                r.zstack_uuid: r.id
                for r in (await db.execute(select(Host))).scalars().all()
            }
            storage_map: dict[str, object] = {
                r.zstack_uuid: r.id
                for r in (await db.execute(select(PrimaryStorage))).scalars().all()
            }

            # eip by vmNicUuid — we match by guest_ip to vm later
            eip_by_vm_nic: dict[str, str] = {
                e["vmNicUuid"]: e["vipIp"]
                for e in raw_eips
                if e.get("vmNicUuid") and e.get("vipIp")
            }

            # volume total per vm
            vol_gb_by_vm: dict[str, float] = {}
            for vol in raw_volumes:
                vm_uuid = vol.get("vmInstanceUuid")
                if vm_uuid:
                    vol_gb_by_vm[vm_uuid] = vol_gb_by_vm.get(vm_uuid, 0) + (vol.get("size", 0) or 0) / GB

            # tags by vm uuid
            tags_by_vm: dict[str, list[dict]] = {}
            for t in raw_tags:
                vm_uuid = t.get("resourceUuid")
                if vm_uuid:
                    tags_by_vm.setdefault(vm_uuid, []).append(t)

            vm_uuid_to_id: dict[str, object] = {}
            for v in raw_vms:
                uuid = v["uuid"]
                host_uuid = v.get("hostUuid") or v.get("lastHostUuid")

                # Determine private IP from vmNics
                private_ip = None
                eip = None
                nics = v.get("vmNics", [])
                if nics:
                    primary_nic = nics[0]
                    private_ip = primary_nic.get("ip")
                    nic_uuid = primary_nic.get("uuid")
                    if nic_uuid:
                        eip = eip_by_vm_nic.get(nic_uuid)

                # Resolve project_id via ZQL owner refs: vm_uuid → ownerAccountUuid → project
                owner_acct_uuid = vm_owner_refs.get(uuid)
                project_id = acct_to_project_id.get(owner_acct_uuid) if owner_acct_uuid else None

                upsert_values = dict(
                    zstack_uuid=uuid,
                    name=v.get("name", ""),
                    description=v.get("description"),
                    state=v.get("state"),
                    host_id=host_map.get(host_uuid) if host_uuid else None,
                    project_id=project_id,
                    private_ip=private_ip,
                    eip=eip,
                    vcpu_num=v.get("cpuNum"),
                    memory_size=v.get("memorySize"),
                    platform=v.get("platform"),
                    image_name=v.get("imageName"),
                    hypervisor_type=v.get("hypervisorType"),
                    zstack_created_at=_parse_zstack_date(v.get("createDate")),
                    created_at=_parse_zstack_date(v.get("createDate")),
                    updated_at=datetime.now(timezone.utc),
                )
                update_fields = dict(
                    name=v.get("name", ""),
                    state=v.get("state"),
                    host_id=host_map.get(host_uuid) if host_uuid else None,
                    project_id=project_id,
                    private_ip=private_ip,
                    eip=eip,
                    vcpu_num=v.get("cpuNum"),
                    memory_size=v.get("memorySize"),
                    platform=v.get("platform"),
                    # NEVER overwrite zstack_created_at
                    updated_at=datetime.now(timezone.utc),
                )

                stmt = (
                    pg_insert(VM)
                    .values(**upsert_values)
                    .on_conflict_do_update(
                        index_elements=["zstack_uuid"],
                        set_=update_fields,
                    )
                    .returning(VM.id)
                )
                result = await db.execute(stmt)
                row = result.fetchone()
                if row:
                    vm_uuid_to_id[uuid] = row[0]

            await db.commit()

            # Sync tags (delete + re-insert per VM to stay idempotent)
            for vm_uuid, tag_list in tags_by_vm.items():
                vm_id = vm_uuid_to_id.get(vm_uuid)
                if not vm_id:
                    continue
                await db.execute(delete(Tag).where(Tag.vm_id == vm_id))
                for t in tag_list:
                    raw_tag = t.get("tag", "")
                    parts = raw_tag.split("::", 1)
                    db.add(Tag(
                        vm_id=vm_id,
                        tag_key=parts[0],
                        tag_value=parts[1] if len(parts) > 1 else None,
                        zstack_uuid=t.get("uuid"),
                    ))
            await db.commit()

            # Upsert volumes
            for vol in raw_volumes:
                vol_uuid = vol["uuid"]
                vm_uuid = vol.get("vmInstanceUuid")
                st_uuid = vol.get("primaryStorageUuid")
                stmt = (
                    pg_insert(Volume)
                    .values(
                        zstack_uuid=vol_uuid,
                        name=vol.get("name", ""),
                        type=vol.get("type"),
                        state=vol.get("state"),
                        status=vol.get("status"),
                        vm_id=vm_uuid_to_id.get(vm_uuid) if vm_uuid else None,
                        primary_storage_id=storage_map.get(st_uuid) if st_uuid else None,
                        size=vol.get("size"),
                        actual_size=vol.get("actualSize"),
                        device_id=vol.get("deviceId"),
                        install_path=vol.get("installPath"),
                        created_at=_parse_zstack_date(vol.get("createDate")),
                        updated_at=datetime.now(timezone.utc),
                    )
                    .on_conflict_do_update(
                        index_elements=["zstack_uuid"],
                        set_=dict(
                            state=vol.get("state"),
                            status=vol.get("status"),
                            vm_id=vm_uuid_to_id.get(vm_uuid) if vm_uuid else None,
                            size=vol.get("size"),
                            actual_size=vol.get("actualSize"),
                            install_path=vol.get("installPath"),
                            updated_at=datetime.now(timezone.utc),
                        ),
                    )
                )
                await db.execute(stmt)
            await db.commit()

            # Upsert EIPs
            for e in raw_eips:
                e_uuid = e["uuid"]
                stmt = (
                    pg_insert(EIP)
                    .values(
                        zstack_uuid=e_uuid,
                        ip_address=e.get("vipIp", ""),
                        guest_ip=e.get("guestIp"),
                        state=e.get("state"),
                        created_at=_parse_zstack_date(e.get("createDate")),
                        updated_at=datetime.now(timezone.utc),
                    )
                    .on_conflict_do_update(
                        index_elements=["zstack_uuid"],
                        set_=dict(
                            ip_address=e.get("vipIp", ""),
                            guest_ip=e.get("guestIp"),
                            state=e.get("state"),
                            updated_at=datetime.now(timezone.utc),
                        ),
                    )
                )
                await db.execute(stmt)
            await db.commit()

            vms_synced = len(raw_vms)
            log.info("Synced %d VMs", vms_synced)
        except Exception as exc:
            errors.append(f"vms: {exc}")
            log.error("VM sync failed: %s", exc)

        # NOTE: VM-project associations via __projectUuid__ filter are not supported by this
        # ZStack server's admin API (VmInstanceInventory has no __projectUuid__ field).
        # project_id on VMs remains null; Projects page will show resource counts as N/A.

        # --- Finalize log ---
        status = "failed" if len(errors) == 4 else ("partial" if errors else "success")
        log_entry.finished_at = datetime.now(timezone.utc)
        log_entry.status = status
        log_entry.hosts_synced = hosts_synced
        log_entry.storages_synced = storages_synced
        log_entry.vms_synced = vms_synced
        log_entry.projects_synced = projects_synced
        log_entry.error_message = "; ".join(errors) if errors else None
        db.add(log_entry)
        await db.commit()

    return log_entry
