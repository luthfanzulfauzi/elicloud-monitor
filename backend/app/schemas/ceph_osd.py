import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class OsdMappingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hostname: str
    nvme_device: str
    osd_id: int | None
    size: str | None
    mount_path: str | None
    collected_at: datetime


class CephOsdItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    osd_id: int
    osd_name: str | None
    kb_total: int | None
    kb_used: int | None
    kb_avail: int | None
    utilization: float | None
    var: float | None
    crush_weight: float | None
    reweight: float | None
    pgs: int | None
    status: str | None
    source_hostname: str | None
    collected_at: datetime


class CephCollectResult(BaseModel):
    nodes_collected: int
    nodes_failed: int
    osd_mappings_parsed: int
    ceph_osd_records_parsed: int
    errors: int
    message: str
