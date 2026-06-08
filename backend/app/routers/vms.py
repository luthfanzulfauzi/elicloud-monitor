from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from sqlalchemy import or_

from ..database import get_db
from ..models import VM, Volume, Project
from ..schemas.vm import VMOut, VMTrendPoint, VolumeInfo, InfraVMOut
from ..schemas.storage import ComputePoint

router = APIRouter(prefix="/vms", tags=["vms"])

GB = 1024 ** 3

# Filter that matches user VMs — includes NULL rows during initial sync before vm_type is populated
_USER_VM = or_(VM.vm_type == "UserVm", VM.vm_type.is_(None))
_INFRA_VM = VM.vm_type == "ApplianceVm"

_INFRA_TYPE_MAP = {"VirtualRouter": "vRouter", "LoadBalancer": "LB"}


def _infer_infra_type(name: str, appliance_type: str | None) -> str:
    if appliance_type:
        return _INFRA_TYPE_MAP.get(appliance_type, appliance_type)
    n = name.lower()
    if any(x in n for x in ("vrouter", "vpc-router", "nat-gateway", "nat-gtw")):
        return "vRouter"
    if n.startswith("lb-") or "loadbalancer" in n:
        return "LB"
    if n.startswith("repl-"):
        return "Replication"
    return "Appliance"


def _resolve_storage_name(vol) -> str | None:
    ps = vol.primary_storage
    if ps is None:
        return None
    if ps.storage_type == "Ceph" and vol.install_path and ps.ceph_pools:
        try:
            pool_part = vol.install_path.split("://", 1)[1].split("/")[0]
            for pool in ps.ceph_pools:
                if pool.get("poolName") == pool_part:
                    alias = pool.get("aliasName")
                    return alias if alias else ps.name
        except (IndexError, AttributeError):
            pass
    return ps.name


def _build_vm_out(v: VM) -> VMOut:
    root_volume: VolumeInfo | None = None
    data_volumes: list[VolumeInfo] = []

    for vol in sorted(v.volumes, key=lambda x: (x.device_id or 0)):
        vi = VolumeInfo(
            name=vol.name,
            type=vol.type or "Unknown",
            size_gb=round((vol.size or 0) / GB, 2),
            storage_name=_resolve_storage_name(vol),
        )
        if vol.type == "Root":
            root_volume = vi
        else:
            data_volumes.append(vi)

    return VMOut(
        id=v.id,
        name=v.name,
        state=v.state,
        host=v.host.name if v.host else None,
        platform=v.platform,
        private_ip=v.private_ip,
        eip=v.eip,
        vcpu=v.vcpu_num,
        vram_gb=round(v.memory_size / GB, 2) if v.memory_size else None,
        storage_gb=round(sum(vol.size or 0 for vol in v.volumes) / GB, 2),
        created_at=v.zstack_created_at.isoformat() if v.zstack_created_at else None,
        project_name=v.project.name if v.project else None,
        root_volume=root_volume,
        data_volumes=data_volumes,
    )


async def _vm_trend_query(start_date, end_date, db):
    since = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
    until = (datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, microsecond=999999)
             if end_date else datetime.now(timezone.utc))
    rows = (
        await db.execute(
            select(cast(VM.zstack_created_at, Date).label("day"), func.count(VM.id).label("cnt"))
            .where(_USER_VM, VM.zstack_created_at >= since, VM.zstack_created_at <= until)
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
    q = select(VM).options(
        selectinload(VM.host),
        selectinload(VM.volumes).selectinload(Volume.primary_storage),
        selectinload(VM.project),
    ).where(_USER_VM)
    if state:
        q = q.where(VM.state == state)
    if search:
        q = q.where(VM.name.ilike(f"%{search}%") | VM.private_ip.ilike(f"%{search}%"))
    q = q.order_by(VM.zstack_created_at.desc().nulls_last()).offset((page - 1) * per_page).limit(per_page)
    vms = (await db.execute(q)).scalars().all()
    return [_build_vm_out(v) for v in vms]


@router.get("/infrastructure", response_model=list[InfraVMOut])
async def list_infra_vms(
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(VM)
        .options(selectinload(VM.host), selectinload(VM.project))
        .where(_INFRA_VM)
    )
    if search:
        q = q.where(VM.name.ilike(f"%{search}%") | VM.private_ip.ilike(f"%{search}%"))
    q = q.order_by(VM.name)
    vms = (await db.execute(q)).scalars().all()
    return [
        InfraVMOut(
            id=v.id,
            name=v.name,
            state=v.state,
            host=v.host.name if v.host else None,
            platform=v.platform,
            private_ip=v.private_ip,
            vcpu=v.vcpu_num,
            vram_gb=round(v.memory_size / GB, 2) if v.memory_size else None,
            created_at=v.zstack_created_at.isoformat() if v.zstack_created_at else None,
            project_name=v.project.name if v.project else None,
            infra_type=_infer_infra_type(v.name, v.appliance_type),
        )
        for v in vms
    ]


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
            .options(
                selectinload(VM.host),
                selectinload(VM.volumes).selectinload(Volume.primary_storage),
                selectinload(VM.project),
            )
            .where(_USER_VM, VM.zstack_created_at >= since, VM.zstack_created_at <= until_inclusive)
            .order_by(VM.zstack_created_at.desc())
        )
    ).scalars().all()
    return [_build_vm_out(v) for v in vms]


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
            .where(_USER_VM, VM.zstack_created_at >= since, VM.zstack_created_at <= until)
            .group_by("day").order_by("day")
        )
    ).all()
    return [ComputePoint(date=str(r.day), vcpu=int(r.vcpu or 0), ram_gb=round((r.mem or 0) / GB, 1)) for r in rows]
