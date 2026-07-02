from pydantic import BaseModel
from uuid import UUID

TB = 1024 ** 4
GB = 1024 ** 3


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    state: str | None = None
    vm_count: int = 0
    vcpu_total: int = 0
    vram_total_gb: float = 0
    storage_total_tb: float = 0
