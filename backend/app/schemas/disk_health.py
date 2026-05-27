import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DiskHealthItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hostname: str
    nvme_device: str
    model_number: str | None
    capacity_tb: float | None
    tbw: float | None
    endurance_used_pct: float | None
    life_remaining_pct: float | None
    available_spare_pct: float | None
    disk_health: str
    summary: str | None
    notes: str | None
    collected_at: datetime


class RefreshResult(BaseModel):
    parsed: int
    errors: int
    message: str


class CollectResult(BaseModel):
    nodes_collected: int
    nodes_failed: int
    files_parsed: int
    parse_errors: int
    message: str
