from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import CollectionLog
from ..services.sync_service import run_sync

router = APIRouter(tags=["status"])


@router.get("/status")
async def app_status(db: AsyncSession = Depends(get_db)):
    last = (await db.execute(
        select(CollectionLog).order_by(CollectionLog.started_at.desc()).limit(1)
    )).scalar_one_or_none()
    return {
        "status": "ok",
        "last_sync": last.finished_at.isoformat() if last and last.finished_at else None,
        "last_sync_status": last.status if last else None,
    }


@router.post("/sync/trigger")
async def trigger_sync(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_sync)
    return {"message": "Sync triggered"}


@router.get("/sync/logs")
async def sync_logs(page: int = 1, per_page: int = 20, db: AsyncSession = Depends(get_db)):
    logs = (await db.execute(
        select(CollectionLog)
        .order_by(CollectionLog.started_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )).scalars().all()
    return [
        {
            "id": str(l.id),
            "started_at": l.started_at.isoformat(),
            "finished_at": l.finished_at.isoformat() if l.finished_at else None,
            "status": l.status,
            "hosts_synced": l.hosts_synced,
            "storages_synced": l.storages_synced,
            "vms_synced": l.vms_synced,
            "projects_synced": l.projects_synced,
            "error_message": l.error_message,
        }
        for l in logs
    ]
