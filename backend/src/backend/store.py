"""In-memory data store for parties and tables.

This is the Python equivalent of the frontend's `mockWaitlistService.ts`: a
single place holding all waitlist state, with the exact same business rules
(freeing a table on cancel/no-show, blocking assignment to an occupied
table, etc). Routers never touch state directly - they always go through a
`WaitlistStore` instance.

Not process-safe (state lives in a plain Python object in memory) and not
thread-safe beyond what a single asyncio event loop provides - which is
enough for a single `uvicorn` worker. A real multi-instance deployment would
replace this with a database-backed implementation behind the same
interface.
"""

from __future__ import annotations

import itertools
import uuid
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Callable, Optional

from .errors import ConflictError, NotFoundError, ValidationError
from .models import Party, PartyStatus, RestaurantTable, TableStatus, utc_now

ARRIVAL_CONFIRMATION_WINDOW_MINUTES = 15

Listener = Callable[[], None]

_id_counter = itertools.count(1)


def _make_id(prefix: str) -> str:
    return f"{prefix}_{next(_id_counter)}_{uuid.uuid4().hex[:8]}"


@dataclass
class WaitlistStore:
    parties: dict[str, Party] = field(default_factory=dict)
    tables: dict[str, RestaurantTable] = field(default_factory=dict)
    _listeners: list[Listener] = field(default_factory=list)
    # Preserves insertion/creation order, since dicts alone don't guarantee
    # the "staff dashboard order" semantics after re-ordering operations.
    _party_order: list[str] = field(default_factory=list)

    # --- subscription -------------------------------------------------------------

    def subscribe(self, listener: Listener) -> Callable[[], None]:
        self._listeners.append(listener)

        def unsubscribe() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return unsubscribe

    def _notify(self) -> None:
        for listener in list(self._listeners):
            listener()

    # --- seeding --------------------------------------------------------------------

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
            table = RestaurantTable(
                id=_make_id("table"), name=name, capacity=capacity, status=status, party_id=None
            )
            self.tables[table.id] = table

        now = utc_now()
        parties_seed = [
            dict(name="Alicia Moreno", party_size=2, contact="555-0101", estimated_wait_minutes=15),
            dict(name="Devon Blake", party_size=4, contact="555-0102", estimated_wait_minutes=None),
        ]
        for data in parties_seed:
            party = Party(
                id=_make_id("party"),
                name=data["name"],
                party_size=data["party_size"],
                contact=data["contact"],
                status=PartyStatus.WAITING,
                estimated_wait_minutes=data["estimated_wait_minutes"],
                table_id=None,
                arrival_deadline=None,
                arrival_confirmed_at=None,
                created_at=now,
                updated_at=now,
            )
            self.parties[party.id] = party
            self._party_order.append(party.id)

    # --- internal lookups -------------------------------------------------------------

    def _find_party(self, party_id: str) -> Party:
        party = self.parties.get(party_id)
        if party is None:
            raise NotFoundError(f"Party {party_id} not found")
        return party

    def _find_table(self, table_id: str) -> RestaurantTable:
        table = self.tables.get(table_id)
        if table is None:
            raise NotFoundError(f"Table {table_id} not found")
        return table

    # --- guest-facing -------------------------------------------------------------------

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
        party = Party(
            id=_make_id("party"),
            name=name,
            party_size=party_size,
            contact=contact,
            status=PartyStatus.WAITING,
            estimated_wait_minutes=None,
            table_id=None,
            arrival_deadline=None,
            arrival_confirmed_at=None,
            created_at=now,
            updated_at=now,
        )
        self.parties[party.id] = party
        self._party_order.append(party.id)
        self._notify()
        return party

    def get_party(self, party_id: str) -> Optional[Party]:
        return self.parties.get(party_id)

    def confirm_arrival(self, party_id: str) -> Party:
        party = self._find_party(party_id)
        if party.status not in (PartyStatus.WAITING, PartyStatus.TABLE_READY):
            raise ConflictError(f"Cannot confirm arrival for a party that is {party.status.value}")
        party.arrival_confirmed_at = utc_now()
        if party.status == PartyStatus.WAITING:
            party.status = PartyStatus.ARRIVAL_CONFIRMED
        party.updated_at = utc_now()
        self._notify()
        return party

    def leave_waitlist(self, party_id: str) -> None:
        party = self._find_party(party_id)
        if party.table_id:
            table = self.tables.get(party.table_id)
            if table:
                table.status = TableStatus.AVAILABLE
                table.party_id = None
        del self.parties[party_id]
        if party_id in self._party_order:
            self._party_order.remove(party_id)
        self._notify()

    def get_queue_position(self, party_id: str) -> Optional[int]:
        waiting_ids = [
            pid
            for pid in self._party_order
            if pid in self.parties
            and self.parties[pid].status in (PartyStatus.WAITING, PartyStatus.ARRIVAL_CONFIRMED)
        ]
        if party_id not in waiting_ids:
            return None
        return waiting_ids.index(party_id) + 1

    # --- staff-facing: parties ------------------------------------------------------------

    def list_parties(self) -> list[Party]:
        return [self.parties[pid] for pid in self._party_order if pid in self.parties]

    def update_wait_time(self, party_id: str, minutes: float) -> Party:
        if minutes < 0:
            raise ValidationError("Wait time must be a non-negative number")
        party = self._find_party(party_id)
        party.estimated_wait_minutes = round(minutes)
        party.arrival_deadline = utc_now() + timedelta(minutes=ARRIVAL_CONFIRMATION_WINDOW_MINUTES)
        party.updated_at = utc_now()
        self._notify()
        return party

    def update_party_status(self, party_id: str, status: PartyStatus) -> Party:
        party = self._find_party(party_id)
        party.status = status
        party.updated_at = utc_now()

        if status in (PartyStatus.CANCELLED, PartyStatus.NO_SHOW) and party.table_id:
            table = self.tables.get(party.table_id)
            if table:
                table.status = TableStatus.AVAILABLE
                table.party_id = None
            party.table_id = None
        # Seated guests keep occupying the table until staff frees it manually.

        self._notify()
        return party

    def reorder_parties(self, ordered_ids: list[str]) -> list[Party]:
        current_ids = set(self.parties.keys())
        if len(ordered_ids) != len(current_ids) or set(ordered_ids) != current_ids:
            raise ValidationError("reorderParties requires the full, matching set of party ids")
        self._party_order = list(ordered_ids)
        self._notify()
        return self.list_parties()

    def assign_table(self, party_id: str, table_id: str) -> tuple[Party, RestaurantTable]:
        party = self._find_party(party_id)
        table = self._find_table(table_id)
        if table.status != TableStatus.AVAILABLE:
            raise ConflictError(f"Table {table.name} is not available")

        if party.table_id:
            previous = self.tables.get(party.table_id)
            if previous:
                previous.status = TableStatus.AVAILABLE
                previous.party_id = None

        table.status = TableStatus.OCCUPIED
        table.party_id = party.id
        party.table_id = table.id
        party.status = PartyStatus.TABLE_READY
        party.updated_at = utc_now()

        self._notify()
        return party, table

    def release_table(self, table_id: str) -> RestaurantTable:
        table = self._find_table(table_id)
        if table.party_id:
            party = self.parties.get(table.party_id)
            if party:
                party.table_id = None
        table.status = TableStatus.AVAILABLE
        table.party_id = None
        self._notify()
        return table

    # --- staff-facing: tables ---------------------------------------------------------------

    def list_tables(self) -> list[RestaurantTable]:
        return list(self.tables.values())

    def add_table(self, name: str, capacity: int) -> RestaurantTable:
        name = name.strip()
        if not name:
            raise ValidationError("Table name is required")
        if capacity < 1:
            raise ValidationError("Capacity must be a positive whole number")
        table = RestaurantTable(
            id=_make_id("table"), name=name, capacity=capacity, status=TableStatus.AVAILABLE, party_id=None
        )
        self.tables[table.id] = table
        self._notify()
        return table

    def remove_table(self, table_id: str) -> None:
        table = self._find_table(table_id)
        if table.party_id:
            raise ConflictError("Cannot remove a table that is currently assigned to a party")
        del self.tables[table_id]
        self._notify()

    def update_table_status(self, table_id: str, status: TableStatus) -> RestaurantTable:
        table = self._find_table(table_id)
        if table.party_id and status != TableStatus.OCCUPIED:
            raise ConflictError("Unassign the table's party before changing its status")
        table.status = status
        self._notify()
        return table


def create_store(seed: bool = True) -> WaitlistStore:
    store = WaitlistStore()
    if seed:
        store.seed()
    return store
