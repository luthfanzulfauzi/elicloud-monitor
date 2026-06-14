import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

import asyncssh
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.osd_mapping import OsdMapping

log = logging.getLogger(__name__)

_OSD_PATH_RE = re.compile(r'/var/lib/ceph/osd/ceph-(\d+)')


async def collect_lsblk_from_node(node) -> tuple[int, str | None]:
    known_hosts = None if not settings.SMARTCTL_KNOWN_HOSTS else settings.SMARTCTL_KNOWN_HOSTS
    try:
        async with asyncssh.connect(
            host=node.ssh_host, port=node.ssh_port, username=node.ssh_user,
            client_keys=[node.ssh_key_path], known_hosts=known_hosts,
        ) as conn:
            async with conn.start_sftp_client() as sftp:
                pattern = f"{node.remote_dir}/*_lsblk.json"
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
        log.error("lsblk collect failed for %s: %s", node.hostname, exc)
        return 0, str(exc)


def _find_ceph_osd(device: dict) -> tuple[int | None, str | None]:
    """Recursively find Ceph OSD mountpoint in lsblk device tree."""
    # lsblk -J may produce either "mountpoint" (str) or "mountpoints" (list)
    mountpoints: list[str] = []
    mp = device.get("mountpoint")
    if isinstance(mp, str) and mp:
        mountpoints.append(mp)
    for mp in device.get("mountpoints") or []:
        if isinstance(mp, str) and mp:
            mountpoints.append(mp)

    for mp in mountpoints:
        m = _OSD_PATH_RE.search(mp)
        if m:
            return int(m.group(1)), mp

    for child in device.get("children") or []:
        osd_id, found_mp = _find_ceph_osd(child)
        if osd_id is not None:
            return osd_id, found_mp

    return None, None


def _parse_lsblk_file(path: Path) -> list[dict]:
    stem = path.stem
    if not stem.endswith("_lsblk"):
        return []
    hostname = stem[: -len("_lsblk")]

    try:
        data = json.loads(path.read_text(errors="replace"))
    except json.JSONDecodeError as exc:
        log.warning("Failed to parse JSON %s: %s", path.name, exc)
        return []

    now = datetime.now(timezone.utc)
    records = []

    for device in data.get("blockdevices") or []:
        name = device.get("name", "")
        if device.get("type") != "disk" or not name.startswith("nvme"):
            continue

        osd_id, mount_path = _find_ceph_osd(device)
        records.append({
            "hostname": hostname,
            "nvme_device": name,
            "osd_id": osd_id,
            "size": device.get("size"),
            "mount_path": mount_path,
            "collected_at": now,
        })

    return records


async def parse_and_upsert_lsblk(db: AsyncSession) -> tuple[int, int]:
    smartctl_dir = Path(settings.SMARTCTL_DIR)
    if not smartctl_dir.exists():
        return 0, 0

    files = list(smartctl_dir.glob("*_lsblk.json"))
    if not files:
        return 0, 0

    parsed = 0
    errors = 0

    for path in files:
        try:
            records = _parse_lsblk_file(path)
            for record in records:
                stmt = (
                    pg_insert(OsdMapping)
                    .values(**record)
                    .on_conflict_do_update(
                        constraint="uq_osd_mapping_hostname_nvme",
                        set_={
                            "osd_id": record["osd_id"],
                            "size": record["size"],
                            "mount_path": record["mount_path"],
                            "collected_at": record["collected_at"],
                            "updated_at": datetime.now(timezone.utc),
                        },
                    )
                )
                await db.execute(stmt)
                parsed += 1
        except Exception as exc:
            log.error("Error processing %s: %s", path.name, exc)
            errors += 1

    await db.commit()
    log.info("lsblk parse complete: %d records, %d errors", parsed, errors)
    return parsed, errors
