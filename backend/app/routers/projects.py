from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Project, VM
from ..schemas.project import ProjectOut, ProjectQuota

router = APIRouter(prefix="/projects", tags=["projects"])

TB = 1024 ** 4
GB = 1024 ** 3


def _parse_quota(raw: dict | None) -> ProjectQuota | None:
    if not raw:
        return None
    mem_bytes = raw.get("vm.memorySize")
    storage_bytes = raw.get("volume.capacity")
    return ProjectQuota(
        vm_num=raw.get("vm.num") or raw.get("vm.totalNum"),
        vcpu_num=raw.get("vm.cpuNum"),
        memory_gb=round(mem_bytes / GB, 1) if mem_bytes else None,
        storage_tb=round(storage_bytes / TB, 2) if storage_bytes else None,
        volume_num=raw.get("volume.data.num"),
        eip_num=raw.get("eip.num"),
    )


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: AsyncSession = Depends(get_db)):
    projects = (await db.execute(
        select(Project).options(selectinload(Project.vms).selectinload(VM.volumes))
    )).scalars().all()

    result = []
    for p in projects:
        vcpu = sum(v.vcpu_num or 0 for v in p.vms)
        mem_gb = round(sum(v.memory_size or 0 for v in p.vms) / GB, 1)
        storage_bytes = sum(vol.size or 0 for v in p.vms for vol in v.volumes)
        result.append(ProjectOut(
            id=p.id,
            name=p.name,
            description=p.description,
            state=p.state,
            vm_count=len(p.vms),
            vcpu_total=vcpu,
            vram_total_gb=mem_gb,
            storage_total_tb=round(storage_bytes / TB, 3),
            quota=_parse_quota(p.quotas),
        ))
    return result
