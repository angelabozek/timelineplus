from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Date, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from db import Base
import datetime

class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    plan: Mapped[str] = mapped_column(String(50), default="free")

    projects: Mapped[list["Project"]] = relationship(back_populates="account")

class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="cascade"), index=True)
    title: Mapped[str] = mapped_column(Text)
    event_date: Mapped[datetime.date | None] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(30), default="manual")  # honeybook|vagaro|manual
    status: Mapped[str] = mapped_column(String(40), default="awaiting_intake")

    account: Mapped["Account"] = relationship(back_populates="projects")
    timeline: Mapped["Timeline"] = relationship(back_populates="project", uselist=False)

class Timeline(Base):
    __tablename__ = "timelines"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="cascade"), unique=True, index=True)
    schedule: Mapped[dict] = mapped_column(JSON, default=dict)  # {items:[{time,label},...]}
    public_slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    project: Mapped["Project"] = relationship(back_populates="timeline")