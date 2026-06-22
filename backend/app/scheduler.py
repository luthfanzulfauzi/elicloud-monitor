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
    scheduler.add_job(
        _host_disk_scrape_job,
        "interval",
        seconds=settings.PROMETHEUS_SCRAPE_INTERVAL_SECONDS,
        id="host_disk_scrape",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.add_job(
        _ceph_collect_job,
        "interval",
        seconds=settings.CEPH_COLLECT_INTERVAL_SECONDS,
        id="ceph_collect",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.add_job(
        _alert_check_job,
        "interval",
        seconds=settings.ALERT_CHECK_INTERVAL_SECONDS,
        id="alert_check",
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


async def _host_disk_scrape_job():
    from .services.prometheus_service import scrape_and_upsert_all

    log.info("Scheduled Prometheus disk scrape starting")
    try:
        async with AsyncSessionLocal() as db:
            success, errors = await scrape_and_upsert_all(db)
        log.info("Prometheus disk scrape done: success=%d errors=%d", success, errors)
    except Exception as exc:
        log.error("Prometheus disk scrape job failed: %s", exc)


async def _ceph_collect_job():
    from .services.lsblk_service import collect_lsblk_from_node, parse_and_upsert_lsblk
    from .services.ceph_osd_service import collect_ceph_osd_df_from_node, parse_and_upsert_ceph_osd
    from sqlalchemy import select
    from .models.storage_node import StorageNode
    import asyncio

    log.info("Scheduled Ceph/lsblk collection starting")
    try:
        async with AsyncSessionLocal() as db:
            nodes = (await db.execute(
                select(StorageNode).where(StorageNode.enabled.is_(True))
            )).scalars().all()

            if nodes:
                await asyncio.gather(*(collect_lsblk_from_node(n) for n in nodes))

            # All enabled nodes produce identical cluster-wide ceph osd df data
            if nodes:
                await asyncio.gather(*(collect_ceph_osd_df_from_node(n) for n in nodes))

            osd_map_parsed, _ = await parse_and_upsert_lsblk(db)
            ceph_parsed, _ = await parse_and_upsert_ceph_osd(db)

        log.info("Ceph collect completed: osd_map=%d ceph_osd=%d", osd_map_parsed, ceph_parsed)
    except Exception as exc:
        log.error("Ceph collect job failed: %s", exc)


async def _alert_check_job():
    from .services.alert_service import check_disk_health_alerts

    try:
        async with AsyncSessionLocal() as db:
            count = await check_disk_health_alerts(db)
        if count > 0:
            log.info("Alert check: sent %d alert(s)", count)
    except Exception as exc:
        log.error("Alert check job failed: %s", exc)


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
