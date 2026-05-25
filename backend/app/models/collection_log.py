from sqlalchemy import String, Integer, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class CollectionLog(Base):
    __tablename__ = "collection_logs"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    started_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    finished_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str | None] = mapped_column(String)  # success, partial, failed
    hosts_synced: Mapped[int | None] = mapped_column(Integer)
    storages_synced: Mapped[int | None] = mapped_column(Integer)
    vms_synced: Mapped[int | None] = mapped_column(Integer)
    projects_synced: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
