from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import VM, Volume
from ..schemas.vm import VMOut, VMTrendPoint
from ..schemas.storage import ComputePoint

router = APIRouter(prefix="/vms", tags=["vms"])

GB = 1024 ** 3


async def _vm_trend_query(start_date, end_date, db):
    since = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
    until = (datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999)
             if end_date else datetime.now(timezone.utc))
    rows = (
        await db.execute(
            select(cast(VM.zstack_created_at, Date).label("day"), func.count(VM.id).label("cnt"))
            .where(VM.zstack_created_at >= since, VM.zstack_created_at <= until)
            .group_by("day").order_by("day")
        )
    ).all()
    return [VMTrendPoint(date=str(r.day), count=r.cnt) for r in rows]


@router.get("", response_model=list[VMOut])
async def list_vms(
    state: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(2000, ge=1, le=2000),
    db: AsyncSession = Depends(get_db),
):
    q = select(VM).options(selectinload(VM.host), selectinload(VM.volumes))
    if state:
        q = q.where(VM.state == state)
    if search:
        q = q.where(VM.name.ilike(f"%{search}%") | VM.private_ip.ilike(f"%{search}%"))
    q = q.offset((page - 1) * per_page).limit(per_page)
    vms = (await db.execute(q)).scalars().all()

    result = []
    for v in vms:
        storage_gb = round(sum(vol.size or 0 for vol in v.volumes) / GB, 2)
        result.append(VMOut(
            id=v.id,
            name=v.name,
            state=v.state,
            host=v.host.name if v.host else None,
            platform=v.platform,
            private_ip=v.private_ip,
            eip=v.eip,
            vcpu=v.vcpu_num,
            vram_gb=round(v.memory_size / GB, 2) if v.memory_size else None,
            storage_gb=storage_gb,
            created_at=v.zstack_created_at.isoformat() if v.zstack_created_at else None,
        ))
    return result


@router.get("/trend", response_model=list[VMTrendPoint])
async def vm_trend(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await _vm_trend_query(start_date, end_date, db)


@router.get("/created-by-period", response_model=list[VMTrendPoint])
async def vm_created_by_period(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await _vm_trend_query(start_date, end_date, db)


@router.get("/created-in-range", response_model=list[VMOut])
async def vms_created_in_range(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Return full VM records for VMs created within the date range."""
    since = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
    until = datetime.fromisoformat(end_date) if end_date else datetime.now(timezone.utc)
    # extend end to include the full end day
    until_inclusive = until.replace(hour=23, minute=59, second=59) if until.hour == 0 else until
    vms = (
        await db.execute(
            select(VM)
            .options(selectinload(VM.host), selectinload(VM.volumes))
            .where(VM.zstack_created_at >= since, VM.zstack_created_at <= until_inclusive)
            .order_by(VM.zstack_created_at.desc())
        )
    ).scalars().all()
    result = []
    for v in vms:
        storage_gb = round(sum(vol.size or 0 for vol in v.volumes) / GB, 2)
        result.append(VMOut(
            id=v.id,
            name=v.name,
            state=v.state,
            host=v.host.name if v.host else None,
            platform=v.platform,
            private_ip=v.private_ip,
            eip=v.eip,
            vcpu=v.vcpu_num,
            vram_gb=round(v.memory_size / GB, 2) if v.memory_size else None,
            storage_gb=storage_gb,
            created_at=v.zstack_created_at.isoformat() if v.zstack_created_at else None,
        ))
    return result


@router.get("/compute-trend", response_model=list[ComputePoint])
async def compute_trend(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
    until = (datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999)
             if end_date else datetime.now(timezone.utc))
    rows = (
        await db.execute(
            select(
                cast(VM.zstack_created_at, Date).label("day"),
                func.sum(VM.vcpu_num).label("vcpu"),
                func.sum(VM.memory_size).label("mem"),
            )
            .where(VM.zstack_created_at >= since, VM.zstack_created_at <= until)
            .group_by("day").order_by("day")
        )
    ).all()
    return [ComputePoint(date=str(r.day), vcpu=int(r.vcpu or 0), ram_gb=round((r.mem or 0) / GB, 1)) for r in rows]
