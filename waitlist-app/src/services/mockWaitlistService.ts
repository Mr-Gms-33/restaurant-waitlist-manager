import {
  ARRIVAL_CONFIRMATION_WINDOW_MINUTES,
  type AddTableInput,
  type JoinWaitlistInput,
  type Party,
  type PartyStatus,
  type RestaurantTable,
  type TableStatus,
} from '../types/domain';
import { WaitlistServiceError, type WaitlistService } from './WaitlistService';

const STORAGE_KEY = 'waitlist-app:mock-store:v1';

interface Store {
  parties: Party[];
  tables: RestaurantTable[];
}

export interface MockWaitlistServiceOptions {
  /** Simulated network latency in milliseconds for every call. Default 250. */
  latencyMs?: number;
  /** Persist state to localStorage and sync across tabs via the storage event. Default false. */
  persist?: boolean;
  /** Seed the store with example data on first creation. Default true. */
  seed?: boolean;
}

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function seedStore(): Store {
  const tables: RestaurantTable[] = [
    { id: makeId('table'), name: 'T1', capacity: 2, status: 'available', partyId: null },
    { id: makeId('table'), name: 'T2', capacity: 2, status: 'available', partyId: null },
    { id: makeId('table'), name: 'T3', capacity: 4, status: 'available', partyId: null },
    { id: makeId('table'), name: 'T4', capacity: 4, status: 'occupied', partyId: null },
    { id: makeId('table'), name: 'T5', capacity: 6, status: 'available', partyId: null },
    { id: makeId('table'), name: 'T6', capacity: 8, status: 'unavailable', partyId: null },
  ];

  const parties: Party[] = [
    {
      id: makeId('party'),
      name: 'Alicia Moreno',
      partySize: 2,
      contact: '555-0101',
      status: 'waiting',
      estimatedWaitMinutes: 15,
      tableId: null,
      arrivalDeadline: null,
      arrivalConfirmedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: makeId('party'),
      name: 'Devon Blake',
      partySize: 4,
      contact: '555-0102',
      status: 'waiting',
      estimatedWaitMinutes: null,
      tableId: null,
      arrivalDeadline: null,
      arrivalConfirmedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  return { parties, tables };
}

/**
 * In-memory (optionally localStorage-backed) implementation of `WaitlistService`.
 *
 * This lets the entire app run end-to-end with no real backend: create one
 * instance and hand it to `WaitlistServiceProvider`. When `persist` is enabled,
 * state survives reloads and is loosely synced across browser tabs (useful for
 * demoing "staff dashboard in one tab, guest status page in another").
 */
export class MockWaitlistService implements WaitlistService {
  private store: Store;
  private readonly latencyMs: number;
  private readonly persist: boolean;
  private readonly listeners = new Set<() => void>();
  private readonly onStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      this.store = this.loadFromStorage() ?? this.store;
      this.notify();
    }
  };

  constructor(options: MockWaitlistServiceOptions = {}) {
    this.latencyMs = options.latencyMs ?? 250;
    this.persist = options.persist ?? false;
    const seed = options.seed ?? true;

    const loaded = this.persist ? this.loadFromStorage() : null;
    this.store = loaded ?? (seed ? seedStore() : { parties: [], tables: [] });

    if (this.persist) {
      this.saveToStorage();
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', this.onStorageEvent);
      }
    }
  }

  /** Stops listening to cross-tab storage events. Call when the app unmounts, if needed. */
  dispose(): void {
    if (this.persist && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.onStorageEvent);
    }
    this.listeners.clear();
  }

  // --- persistence / notification helpers --------------------------------------

  private loadFromStorage(): Store | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Store;
    } catch {
      return null;
    }
  }

  private saveToStorage(): void {
    if (!this.persist || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch {
      // Ignore storage failures (e.g. quota, private mode) - state stays in memory.
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private commit(): void {
    this.saveToStorage();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async delay<T>(value: T): Promise<T> {
    if (this.latencyMs <= 0) return value;
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    return value;
  }

  // --- internal lookups ---------------------------------------------------------

  private findParty(partyId: string): Party {
    const party = this.store.parties.find((p) => p.id === partyId);
    if (!party) throw new WaitlistServiceError(`Party ${partyId} not found`);
    return party;
  }

  private findTable(tableId: string): RestaurantTable {
    const table = this.store.tables.find((t) => t.id === tableId);
    if (!table) throw new WaitlistServiceError(`Table ${tableId} not found`);
    return table;
  }

  // --- guest-facing ---------------------------------------------------------------

  async joinWaitlist(input: JoinWaitlistInput): Promise<Party> {
    const name = input.name.trim();
    if (!name) throw new WaitlistServiceError('Name is required');
    if (!Number.isInteger(input.partySize) || input.partySize < 1) {
      throw new WaitlistServiceError('Party size must be a positive whole number');
    }
    const contact = input.contact.trim();
    if (!contact) throw new WaitlistServiceError('Contact info is required');

    const party: Party = {
      id: makeId('party'),
      name,
      partySize: input.partySize,
      contact,
      status: 'waiting',
      estimatedWaitMinutes: null,
      tableId: null,
      arrivalDeadline: null,
      arrivalConfirmedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.store.parties.push(party);
    this.commit();
    return this.delay({ ...party });
  }

  async getParty(partyId: string): Promise<Party | null> {
    const party = this.store.parties.find((p) => p.id === partyId) ?? null;
    return this.delay(party ? { ...party } : null);
  }

  async confirmArrival(partyId: string): Promise<Party> {
    const party = this.findParty(partyId);
    if (party.status !== 'waiting' && party.status !== 'table_ready') {
      throw new WaitlistServiceError(`Cannot confirm arrival for a party that is ${party.status}`);
    }
    party.arrivalConfirmedAt = nowIso();
    if (party.status === 'waiting') {
      party.status = 'arrival_confirmed';
    }
    party.updatedAt = nowIso();
    this.commit();
    return this.delay({ ...party });
  }

  async leaveWaitlist(partyId: string): Promise<void> {
    const party = this.findParty(partyId);
    if (party.tableId) {
      const table = this.store.tables.find((t) => t.id === party.tableId);
      if (table) {
        table.status = 'available';
        table.partyId = null;
      }
    }
    this.store.parties = this.store.parties.filter((p) => p.id !== partyId);
    this.commit();
    return this.delay(undefined);
  }

  async getQueuePosition(partyId: string): Promise<number | null> {
    const waiting = this.store.parties.filter(
      (p) => p.status === 'waiting' || p.status === 'arrival_confirmed',
    );
    const index = waiting.findIndex((p) => p.id === partyId);
    return this.delay(index === -1 ? null : index + 1);
  }

  // --- staff-facing: parties ------------------------------------------------------

  async listParties(): Promise<Party[]> {
    return this.delay(this.store.parties.map((p) => ({ ...p })));
  }

  async updateWaitTime(partyId: string, minutes: number): Promise<Party> {
    if (!Number.isFinite(minutes) || minutes < 0) {
      throw new WaitlistServiceError('Wait time must be a non-negative number');
    }
    const party = this.findParty(partyId);
    party.estimatedWaitMinutes = Math.round(minutes);
    party.arrivalDeadline = new Date(
      Date.now() + ARRIVAL_CONFIRMATION_WINDOW_MINUTES * 60_000,
    ).toISOString();
    party.updatedAt = nowIso();
    this.commit();
    return this.delay({ ...party });
  }

  async updatePartyStatus(partyId: string, status: PartyStatus): Promise<Party> {
    const party = this.findParty(partyId);
    party.status = status;
    party.updatedAt = nowIso();

    if (status === 'cancelled' || status === 'no_show' || status === 'seated') {
      if (party.tableId) {
        const table = this.store.tables.find((t) => t.id === party.tableId);
        if (table && status !== 'seated') {
          // Seated guests keep occupying the table until staff frees it manually;
          // cancelled/no-show guests free the table immediately.
          table.status = 'available';
          table.partyId = null;
          party.tableId = null;
        }
      }
    }

    this.commit();
    return this.delay({ ...party });
  }

  async reorderParties(orderedIds: string[]): Promise<Party[]> {
    const byId = new Map(this.store.parties.map((p) => [p.id, p] as const));
    if (orderedIds.length !== byId.size || orderedIds.some((id) => !byId.has(id))) {
      throw new WaitlistServiceError('reorderParties requires the full, matching set of party ids');
    }
    this.store.parties = orderedIds.map((id) => byId.get(id)!);
    this.commit();
    return this.delay(this.store.parties.map((p) => ({ ...p })));
  }

  async assignTable(
    partyId: string,
    tableId: string,
  ): Promise<{ party: Party; table: RestaurantTable }> {
    const party = this.findParty(partyId);
    const table = this.findTable(tableId);
    if (table.status !== 'available') {
      throw new WaitlistServiceError(`Table ${table.name} is not available`);
    }

    // Free any table the party previously held.
    if (party.tableId) {
      const previous = this.store.tables.find((t) => t.id === party.tableId);
      if (previous) {
        previous.status = 'available';
        previous.partyId = null;
      }
    }

    table.status = 'occupied';
    table.partyId = party.id;
    party.tableId = table.id;
    party.status = 'table_ready';
    party.updatedAt = nowIso();

    this.commit();
    return this.delay({ party: { ...party }, table: { ...table } });
  }

  async releaseTable(tableId: string): Promise<RestaurantTable> {
    const table = this.findTable(tableId);
    if (table.partyId) {
      const party = this.store.parties.find((p) => p.id === table.partyId);
      if (party) party.tableId = null;
    }
    table.status = 'available';
    table.partyId = null;
    this.commit();
    return this.delay({ ...table });
  }

  // --- staff-facing: tables --------------------------------------------------------

  async listTables(): Promise<RestaurantTable[]> {
    return this.delay(this.store.tables.map((t) => ({ ...t })));
  }

  async addTable(input: AddTableInput): Promise<RestaurantTable> {
    const name = input.name.trim();
    if (!name) throw new WaitlistServiceError('Table name is required');
    if (!Number.isInteger(input.capacity) || input.capacity < 1) {
      throw new WaitlistServiceError('Capacity must be a positive whole number');
    }
    const table: RestaurantTable = {
      id: makeId('table'),
      name,
      capacity: input.capacity,
      status: 'available',
      partyId: null,
    };
    this.store.tables.push(table);
    this.commit();
    return this.delay({ ...table });
  }

  async removeTable(tableId: string): Promise<void> {
    const table = this.findTable(tableId);
    if (table.partyId) {
      throw new WaitlistServiceError('Cannot remove a table that is currently assigned to a party');
    }
    this.store.tables = this.store.tables.filter((t) => t.id !== tableId);
    this.commit();
    return this.delay(undefined);
  }

  async updateTableStatus(tableId: string, status: TableStatus): Promise<RestaurantTable> {
    const table = this.findTable(tableId);
    if (table.partyId && status !== 'occupied') {
      throw new WaitlistServiceError('Unassign the table\'s party before changing its status');
    }
    table.status = status;
    this.commit();
    return this.delay({ ...table });
  }
}

export function createMockWaitlistService(
  options?: MockWaitlistServiceOptions,
): MockWaitlistService {
  return new MockWaitlistService(options);
}
