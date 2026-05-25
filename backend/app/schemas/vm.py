from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

GB = 1024 ** 3


class VMOut(BaseModel):
    id: UUID
    name: str
    state: str | None
    host: str | None
    platform: str | None
    private_ip: str | None
    eip: str | None
    vcpu: int | None
    vram_gb: float | None
    storage_gb: float | None
    created_at: str | None


class VMTrendPoint(BaseModel):
    date: str
    count: int
