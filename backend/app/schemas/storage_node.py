import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class StorageNodeCreate(BaseModel):
    hostname: str
    ssh_host: str
    ssh_port: int = 22
    ssh_user: str
    ssh_key_path: str
    remote_dir: str
    enabled: bool = True
    is_ceph_admin: bool = False


class StorageNodeUpdate(BaseModel):
    hostname: str | None = None
    ssh_host: str | None = None
    ssh_port: int | None = None
    ssh_user: str | None = None
    ssh_key_path: str | None = None
    remote_dir: str | None = None
    enabled: bool | None = None
    is_ceph_admin: bool | None = None


class StorageNodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    hostname: str
    ssh_host: str
    ssh_port: int
    ssh_user: str
    ssh_key_path: str
    remote_dir: str
    enabled: bool
    is_ceph_admin: bool
    last_collected_at: datetime | None
    last_collect_status: str | None
    last_collect_error: str | None
    created_at: datetime
