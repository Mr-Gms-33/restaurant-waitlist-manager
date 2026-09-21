import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockWaitlistService, MockWaitlistService } from './mockWaitlistService';
import { WaitlistServiceError } from './WaitlistService';

function makeService(): MockWaitlistService {
  return createMockWaitlistService({ latencyMs: 0, persist: false, seed: false });
}

describe('MockWaitlistService - guest flow', () => {
  let service: MockWaitlistService;

  beforeEach(() => {
    service = makeService();
  });

  it('adds a party to the waitlist with status "waiting"', async () => {
    const party = await service.joinWaitlist({ name: 'Ada Lovelace', partySize: 3, contact: '555-1234' });

    expect(party.id).toBeTruthy();
    expect(party.name).toBe('Ada Lovelace');
    expect(party.partySize).toBe(3);
    expect(party.status).toBe('waiting');
    expect(party.estimatedWaitMinutes).toBeNull();
    expect(party.tableId).toBeNull();
  });

  it('rejects joining with invalid input', async () => {
    await expect(service.joinWaitlist({ name: '', partySize: 2, contact: '555' })).rejects.toThrow(
      WaitlistServiceError,
    );
    await expect(service.joinWaitlist({ name: 'Bo', partySize: 0, contact: '555' })).rejects.toThrow(
      WaitlistServiceError,
    );
    await expect(service.joinWaitlist({ name: 'Bo', partySize: 2, contact: '' })).rejects.toThrow(
      WaitlistServiceError,
    );
  });

  it('returns null for a party that does not exist', async () => {
    expect(await service.getParty('nope')).toBeNull();
  });

  it('computes queue position among waiting/arrival-confirmed parties only', async () => {
    const a = await service.joinWaitlist({ name: 'A', partySize: 1, contact: '1' });
    const b = await service.joinWaitlist({ name: 'B', partySize: 1, contact: '2' });
    const c = await service.joinWaitlist({ name: 'C', partySize: 1, contact: '3' });

    expect(await service.getQueuePosition(a.id)).toBe(1);
    expect(await service.getQueuePosition(b.id)).toBe(2);
    expect(await service.getQueuePosition(c.id)).toBe(3);

    await service.updatePartyStatus(a.id, 'cancelled');
    expect(await service.getQueuePosition(b.id)).toBe(1);
    expect(await service.getQueuePosition(c.id)).toBe(2);
  });

  it('lets a guest confirm arrival while waiting', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 1, contact: '1' });
    const confirmed = await service.confirmArrival(party.id);

    expect(confirmed.status).toBe('arrival_confirmed');
    expect(confirmed.arrivalConfirmedAt).toBeTruthy();
  });

  it('rejects confirming arrival for a seated/cancelled party', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 1, contact: '1' });
    await service.updatePartyStatus(party.id, 'cancelled');
    await expect(service.confirmArrival(party.id)).rejects.toThrow(WaitlistServiceError);
  });

  it('lets a guest leave the waitlist, freeing any assigned table', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 2, contact: '1' });
    const table = await service.addTable({ name: 'T1', capacity: 2 });
    await service.assignTable(party.id, table.id);

    await service.leaveWaitlist(party.id);

    expect(await service.getParty(party.id)).toBeNull();
    const tables = await service.listTables();
    expect(tables[0].status).toBe('available');
    expect(tables[0].partyId).toBeNull();
  });
});

describe('MockWaitlistService - staff flow', () => {
  let service: MockWaitlistService;

  beforeEach(() => {
    service = makeService();
  });

  it('sets an estimated wait time and an arrival deadline', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 1, contact: '1' });
    const updated = await service.updateWaitTime(party.id, 20);

    expect(updated.estimatedWaitMinutes).toBe(20);
    expect(updated.arrivalDeadline).toBeTruthy();
  });

  it('rejects a negative wait time', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 1, contact: '1' });
    await expect(service.updateWaitTime(party.id, -5)).rejects.toThrow(WaitlistServiceError);
  });

  it('reorders the queue', async () => {
    const a = await service.joinWaitlist({ name: 'A', partySize: 1, contact: '1' });
    const b = await service.joinWaitlist({ name: 'B', partySize: 1, contact: '2' });
    const c = await service.joinWaitlist({ name: 'C', partySize: 1, contact: '3' });

    const reordered = await service.reorderParties([c.id, a.id, b.id]);
    expect(reordered.map((p) => p.id)).toEqual([c.id, a.id, b.id]);
  });

  it('rejects reordering with a mismatched set of ids', async () => {
    await service.joinWaitlist({ name: 'A', partySize: 1, contact: '1' });
    await expect(service.reorderParties(['bogus'])).rejects.toThrow(WaitlistServiceError);
  });

  it('assigns an available table to a party and marks it table_ready', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 2, contact: '1' });
    const table = await service.addTable({ name: 'T1', capacity: 2 });

    const { party: updatedParty, table: updatedTable } = await service.assignTable(party.id, table.id);

    expect(updatedParty.status).toBe('table_ready');
    expect(updatedParty.tableId).toBe(table.id);
    expect(updatedTable.status).toBe('occupied');
    expect(updatedTable.partyId).toBe(party.id);
  });

  it('rejects assigning a table that is not available', async () => {
    const party1 = await service.joinWaitlist({ name: 'A', partySize: 2, contact: '1' });
    const party2 = await service.joinWaitlist({ name: 'B', partySize: 2, contact: '2' });
    const table = await service.addTable({ name: 'T1', capacity: 2 });

    await service.assignTable(party1.id, table.id);
    await expect(service.assignTable(party2.id, table.id)).rejects.toThrow(WaitlistServiceError);
  });

  it('frees the table when a party is cancelled or marked no-show', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 2, contact: '1' });
    const table = await service.addTable({ name: 'T1', capacity: 2 });
    await service.assignTable(party.id, table.id);

    await service.updatePartyStatus(party.id, 'no_show');

    const tables = await service.listTables();
    expect(tables[0].status).toBe('available');
    expect(tables[0].partyId).toBeNull();
  });

  it('keeps the table occupied when a party is marked seated', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 2, contact: '1' });
    const table = await service.addTable({ name: 'T1', capacity: 2 });
    await service.assignTable(party.id, table.id);

    await service.updatePartyStatus(party.id, 'seated');

    const tables = await service.listTables();
    expect(tables[0].status).toBe('occupied');
  });

  it('releases a table manually, unassigning its party', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 2, contact: '1' });
    const table = await service.addTable({ name: 'T1', capacity: 2 });
    await service.assignTable(party.id, table.id);

    const released = await service.releaseTable(table.id);
    expect(released.status).toBe('available');
    expect(released.partyId).toBeNull();

    const refreshedParty = await service.getParty(party.id);
    expect(refreshedParty?.tableId).toBeNull();
  });

  it('adds and removes tables', async () => {
    const table = await service.addTable({ name: 'T9', capacity: 6 });
    expect((await service.listTables()).map((t) => t.id)).toContain(table.id);

    await service.removeTable(table.id);
    expect((await service.listTables()).map((t) => t.id)).not.toContain(table.id);
  });

  it('rejects removing a table that is currently assigned', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 2, contact: '1' });
    const table = await service.addTable({ name: 'T1', capacity: 2 });
    await service.assignTable(party.id, table.id);

    await expect(service.removeTable(table.id)).rejects.toThrow(WaitlistServiceError);
  });

  it('rejects changing an occupied table to another status directly', async () => {
    const party = await service.joinWaitlist({ name: 'A', partySize: 2, contact: '1' });
    const table = await service.addTable({ name: 'T1', capacity: 2 });
    await service.assignTable(party.id, table.id);

    await expect(service.updateTableStatus(table.id, 'unavailable')).rejects.toThrow(
      WaitlistServiceError,
    );
  });
});

describe('MockWaitlistService - realtime notifications', () => {
  it('notifies subscribers whenever the store mutates', async () => {
    const service = makeService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    await service.joinWaitlist({ name: 'A', partySize: 1, contact: '1' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await service.joinWaitlist({ name: 'B', partySize: 1, contact: '2' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('MockWaitlistService - persistence', () => {
  it('persists state to localStorage and reloads it in a new instance', async () => {
    const first = createMockWaitlistService({ latencyMs: 0, persist: true, seed: false });
    const party = await first.joinWaitlist({ name: 'Persisted', partySize: 2, contact: '1' });
    first.dispose();

    const second = createMockWaitlistService({ latencyMs: 0, persist: true, seed: false });
    const reloaded = await second.getParty(party.id);
    expect(reloaded?.name).toBe('Persisted');
    second.dispose();
  });
});
