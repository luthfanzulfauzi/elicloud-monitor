from pydantic import BaseModel
from uuid import UUID

GB = 1024 ** 3


class HostListItem(BaseModel):
    id: UUID
    name: str
    management_ip: str | None
    state: str | None
    vcpu_total: int | None
    vcpu_allocated: int | None
    memory_total_gb: float | None
    memory_allocated_gb: float | None
    vm_count: int = 0
    cpu_overcommit: float | None = None
    mem_overcommit: float | None = None


class HostTrendPoint(BaseModel):
    date: str
    cpu_allocated: int
    cpu_total: int
    memory_allocated_gb: float
    memory_total_gb: float
