import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.ceph_osd import CephOsdRecord
from ..models.osd_mapping import OsdMapping
from ..models.storage_node import StorageNode
from ..schemas.ceph_osd import CephCollectResult, CephOsdItem, OsdMappingItem
from ..services.ceph_osd_service import collect_ceph_osd_df_from_node, parse_and_upsert_ceph_osd
from ..services.lsblk_service import collect_lsblk_from_node, parse_and_upsert_lsblk

router = APIRouter(prefix="/ceph-osd", tags=["ceph-osd"])


@router.get("/osd-map", response_model=list[OsdMappingItem])
async def list_osd_map(db: AsyncSession = Depends(get_db)):
    records = (await db.execute(
        select(OsdMapping).order_by(OsdMapping.hostname, OsdMapping.nvme_device)
    )).scalars().all()
    return [OsdMappingItem.model_validate(r) for r in records]


@router.get("/osd-df", response_model=list[CephOsdItem])
async def list_ceph_osd_df(db: AsyncSession = Depends(get_db)):
    records = (await db.execute(
        select(CephOsdRecord).order_by(CephOsdRecord.osd_id)
    )).scalars().all()
    return [CephOsdItem.model_validate(r) for r in records]


@router.post("/refresh", response_model=CephCollectResult)
async def refresh_ceph(db: AsyncSession = Depends(get_db)):
    nodes = (await db.execute(
        select(StorageNode).where(StorageNode.enabled.is_(True))
    )).scalars().all()

    lsblk_collected = 0
    lsblk_failed = 0

    if nodes:
        lsblk_results = await asyncio.gather(*(collect_lsblk_from_node(n) for n in nodes))
        for _, error in lsblk_results:
            if error is None:
                lsblk_collected += 1
            else:
                lsblk_failed += 1

    # All enabled nodes produce identical cluster-wide ceph osd df data — collect from all
    ceph_collected = 0

    if nodes:
        ceph_results = await asyncio.gather(*(collect_ceph_osd_df_from_node(n) for n in nodes))
        ceph_collected = sum(1 for _, err in ceph_results if err is None)

    osd_map_parsed, map_errors = await parse_and_upsert_lsblk(db)
    ceph_parsed, ceph_errors = await parse_and_upsert_ceph_osd(db)

    return CephCollectResult(
        nodes_collected=lsblk_collected,
        nodes_failed=lsblk_failed,
        osd_mappings_parsed=osd_map_parsed,
        ceph_osd_records_parsed=ceph_parsed,
        errors=map_errors + ceph_errors,
        message=(
            f"lsblk: {lsblk_collected} nodes, {osd_map_parsed} NVMe records; "
            f"ceph osd df: {ceph_collected} node(s), {ceph_parsed} OSD records"
        ),
    )
