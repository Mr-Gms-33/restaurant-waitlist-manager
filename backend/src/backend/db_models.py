"""SQLAlchemy ORM models - the actual database schema for parties and tables.

These mirror the shape of the Pydantic API schemas in `models.py`, but are a
separate set of classes on purpose: the API contract (`openapi.yaml`) and the
database schema are allowed to evolve independently. `store.py` is the only
place that converts between the two.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class TableRecord(Base):
    __tablename__ = "tables"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    # Not a real FK (parties<->tables would be a circular reference) - just a
    # denormalized pointer to the currently-assigned party, kept in sync by
    # `store.py` alongside `PartyRecord.table_id`.
    party_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class PartyRecord(Base):
    __tablename__ = "parties"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    contact: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    estimated_wait_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    table_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("tables.id", ondelete="SET NULL"), nullable=True
    )
    arrival_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    arrival_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Staff-controlled ordering of the queue (see `reorder_parties`), separate
    # from `created_at` so re-ordering doesn't require rewriting timestamps.
    position: Mapped[int] = mapped_column(Integer, nullable=False)
