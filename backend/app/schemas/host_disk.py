from pydantic import BaseModel


class HostDiskSummary(BaseModel):
    root_use_pct: float | None
    max_use_pct: float | None
    max_mountpoint: str | None
    collected_at: str | None


HostDiskSummaryMap = dict[str, HostDiskSummary | None]


class DiskRefreshResult(BaseModel):
    success_count: int
    error_count: int
    message: str
