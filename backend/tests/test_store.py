from __future__ import annotations

import pytest

from backend.errors import ConflictError, NotFoundError, ValidationError
from backend.models import PartyStatus, TableStatus
from backend.store import create_store


@pytest.fixture
def store():
    return create_store(seed=False)


def test_join_waitlist_adds_a_waiting_party(store):
    party = store.join_waitlist(name="Ada Lovelace", party_size=3, contact="555-1234")
    assert party.status == PartyStatus.WAITING
    assert party.estimated_wait_minutes is None
    assert store.get_party(party.id) is party


def test_join_waitlist_rejects_blank_name(store):
    with pytest.raises(ValidationError):
        store.join_waitlist(name="   ", party_size=2, contact="555")


def test_queue_position_only_counts_waiting_and_confirmed(store):
    a = store.join_waitlist(name="A", party_size=1, contact="1")
    b = store.join_waitlist(name="B", party_size=1, contact="2")

    assert store.get_queue_position(a.id) == 1
    assert store.get_queue_position(b.id) == 2

    store.update_party_status(a.id, PartyStatus.CANCELLED)
    assert store.get_queue_position(b.id) == 1
    assert store.get_queue_position(a.id) is None


def test_confirm_arrival_rejects_cancelled_party(store):
    party = store.join_waitlist(name="A", party_size=1, contact="1")
    store.update_party_status(party.id, PartyStatus.CANCELLED)
    with pytest.raises(ConflictError):
        store.confirm_arrival(party.id)


def test_leave_waitlist_frees_assigned_table(store):
    party = store.join_waitlist(name="A", party_size=2, contact="1")
    table = store.add_table(name="T1", capacity=2)
    store.assign_table(party.id, table.id)

    store.leave_waitlist(party.id)

    assert store.get_party(party.id) is None
    refreshed_table = store.list_tables()[0]
    assert refreshed_table.status == TableStatus.AVAILABLE
    assert refreshed_table.party_id is None


def test_assign_table_rejects_unavailable_table(store):
    p1 = store.join_waitlist(name="A", party_size=2, contact="1")
    p2 = store.join_waitlist(name="B", party_size=2, contact="2")
    table = store.add_table(name="T1", capacity=2)

    store.assign_table(p1.id, table.id)
    with pytest.raises(ConflictError):
        store.assign_table(p2.id, table.id)


def test_reorder_parties_rejects_incomplete_id_set(store):
    store.join_waitlist(name="A", party_size=1, contact="1")
    with pytest.raises(ValidationError):
        store.reorder_parties(["bogus"])


def test_remove_table_rejects_when_assigned(store):
    party = store.join_waitlist(name="A", party_size=2, contact="1")
    table = store.add_table(name="T1", capacity=2)
    store.assign_table(party.id, table.id)

    with pytest.raises(ConflictError):
        store.remove_table(table.id)


def test_not_found_errors_for_unknown_ids(store):
    with pytest.raises(NotFoundError):
        store.confirm_arrival("nope")
    with pytest.raises(NotFoundError):
        store.release_table("nope")


def test_subscribers_are_notified_on_mutation(store):
    calls = []
    unsubscribe = store.subscribe(lambda: calls.append(1))

    store.join_waitlist(name="A", party_size=1, contact="1")
    assert len(calls) == 1

    unsubscribe()
    store.join_waitlist(name="B", party_size=1, contact="2")
    assert len(calls) == 1


def test_seed_populates_demo_parties_and_tables():
    store = create_store(seed=True)
    assert len(store.list_parties()) == 2
    assert len(store.list_tables()) == 6
