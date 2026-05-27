import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from .config import settings
from .database import AsyncSessionLocal
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
    scheduler.add_job(
        _disk_health_job,
        "interval",
        seconds=settings.SMARTCTL_COLLECT_INTERVAL_SECONDS,
        id="disk_health_collect",
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


async def _disk_health_job():
    from .services.smartctl_service import collect_and_parse

    log.info("Scheduled disk health collection starting")
    try:
        async with AsyncSessionLocal() as db:
            result = await collect_and_parse(db)
        log.info(
            "Disk health collect completed: nodes_collected=%d nodes_failed=%d files_parsed=%d parse_errors=%d",
            result.nodes_collected,
            result.nodes_failed,
            result.files_parsed,
            result.parse_errors,
        )
    except Exception as exc:
        log.error("Disk health job failed: %s", exc)
