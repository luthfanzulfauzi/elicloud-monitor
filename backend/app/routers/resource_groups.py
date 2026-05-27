from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import ResourceGroup, ResourceGroupProject, Project, VM
from ..schemas.resource_group import ResourceGroupCreate, ResourceGroupUpdate, ResourceGroupOut

router = APIRouter(prefix="/resource-groups", tags=["resource-groups"])

TB = 1024 ** 4
GB = 1024 ** 3


async def _enrich(rg: ResourceGroup, db: AsyncSession) -> ResourceGroupOut:
    membership_ids = [m.project_id for m in rg.project_memberships]
    proj_names: list[str] = []
    resolved_ids: list = []
    vms: list[VM] = []
    for pid in membership_ids:
        proj = (await db.execute(
            select(Project).options(selectinload(Project.vms).selectinload(VM.volumes))
            .where(Project.id == pid)
        )).scalar_one_or_none()
        if proj:
            proj_names.append(proj.name)
            resolved_ids.append(proj.id)
            vms.extend(proj.vms)

    vcpu = sum(v.vcpu_num or 0 for v in vms)
    mem_gb = round(sum(v.memory_size or 0 for v in vms) / GB, 1)
    storage_gb = round(sum(vol.size or 0 for v in vms for vol in v.volumes) / GB, 1)
    return ResourceGroupOut(
        id=rg.id,
        name=rg.name,
        description=rg.description,
        projects=proj_names,
        project_ids=resolved_ids,
        vm_count=len(vms),
        vcpu_total=vcpu,
        vram_gb=mem_gb,
        storage_gb=storage_gb,
    )


@router.get("", response_model=list[ResourceGroupOut])
async def list_groups(db: AsyncSession = Depends(get_db)):
    groups = (await db.execute(
        select(ResourceGroup).options(selectinload(ResourceGroup.project_memberships))
    )).scalars().all()
    return [await _enrich(g, db) for g in groups]


@router.post("", response_model=ResourceGroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(body: ResourceGroupCreate, db: AsyncSession = Depends(get_db)):
    rg = ResourceGroup(name=body.name, description=body.description)
    db.add(rg)
    await db.flush()
    for pid in body.project_ids:
        db.add(ResourceGroupProject(resource_group_id=rg.id, project_id=pid))
    await db.commit()
    await db.refresh(rg, ["project_memberships"])
    return await _enrich(rg, db)


@router.get("/{group_id}", response_model=ResourceGroupOut)
async def get_group(group_id: str, db: AsyncSession = Depends(get_db)):
    rg = (await db.execute(
        select(ResourceGroup).options(selectinload(ResourceGroup.project_memberships))
        .where(ResourceGroup.id == group_id)
    )).scalar_one_or_none()
    if not rg:
        raise HTTPException(status_code=404, detail="Resource group not found")
    return await _enrich(rg, db)


@router.put("/{group_id}", response_model=ResourceGroupOut)
async def update_group(group_id: str, body: ResourceGroupUpdate, db: AsyncSession = Depends(get_db)):
    rg = (await db.execute(
        select(ResourceGroup).options(selectinload(ResourceGroup.project_memberships))
        .where(ResourceGroup.id == group_id)
    )).scalar_one_or_none()
    if not rg:
        raise HTTPException(status_code=404, detail="Resource group not found")
    if body.name is not None:
        rg.name = body.name
    if body.description is not None:
        rg.description = body.description
    if body.project_ids is not None:
        await db.execute(delete(ResourceGroupProject).where(ResourceGroupProject.resource_group_id == rg.id))
        for pid in body.project_ids:
            db.add(ResourceGroupProject(resource_group_id=rg.id, project_id=pid))
    db.add(rg)
    await db.commit()
    await db.refresh(rg, ["project_memberships"])
    return await _enrich(rg, db)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: str, db: AsyncSession = Depends(get_db)):
    rg = (await db.execute(select(ResourceGroup).where(ResourceGroup.id == group_id))).scalar_one_or_none()
    if not rg:
        raise HTTPException(status_code=404, detail="Resource group not found")
    await db.delete(rg)
    await db.commit()
