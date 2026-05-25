from sqlalchemy import String, Text, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid
from ..database import Base


class ResourceGroup(Base):
    __tablename__ = "resource_groups"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[object | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    project_memberships: Mapped[list["ResourceGroupProject"]] = relationship(
        "ResourceGroupProject", back_populates="resource_group", cascade="all, delete-orphan"
    )


class ResourceGroupProject(Base):
    __tablename__ = "resource_group_projects"
    __table_args__ = (UniqueConstraint("resource_group_id", "project_id"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    resource_group_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("resource_groups.id"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)

    resource_group: Mapped["ResourceGroup"] = relationship("ResourceGroup", back_populates="project_memberships")
    project: Mapped["Project"] = relationship("Project", back_populates="group_memberships")
