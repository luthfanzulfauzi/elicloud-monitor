from pydantic import BaseModel


class SyncInfo(BaseModel):
    last_sync: str
    status: str


class DashboardSummary(BaseModel):
    total_hosts: int
    running_vms: int
    stopped_vms: int
    total_storage_used_tb: float
    total_storage_tb: float
    total_cpu_allocated: int = 0
    total_cpu_total: int = 0
    total_memory_allocated_gb: float = 0.0
    total_memory_total_gb: float = 0.0
    sync_info: SyncInfo | None


class TopHost(BaseModel):
    name: str
    management_ip: str | None
    vcpu_total: int | None
    vcpu_allocated: int | None
    memory_total_gb: float | None
    memory_allocated_gb: float | None
    vm_count: int
    cpu_overcommit: float | None
    mem_overcommit: float | None
