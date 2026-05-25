import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from .config import settings
from .services.sync_service import run_sync

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def setup_scheduler():
    scheduler.add_job(
        _sync_job,
        "interval",
        seconds=settings.ZSTACK_POLL_INTERVAL_SECONDS,
        id="zstack_sync",
        replace_existing=True,
        max_instances=1,
    )


async def _sync_job():
    log.info("Scheduled ZStack sync starting")
    try:
        result = await run_sync()
        log.info("Sync completed: status=%s vms=%s", result.status, result.vms_synced)
    except Exception as exc:
        log.error("Sync job failed: %s", exc)
