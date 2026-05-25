from pydantic import BaseModel
from uuid import UUID

TB = 1024 ** 4
GB = 1024 ** 3


class ProjectQuota(BaseModel):
    vm_num: int | None = None
    vcpu_num: int | None = None
    memory_gb: float | None = None
    storage_tb: float | None = None
    volume_num: int | None = None
    eip_num: int | None = None


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    state: str | None = None
    vm_count: int = 0
    vcpu_total: int = 0
    vram_total_gb: float = 0
    storage_total_tb: float = 0
    quota: ProjectQuota | None = None
