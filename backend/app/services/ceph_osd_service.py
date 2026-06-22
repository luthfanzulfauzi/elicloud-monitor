import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import asyncssh
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.ceph_osd import CephOsdRecord, CephOsdSnapshot

log = logging.getLogger(__name__)


async def collect_ceph_osd_df_from_node(node) -> tuple[int, str | None]:
    known_hosts = None if not settings.SMARTCTL_KNOWN_HOSTS else settings.SMARTCTL_KNOWN_HOSTS
    try:
        async with asyncssh.connect(
            host=node.ssh_host, port=node.ssh_port, username=node.ssh_user,
            client_keys=[node.ssh_key_path], known_hosts=known_hosts,
        ) as conn:
            async with conn.start_sftp_client() as sftp:
                pattern = f"{node.remote_dir}/*_ceph_osd_df.json"
                try:
                    matches = await sftp.glob(pattern)
                except asyncssh.SFTPError:
                    matches = []

                dest_dir = Path(settings.SMARTCTL_DIR)
                dest_dir.mkdir(parents=True, exist_ok=True)

                count = 0
                for remote_path in matches:
                    try:
                        async with await sftp.open(remote_path, "r") as f:
                            content = await f.read()
                        dest = dest_dir / Path(remote_path).name
                        dest.write_bytes(content if isinstance(content, bytes) else content.encode())
                        count += 1
                    except Exception as exc:
                        log.warning("Failed to download %s from %s: %s", remote_path, node.hostname, exc)

        return count, None
    except Exception as exc:
        log.error("ceph osd df collect failed for %s: %s", node.hostname, exc)
        return 0, str(exc)


def _parse_ceph_osd_df_file(path: Path) -> list[dict]:
    stem = path.stem
    if not stem.endswith("_ceph_osd_df"):
        return []
    source_hostname = stem[: -len("_ceph_osd_df")]

    try:
        data = json.loads(path.read_text(errors="replace"))
    except json.JSONDecodeError as exc:
        log.warning("Failed to parse JSON %s: %s", path.name, exc)
        return []

    now = datetime.now(timezone.utc)
    records = []

    for node in data.get("nodes") or []:
        if node.get("type") != "osd":
            continue
        reweight = node.get("reweight") or 0.0
        # ceph osd df JSON has no "status" field — derive from reweight
        derived_status = "active" if reweight > 0.0 else "out"
        records.append({
            "osd_id": node["id"],
            "osd_name": node.get("name"),
            "kb_total": node.get("kb"),
            "kb_used": node.get("kb_used"),
            "kb_avail": node.get("kb_avail"),
            "utilization": node.get("utilization"),
            "var": node.get("var"),
            "crush_weight": node.get("crush_weight"),
            "reweight": reweight,
            "pgs": node.get("pgs"),
            "status": derived_status,
            "source_hostname": source_hostname,
            "collected_at": now,
        })

    return records


async def parse_and_upsert_ceph_osd(db: AsyncSession) -> tuple[int, int]:
    smartctl_dir = Path(settings.SMARTCTL_DIR)
    if not smartctl_dir.exists():
        return 0, 0

    files = list(smartctl_dir.glob("*_ceph_osd_df.json"))
    if not files:
        return 0, 0

    # All nodes produce identical cluster-wide ceph osd df data — parse only the newest file
    files = [max(files, key=lambda p: p.stat().st_mtime)]

    parsed = 0
    errors = 0

    for path in files:
        try:
            records = _parse_ceph_osd_df_file(path)
            for record in records:
                # Upsert latest state
                stmt = (
                    pg_insert(CephOsdRecord)
                    .values(**record)
                    .on_conflict_do_update(
                        constraint="uq_ceph_osd_id",
                        set_={
                            "osd_name": record["osd_name"],
                            "kb_total": record["kb_total"],
                            "kb_used": record["kb_used"],
                            "kb_avail": record["kb_avail"],
                            "utilization": record["utilization"],
                            "var": record["var"],
                            "crush_weight": record["crush_weight"],
                            "reweight": record["reweight"],
                            "pgs": record["pgs"],
                            "status": record["status"],
                            "source_hostname": record["source_hostname"],
                            "collected_at": record["collected_at"],
                            "updated_at": datetime.now(timezone.utc),
                        },
                    )
                )
                await db.execute(stmt)

                # Append to history
                await db.execute(
                    pg_insert(CephOsdSnapshot).values(
                        osd_id=record["osd_id"],
                        utilization=record["utilization"],
                        kb_used=record["kb_used"],
                        kb_total=record["kb_total"],
                        crush_weight=record["crush_weight"],
                        pgs=record["pgs"],
                        status=record["status"],
                        collected_at=record["collected_at"],
                    )
                )
                parsed += 1
        except Exception as exc:
            log.error("Error processing %s: %s", path.name, exc)
            errors += 1

    await db.commit()
    log.info("ceph osd df parse complete: %d records, %d errors", parsed, errors)
    return parsed, errors
