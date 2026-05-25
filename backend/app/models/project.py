from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
import uuid
from ..database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    zstack_uuid: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str | None] = mapped_column(String)
    linked_account_uuid: Mapped[str | None] = mapped_column(String)
    quotas: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    vms: Mapped[list["VM"]] = relationship("VM", back_populates="project")
    group_memberships: Mapped[list["ResourceGroupProject"]] = relationship("ResourceGroupProject", back_populates="project")
