from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, cast, Date, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Host, VM, PrimaryStorage, Volume, CollectionLog
from ..schemas.dashboard import DashboardSummary, SyncInfo, TopHost
from ..schemas.vm import VMTrendPoint
from ..schemas.storage import ProvisioningPoint, ComputePoint

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

TB = 1024 ** 4
GB = 1024 ** 3

_USER_VM = or_(VM.vm_type == "UserVm", VM.vm_type.is_(None))


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_hosts = (await db.execute(select(func.count(Host.id)))).scalar_one()
    running = (await db.execute(select(func.count(VM.id)).where(_USER_VM, VM.state == "Running"))).scalar_one()
    stopped = (await db.execute(select(func.count(VM.id)).where(_USER_VM, VM.state == "Stopped"))).scalar_one()

    storages = (await db.execute(select(PrimaryStorage))).scalars().all()
    total_cap = sum(s.capacity_total or 0 for s in storages)
    total_avail = sum(s.capacity_avail or 0 for s in storages)
    total_used = total_cap - total_avail

    hosts = (await db.execute(select(Host).where(Host.state == "Enabled"))).scalars().all()
    total_cpu_alloc = sum(h.cpu_allocated or 0 for h in hosts)
    total_cpu_total = sum(h.cpu_total or 0 for h in hosts)
    total_mem_alloc = sum(h.memory_allocated or 0 for h in hosts)
    total_mem_total = sum(h.memory_total or 0 for h in hosts)

    last_log = (
        await db.execute(
            select(CollectionLog).order_by(CollectionLog.started_at.desc()).limit(1)
        )
    ).scalar_one_or_none()

    sync_info = None
    if last_log and last_log.finished_at:
        sync_info = SyncInfo(
            last_sync=last_log.finished_at.isoformat(),
            status=last_log.status or "unknown",
        )

    return DashboardSummary(
        total_hosts=total_hosts,
        running_vms=running,
        stopped_vms=stopped,
        total_storage_tb=round(total_cap / TB, 2),
        total_storage_used_tb=round(total_used / TB, 2),
        total_cpu_allocated=total_cpu_alloc,
        total_cpu_total=total_cpu_total,
        total_memory_allocated_gb=round(total_mem_alloc / GB, 1),
        total_memory_total_gb=round(total_mem_total / GB, 1),
        sync_info=sync_info,
    )


@router.get("/vm-trend", response_model=list[VMTrendPoint])
async def get_vm_trend(days: int = 30, db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await db.execute(
            select(cast(VM.zstack_created_at, Date).label("day"), func.count(VM.id).label("cnt"))
            .where(VM.zstack_created_at >= since)
            .group_by("day").order_by("day")
        )
    ).all()
    return [VMTrendPoint(date=str(r.day), count=r.cnt) for r in rows]


@router.get("/storage-trend", response_model=list[ProvisioningPoint])
async def get_storage_trend(days: int = 30, db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await db.execute(
            select(cast(Volume.created_at, Date).label("day"), func.sum(Volume.size).label("total_bytes"))
            .where(Volume.created_at >= since)
            .group_by("day").order_by("day")
        )
    ).all()
    return [ProvisioningPoint(date=str(r.day), value=round((r.total_bytes or 0) / GB, 1)) for r in rows]


@router.get("/compute-trend", response_model=list[ComputePoint])
async def get_compute_trend(days: int = 30, db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        await db.execute(
            select(
                cast(VM.zstack_created_at, Date).label("day"),
                func.sum(VM.vcpu_num).label("vcpu"),
                func.sum(VM.memory_size).label("mem"),
            )
            .where(VM.zstack_created_at >= since)
            .group_by("day").order_by("day")
        )
    ).all()
    return [ComputePoint(date=str(r.day), vcpu=int(r.vcpu or 0), ram_gb=round((r.mem or 0) / GB, 1)) for r in rows]


@router.get("/top-hosts", response_model=list[TopHost])
async def get_top_hosts(n: int = 5, db: AsyncSession = Depends(get_db)):
    hosts = (await db.execute(select(Host))).scalars().all()
    result = []
    for h in hosts:
        vm_count = (await db.execute(select(func.count(VM.id)).where(VM.host_id == h.id))).scalar_one()
        cpu_oc = round(h.cpu_allocated / h.cpu_total, 2) if h.cpu_total and h.cpu_allocated else None
        mem_oc = round(h.memory_allocated / h.memory_total, 2) if h.memory_total and h.memory_allocated else None
        result.append(TopHost(
            name=h.name,
            management_ip=h.management_ip,
            vcpu_total=h.cpu_total,
            vcpu_allocated=h.cpu_allocated,
            memory_total_gb=round(h.memory_total / GB, 1) if h.memory_total else None,
            memory_allocated_gb=round(h.memory_allocated / GB, 1) if h.memory_allocated else None,
            vm_count=vm_count,
            cpu_overcommit=cpu_oc,
            mem_overcommit=mem_oc,
        ))
    result.sort(key=lambda x: x.cpu_overcommit or 0, reverse=True)
    return result[:n]
