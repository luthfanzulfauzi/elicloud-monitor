import uuid as uuid_mod
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import PrimaryStorage, Volume, SnapshotStorage
from ..schemas.storage import StorageOut, CephPool, ProvisioningPoint, StorageCapacityPoint

router = APIRouter(prefix="/storage", tags=["storage"])

TB = 1024 ** 4
GB = 1024 ** 3


@router.get("", response_model=list[StorageOut])
async def list_storage(db: AsyncSession = Depends(get_db)):
    storages = (await db.execute(select(PrimaryStorage))).scalars().all()
    result = []
    for s in storages:
        vol_count = (await db.execute(select(func.count(Volume.id)).where(Volume.primary_storage_id == s.id))).scalar_one()
        used = (s.capacity_total or 0) - (s.capacity_avail or 0)

        ceph_pools = None
        if s.ceph_pools:
            ceph_pools = [
                CephPool(
                    pool_name=p.get("poolName", ""),
                    alias_name=p.get("aliasName"),
                    total_tb=round((p.get("totalCapacity") or 0) / TB, 2),
                    used_tb=round((p.get("usedCapacity") or 0) / TB, 2),
                    util_pct=round(((p.get("usedCapacity") or 0) / (p.get("totalCapacity") or 1)) * 100),
                )
                for p in s.ceph_pools
            ]

        used_physical = (s.capacity_total_physical or 0) - (s.capacity_avail_physical or 0)
        result.append(StorageOut(
            id=s.id,
            name=s.name,
            type=s.storage_type,
            state=s.state,
            total_tb=round((s.capacity_total or 0) / TB, 2),
            used_tb=round(used / TB, 2),
            total_physical_tb=round((s.capacity_total_physical or 0) / TB, 2),
            used_physical_tb=round(used_physical / TB, 2),
            volume_count=vol_count,
            ceph_pools=ceph_pools,
        ))
    return result


@router.get("/trend", response_model=list[ProvisioningPoint])
async def get_storage_trend(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
    until = datetime.fromisoformat(end_date) if end_date else datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(cast(Volume.created_at, Date).label("day"), func.sum(Volume.size).label("total_bytes"))
            .where(Volume.created_at >= since, Volume.created_at <= until)
            .group_by("day").order_by("day")
        )
    ).all()
    return [ProvisioningPoint(date=str(r.day), value=round((r.total_bytes or 0) / GB, 1)) for r in rows]


@router.get("/capacity-trend", response_model=list[StorageCapacityPoint])
async def get_storage_capacity_trend(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    storage_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
    until = (datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999)
             if end_date else datetime.now(timezone.utc))

    day_col = cast(SnapshotStorage.snapshot_at, Date)

    if storage_id and storage_id != "all":
        rows = (
            await db.execute(
                select(
                    day_col.label("day"),
                    func.avg(SnapshotStorage.capacity_total).label("capacity_total"),
                    func.avg(SnapshotStorage.capacity_avail).label("capacity_avail"),
                )
                .where(
                    SnapshotStorage.primary_storage_id == uuid_mod.UUID(storage_id),
                    SnapshotStorage.snapshot_at >= since,
                    SnapshotStorage.snapshot_at <= until,
                )
                .group_by(day_col)
                .order_by(day_col)
            )
        ).all()
    else:
        # Average per storage per day first, then sum across pools
        subq = (
            select(
                day_col.label("day"),
                SnapshotStorage.primary_storage_id,
                func.avg(SnapshotStorage.capacity_total).label("capacity_total"),
                func.avg(SnapshotStorage.capacity_avail).label("capacity_avail"),
            )
            .where(
                SnapshotStorage.snapshot_at >= since,
                SnapshotStorage.snapshot_at <= until,
            )
            .group_by(day_col, SnapshotStorage.primary_storage_id)
            .subquery()
        )
        rows = (
            await db.execute(
                select(
                    subq.c.day,
                    func.sum(subq.c.capacity_total).label("capacity_total"),
                    func.sum(subq.c.capacity_avail).label("capacity_avail"),
                )
                .group_by(subq.c.day)
                .order_by(subq.c.day)
            )
        ).all()

    return [
        StorageCapacityPoint(
            date=str(r.day),
            capacity_total_tb=round((r.capacity_total or 0) / TB, 2),
            capacity_used_tb=round(((r.capacity_total or 0) - (r.capacity_avail or 0)) / TB, 2),
        )
        for r in rows
    ]
