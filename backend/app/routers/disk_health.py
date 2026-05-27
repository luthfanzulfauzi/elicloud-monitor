import csv
import io
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..models.disk_health import DiskHealthRecord
from ..schemas.disk_health import DiskHealthItem, RefreshResult, CollectResult as CollectResultSchema
from ..services.smartctl_service import collect_and_parse

router = APIRouter(prefix="/disk-health", tags=["disk-health"])


def _to_item(r: DiskHealthRecord) -> DiskHealthItem:
    capacity_tb = round(r.capacity_bytes / 1e12, 2) if r.capacity_bytes else None
    return DiskHealthItem(
        id=r.id,
        hostname=r.hostname,
        nvme_device=r.nvme_device,
        model_number=r.model_number,
        capacity_tb=capacity_tb,
        tbw=r.tbw,
        endurance_used_pct=r.endurance_used_pct,
        life_remaining_pct=r.life_remaining_pct,
        available_spare_pct=r.available_spare_pct,
        disk_health=r.disk_health,
        summary=r.summary,
        notes=r.notes,
        collected_at=r.collected_at,
    )


@router.get("/last-updated")
async def smartctl_last_updated():
    """Return the mtime of the newest *_smart.txt file in SMARTCTL_DIR, or null if none exist."""
    smartctl_dir = Path(settings.SMARTCTL_DIR)
    files = list(smartctl_dir.glob("*_smart.txt")) if smartctl_dir.exists() else []
    if not files:
        return {"last_updated": None}
    newest_mtime = max(f.stat().st_mtime for f in files)
    dt = datetime.fromtimestamp(newest_mtime, tz=timezone.utc)
    return {"last_updated": dt.isoformat()}


@router.get("", response_model=list[DiskHealthItem])
async def list_disk_health(
    hostname: str | None = Query(None),
    health: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(DiskHealthRecord).order_by(DiskHealthRecord.hostname, DiskHealthRecord.nvme_device)
    if hostname:
        q = q.where(DiskHealthRecord.hostname == hostname)
    if health:
        q = q.where(DiskHealthRecord.disk_health == health)
    records = (await db.execute(q)).scalars().all()
    return [_to_item(r) for r in records]


@router.post("/refresh", response_model=CollectResultSchema)
async def refresh_disk_health(db: AsyncSession = Depends(get_db)):
    result = await collect_and_parse(db)
    return CollectResultSchema(
        nodes_collected=result.nodes_collected,
        nodes_failed=result.nodes_failed,
        files_parsed=result.files_parsed,
        parse_errors=result.parse_errors,
        message=f"Collected {result.nodes_collected} node(s), parsed {result.files_parsed} file(s)",
    )


@router.get("/export/csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
    q = select(DiskHealthRecord).order_by(DiskHealthRecord.hostname, DiskHealthRecord.nvme_device)
    records = (await db.execute(q)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "hostname", "nvme_device", "model_number", "capacity_tb",
        "tbw", "endurance_used_pct", "life_remaining_pct", "available_spare_pct",
        "disk_health", "summary", "notes", "collected_at",
    ])
    for r in records:
        capacity_tb = round(r.capacity_bytes / 1e12, 2) if r.capacity_bytes else None
        writer.writerow([
            r.hostname, r.nvme_device, r.model_number, capacity_tb,
            r.tbw, r.endurance_used_pct, r.life_remaining_pct, r.available_spare_pct,
            r.disk_health, r.summary, r.notes,
            r.collected_at.isoformat() if r.collected_at else None,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=disk_health.csv"},
    )
