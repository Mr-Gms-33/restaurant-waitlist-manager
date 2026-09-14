"""Database-backed repository for parties and tables.

Same business rules as the original in-memory version (freeing a table on
cancel/no-show, blocking assignment to an occupied table, etc.) - only the
storage layer changed. A `WaitlistStore` is created fresh per request (see
`dependencies.get_store`), wrapping that request's SQLAlchemy `Session`;
realtime notifications go through the separate, long-lived `EventBroker`
(`events.py`) instead of living on the store itself.

Every query here uses SQLAlchemy's ORM/Core API, never anything
SQLite-specific, so this file doesn't change when `DATABASE_URL` points at
Postgres (or any other SQLAlchemy-supported database) instead.
"""

from __future__ import annotations

import itertools
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db_models import PartyRecord, TableRecord
from .errors import ConflictError, NotFoundError, ValidationError
from .events import EventBroker
from .models import Party, PartyStatus, RestaurantTable, TableStatus, utc_now

ARRIVAL_CONFIRMATION_WINDOW_MINUTES = 15

_id_counter = itertools.count(1)


def _make_id(prefix: str) -> str:
    return f"{prefix}_{next(_id_counter)}_{uuid.uuid4().hex[:8]}"


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """SQLite has no native timezone-aware storage, so round-tripping a
    `DateTime(timezone=True)` value through it can come back naive. Every
    timestamp this app stores is UTC, so just reattach that tzinfo when
    missing (a no-op against dialects, e.g. Postgres, that preserve it)."""
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _to_party(record: PartyRecord) -> Party:
    return Party(
        id=record.id,
        name=record.name,
        party_size=record.party_size,
        contact=record.contact,
        status=PartyStatus(record.status),
        estimated_wait_minutes=record.estimated_wait_minutes,
        table_id=record.table_id,
        arrival_deadline=_as_utc(record.arrival_deadline),
        arrival_confirmed_at=_as_utc(record.arrival_confirmed_at),
        created_at=_as_utc(record.created_at),
        updated_at=_as_utc(record.updated_at),
    )


def _to_table(record: TableRecord) -> RestaurantTable:
    return RestaurantTable(
        id=record.id,
        name=record.name,
        capacity=record.capacity,
        status=TableStatus(record.status),
        party_id=record.party_id,
    )


class WaitlistStore:
    def __init__(self, session: Session, broker: Optional[EventBroker] = None):
        self.session = session
        self.broker = broker

    def _commit(self) -> None:
        self.session.commit()
        if self.broker:
            self.broker.notify()

    # --- internal lookups -------------------------------------------------------------

    def _get_party_record(self, party_id: str) -> PartyRecord:
        record = self.session.get(PartyRecord, party_id)
        if record is None:
            raise NotFoundError(f"Party {party_id} not found")
        return record

    def _get_table_record(self, table_id: str) -> TableRecord:
        record = self.session.get(TableRecord, table_id)
        if record is None:
            raise NotFoundError(f"Table {table_id} not found")
        return record

    def _next_position(self) -> int:
        max_position = self.session.execute(select(func.max(PartyRecord.position))).scalar()
        return (max_position or 0) + 1

    # --- seeding --------------------------------------------------------------------

    def is_empty(self) -> bool:
        """True if there are no parties and no tables yet - used to decide
        whether to seed demo data without duplicating it on every restart of
        a persisted (file/Postgres) database."""
        has_party = self.session.execute(select(PartyRecord.id).limit(1)).first()
        has_table = self.session.execute(select(TableRecord.id).limit(1)).first()
        return has_party is None and has_table is None

    def seed(self) -> None:
        """Populates the store with example data so the frontend has something to show."""
        tables_seed = [
            ("T1", 2, TableStatus.AVAILABLE),
            ("T2", 2, TableStatus.AVAILABLE),
            ("T3", 4, TableStatus.AVAILABLE),
            ("T4", 4, TableStatus.OCCUPIED),
            ("T5", 6, TableStatus.AVAILABLE),
            ("T6", 8, TableStatus.UNAVAILABLE),
        ]
        for name, capacity, status in tables_seed:
            self.session.add(
                TableRecord(
                    id=_make_id("table"),
                    name=name,
                    capacity=capacity,
                    status=status.value,
                    party_id=None,
                )
            )

        now = utc_now()
        parties_seed = [
            ("Alicia Moreno", 2, "555-0101", 15),
            ("Devon Blake", 4, "555-0102", None),
        ]
        for index, (name, size, contact, wait) in enumerate(parties_seed):
            self.session.add(
                PartyRecord(
                    id=_make_id("party"),
                    name=name,
                    party_size=size,
                    contact=contact,
                    status=PartyStatus.WAITING.value,
                    estimated_wait_minutes=wait,
                    table_id=None,
                    arrival_deadline=None,
                    arrival_confirmed_at=None,
                    created_at=now,
                    updated_at=now,
                    position=index,
                )
            )
        self._commit()

    # --- guest-facing -------------------------------------------------------------

    def join_waitlist(self, name: str, party_size: int, contact: str) -> Party:
        name = name.strip()
        contact = contact.strip()
        if not name:
            raise ValidationError("Name is required")
        if party_size < 1:
            raise ValidationError("Party size must be a positive whole number")
        if not contact:
            raise ValidationError("Contact info is required")

        now = utc_now()
        record = PartyRecord(
            id=_make_id("party"),
            name=name,
            party_size=party_size,
            contact=contact,
            status=PartyStatus.WAITING.value,
            estimated_wait_minutes=None,
            table_id=None,
            arrival_deadline=None,
            arrival_confirmed_at=None,
            created_at=now,
            updated_at=now,
            position=self._next_position(),
        )
        self.session.add(record)
        self._commit()
        return _to_party(record)

    def get_party(self, party_id: str) -> Optional[Party]:
        record = self.session.get(PartyRecord, party_id)
        return _to_party(record) if record else None

    def confirm_arrival(self, party_id: str) -> Party:
        record = self._get_party_record(party_id)
        current_status = PartyStatus(record.status)
        if current_status not in (PartyStatus.WAITING, PartyStatus.TABLE_READY):
            raise ConflictError(f"Cannot confirm arrival for a party that is {current_status.value}")
        record.arrival_confirmed_at = utc_now()
        if current_status == PartyStatus.WAITING:
            record.status = PartyStatus.ARRIVAL_CONFIRMED.value
        record.updated_at = utc_now()
        self._commit()
        return _to_party(record)

    def leave_waitlist(self, party_id: str) -> None:
        record = self._get_party_record(party_id)
        if record.table_id:
            table = self.session.get(TableRecord, record.table_id)
            if table:
                table.status = TableStatus.AVAILABLE.value
                table.party_id = None
        self.session.delete(record)
        self._commit()

    def get_queue_position(self, party_id: str) -> Optional[int]:
        waiting_ids = [
            row[0]
            for row in self.session.execute(
                select(PartyRecord.id)
                .where(
                    PartyRecord.status.in_(
                        [PartyStatus.WAITING.value, PartyStatus.ARRIVAL_CONFIRMED.value]
                    )
                )
                .order_by(PartyRecord.position)
            )
        ]
        if party_id not in waiting_ids:
            return None
        return waiting_ids.index(party_id) + 1

    # --- staff-facing: parties ------------------------------------------------------

    def list_parties(self) -> list[Party]:
        records = self.session.execute(select(PartyRecord).order_by(PartyRecord.position)).scalars().all()
        return [_to_party(r) for r in records]

    def update_wait_time(self, party_id: str, minutes: float) -> Party:
        if minutes < 0:
            raise ValidationError("Wait time must be a non-negative number")
        record = self._get_party_record(party_id)
        record.estimated_wait_minutes = round(minutes)
        record.arrival_deadline = utc_now() + timedelta(minutes=ARRIVAL_CONFIRMATION_WINDOW_MINUTES)
        record.updated_at = utc_now()
        self._commit()
        return _to_party(record)

    def update_party_status(self, party_id: str, status: PartyStatus) -> Party:
        record = self._get_party_record(party_id)
        record.status = status.value
        record.updated_at = utc_now()

        if status in (PartyStatus.CANCELLED, PartyStatus.NO_SHOW) and record.table_id:
            table = self.session.get(TableRecord, record.table_id)
            if table:
                table.status = TableStatus.AVAILABLE.value
                table.party_id = None
            record.table_id = None
        # Seated guests keep occupying the table until staff frees it manually.

        self._commit()
        return _to_party(record)

    def reorder_parties(self, ordered_ids: list[str]) -> list[Party]:
        records = self.session.execute(select(PartyRecord)).scalars().all()
        current_ids = {r.id for r in records}
        if len(ordered_ids) != len(current_ids) or set(ordered_ids) != current_ids:
            raise ValidationError("reorderParties requires the full, matching set of party ids")

        by_id = {r.id: r for r in records}
        for index, party_id in enumerate(ordered_ids):
            by_id[party_id].position = index
        self._commit()
        return self.list_parties()

    def assign_table(self, party_id: str, table_id: str) -> tuple[Party, RestaurantTable]:
        party = self._get_party_record(party_id)
        table = self._get_table_record(table_id)
        if TableStatus(table.status) != TableStatus.AVAILABLE:
            raise ConflictError(f"Table {table.name} is not available")

        if party.table_id:
            previous = self.session.get(TableRecord, party.table_id)
            if previous:
                previous.status = TableStatus.AVAILABLE.value
                previous.party_id = None

        table.status = TableStatus.OCCUPIED.value
        table.party_id = party.id
        party.table_id = table.id
        party.status = PartyStatus.TABLE_READY.value
        party.updated_at = utc_now()

        self._commit()
        return _to_party(party), _to_table(table)

    def release_table(self, table_id: str) -> RestaurantTable:
        table = self._get_table_record(table_id)
        if table.party_id:
            party = self.session.get(PartyRecord, table.party_id)
            if party:
                party.table_id = None
        table.status = TableStatus.AVAILABLE.value
        table.party_id = None
        self._commit()
        return _to_table(table)

    # --- staff-facing: tables ---------------------------------------------------------

    def list_tables(self) -> list[RestaurantTable]:
        records = self.session.execute(select(TableRecord)).scalars().all()
        return [_to_table(r) for r in records]

    def add_table(self, name: str, capacity: int) -> RestaurantTable:
        name = name.strip()
        if not name:
            raise ValidationError("Table name is required")
        if capacity < 1:
            raise ValidationError("Capacity must be a positive whole number")
        record = TableRecord(
            id=_make_id("table"),
            name=name,
            capacity=capacity,
            status=TableStatus.AVAILABLE.value,
            party_id=None,
        )
        self.session.add(record)
        self._commit()
        return _to_table(record)

    def remove_table(self, table_id: str) -> None:
        record = self._get_table_record(table_id)
        if record.party_id:
            raise ConflictError("Cannot remove a table that is currently assigned to a party")
        self.session.delete(record)
        self._commit()

    def update_table_status(self, table_id: str, status: TableStatus) -> RestaurantTable:
        record = self._get_table_record(table_id)
        if record.party_id and status != TableStatus.OCCUPIED:
            raise ConflictError("Unassign the table's party before changing its status")
        record.status = status.value
        self._commit()
        return _to_table(record)
