from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class ResourceGroupCreate(BaseModel):
    name: str
    description: str | None = None
    project_ids: list[UUID] = []


class ResourceGroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    project_ids: list[UUID] | None = None


class ResourceGroupOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    projects: list[str] = []
    project_ids: list[UUID] = []
    vm_count: int = 0
    vcpu_total: int = 0
    vram_gb: float = 0
    storage_gb: float = 0
