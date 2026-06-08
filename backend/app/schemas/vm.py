from pydantic import BaseModel
from uuid import UUID

GB = 1024 ** 3


class VolumeInfo(BaseModel):
    name: str
    type: str
    size_gb: float
    storage_name: str | None


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
    project_name: str | None
    root_volume: VolumeInfo | None
    data_volumes: list[VolumeInfo]


class InfraVMOut(BaseModel):
    id: UUID
    name: str
    state: str | None
    host: str | None
    platform: str | None
    private_ip: str | None
    vcpu: int | None
    vram_gb: float | None
    created_at: str | None
    project_name: str | None
    infra_type: str


class VMTrendPoint(BaseModel):
    date: str
    count: int
