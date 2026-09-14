from __future__ import annotations

import pytest

from backend.db import create_db_engine, create_session_factory, init_schema
from backend.errors import ConflictError, NotFoundError, ValidationError
from backend.events import EventBroker
from backend.models import PartyStatus, TableStatus
from backend.store import WaitlistStore


@pytest.fixture
def session():
    engine = create_db_engine("sqlite:///:memory:")
    init_schema(engine)
    factory = create_session_factory(engine)
    with factory() as session:
        yield session
    engine.dispose()


@pytest.fixture
def broker():
    return EventBroker()


@pytest.fixture
def store(session, broker):
    return WaitlistStore(session, broker)


def test_join_waitlist_adds_a_waiting_party(store):
    party = store.join_waitlist(name="Ada Lovelace", party_size=3, contact="555-1234")
    assert party.status == PartyStatus.WAITING
    assert party.estimated_wait_minutes is None
    assert store.get_party(party.id) == party


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


def test_reorder_parties_updates_list_order(store):
    a = store.join_waitlist(name="A", party_size=1, contact="1")
    b = store.join_waitlist(name="B", party_size=1, contact="2")
    c = store.join_waitlist(name="C", party_size=1, contact="3")

    reordered = store.reorder_parties([c.id, a.id, b.id])
    assert [p.id for p in reordered] == [c.id, a.id, b.id]
    assert [p.id for p in store.list_parties()] == [c.id, a.id, b.id]


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


def test_notifies_broker_on_mutation(store, broker):
    calls = []
    unsubscribe = broker.subscribe(lambda: calls.append(1))

    store.join_waitlist(name="A", party_size=1, contact="1")
    assert len(calls) == 1

    unsubscribe()
    store.join_waitlist(name="B", party_size=1, contact="2")
    assert len(calls) == 1


def test_is_empty_and_seed(store):
    assert store.is_empty() is True

    store.seed()

    assert store.is_empty() is False
    assert len(store.list_parties()) == 2
    assert len(store.list_tables()) == 6


def test_data_persists_across_store_instances_sharing_a_session_factory():
    """Regression check that we're really talking to the database, not to
    Python objects held by one `WaitlistStore` instance."""
    engine = create_db_engine("sqlite:///:memory:")
    init_schema(engine)
    factory = create_session_factory(engine)

    with factory() as session:
        WaitlistStore(session).join_waitlist(name="Persisted", party_size=2, contact="1")

    with factory() as session:
        parties = WaitlistStore(session).list_parties()

    assert len(parties) == 1
    assert parties[0].name == "Persisted"
    engine.dispose()
