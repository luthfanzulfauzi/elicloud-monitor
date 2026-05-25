from pydantic import BaseModel
from uuid import UUID

TB = 1024 ** 4
GB = 1024 ** 3


class CephPool(BaseModel):
    pool_name: str
    alias_name: str | None
    total_tb: float
    used_tb: float
    util_pct: int


class StorageOut(BaseModel):
    id: UUID
    name: str
    type: str | None
    state: str | None
    total_tb: float
    used_tb: float
    total_physical_tb: float = 0.0
    used_physical_tb: float = 0.0
    volume_count: int = 0
    ceph_pools: list[CephPool] | None = None


class ProvisioningPoint(BaseModel):
    date: str
    value: float


class ComputePoint(BaseModel):
    date: str
    vcpu: int
    ram_gb: float


class StorageCapacityPoint(BaseModel):
    date: str
    capacity_total_tb: float
    capacity_used_tb: float
