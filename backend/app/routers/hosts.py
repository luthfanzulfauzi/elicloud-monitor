import uuid as uuid_mod
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Host, VM, SnapshotHost
from ..schemas.host import HostListItem, HostTrendPoint

router = APIRouter(prefix="/hosts", tags=["hosts"])

GB = 1024 ** 3


@router.get("", response_model=list[HostListItem])
async def list_hosts(state: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    q = select(Host)
    if state:
        q = q.where(Host.state == state)
    hosts = (await db.execute(q)).scalars().all()

    result = []
    for h in hosts:
        vm_count = (await db.execute(select(func.count(VM.id)).where(VM.host_id == h.id))).scalar_one()
        cpu_oc = round(h.cpu_allocated / h.cpu_total, 2) if h.cpu_total and h.cpu_allocated else None
        mem_oc = round(h.memory_allocated / h.memory_total, 2) if h.memory_total and h.memory_allocated else None
        result.append(HostListItem(
            id=h.id,
            name=h.name,
            management_ip=h.management_ip,
            state=h.state,
            vcpu_total=h.cpu_total,
            vcpu_allocated=h.cpu_allocated,
            memory_total_gb=round(h.memory_total / GB, 1) if h.memory_total else None,
            memory_allocated_gb=round(h.memory_allocated / GB, 1) if h.memory_allocated else None,
            vm_count=vm_count,
            cpu_overcommit=cpu_oc,
            mem_overcommit=mem_oc,
        ))
    return result


@router.get("/trend", response_model=list[HostTrendPoint])
async def get_host_trend(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    host_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
    until = (datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999)
             if end_date else datetime.now(timezone.utc))

    day_col = cast(SnapshotHost.snapshot_at, Date)

    if host_id and host_id != "all":
        rows = (
            await db.execute(
                select(
                    day_col.label("day"),
                    func.avg(SnapshotHost.cpu_allocated).label("cpu_allocated"),
                    func.avg(SnapshotHost.cpu_total).label("cpu_total"),
                    func.avg(SnapshotHost.memory_allocated).label("memory_allocated"),
                    func.avg(SnapshotHost.memory_total).label("memory_total"),
                )
                .where(
                    SnapshotHost.host_id == uuid_mod.UUID(host_id),
                    SnapshotHost.snapshot_at >= since,
                    SnapshotHost.snapshot_at <= until,
                )
                .group_by(day_col)
                .order_by(day_col)
            )
        ).all()
    else:
        # Average per host per day first, then sum across hosts
        subq = (
            select(
                day_col.label("day"),
                SnapshotHost.host_id,
                func.avg(SnapshotHost.cpu_allocated).label("cpu_allocated"),
                func.avg(SnapshotHost.cpu_total).label("cpu_total"),
                func.avg(SnapshotHost.memory_allocated).label("memory_allocated"),
                func.avg(SnapshotHost.memory_total).label("memory_total"),
            )
            .where(
                SnapshotHost.snapshot_at >= since,
                SnapshotHost.snapshot_at <= until,
            )
            .group_by(day_col, SnapshotHost.host_id)
            .subquery()
        )
        rows = (
            await db.execute(
                select(
                    subq.c.day,
                    func.sum(subq.c.cpu_allocated).label("cpu_allocated"),
                    func.sum(subq.c.cpu_total).label("cpu_total"),
                    func.sum(subq.c.memory_allocated).label("memory_allocated"),
                    func.sum(subq.c.memory_total).label("memory_total"),
                )
                .group_by(subq.c.day)
                .order_by(subq.c.day)
            )
        ).all()

    return [
        HostTrendPoint(
            date=str(r.day),
            cpu_allocated=int(r.cpu_allocated or 0),
            cpu_total=int(r.cpu_total or 0),
            memory_allocated_gb=round((r.memory_allocated or 0) / GB, 1),
            memory_total_gb=round((r.memory_total or 0) / GB, 1),
        )
        for r in rows
    ]
