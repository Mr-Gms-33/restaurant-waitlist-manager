import type {
  AddTableInput,
  JoinWaitlistInput,
  Party,
  PartyStatus,
  RestaurantTable,
  TableStatus,
} from '../types/domain';

/**
 * Thrown by service implementations when an operation cannot be completed
 * (e.g. entity not found, invalid transition). The UI layer should catch this
 * and show a friendly message rather than a raw error.
 */
export class WaitlistServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WaitlistServiceError';
  }
}

/**
 * Single point of contact between the UI and "the backend".
 *
 * Every network/data call the app makes goes through this interface. The UI
 * (pages, components, hooks) must never import a concrete implementation
 * directly - it should always go through `useWaitlistService()` /
 * `getWaitlistService()`. This makes it possible to:
 *  - run the entire app against `MockWaitlistService` with no real backend
 *  - later swap in an `HttpWaitlistService` (or similar) without touching UI code
 *  - unit test UI components against a fake/mocked service
 */
export interface WaitlistService {
  // --- Guest-facing operations -------------------------------------------------

  /** Adds a new party to the waitlist and returns it. */
  joinWaitlist(input: JoinWaitlistInput): Promise<Party>;

  /** Returns a single party, or null if it doesn't exist (e.g. removed). */
  getParty(partyId: string): Promise<Party | null>;

  /** Guest confirms they are on their way / present, before the deadline. */
  confirmArrival(partyId: string): Promise<Party>;

  /** Guest voluntarily leaves the waitlist. */
  leaveWaitlist(partyId: string): Promise<void>;

  /** Returns the party's 1-based position among currently waiting parties. */
  getQueuePosition(partyId: string): Promise<number | null>;

  // --- Staff-facing operations: parties ----------------------------------------

  /** Returns every party, most recently created last (staff dashboard order). */
  listParties(): Promise<Party[]>;

  /** Staff manually sets/updates the estimated wait time, in minutes. */
  updateWaitTime(partyId: string, minutes: number): Promise<Party>;

  /** Staff transitions a party to a new status (ready, seated, cancelled, no_show, ...). */
  updatePartyStatus(partyId: string, status: PartyStatus): Promise<Party>;

  /** Staff reorders the waiting queue by supplying the full ordered list of party ids. */
  reorderParties(orderedIds: string[]): Promise<Party[]>;

  /** Staff assigns a table to a party; marks the table occupied and the party table_ready. */
  assignTable(partyId: string, tableId: string): Promise<{ party: Party; table: RestaurantTable }>;

  /** Staff unassigns a party's table (e.g. after seating elsewhere or on cancellation). */
  releaseTable(tableId: string): Promise<RestaurantTable>;

  // --- Staff-facing operations: tables -----------------------------------------

  listTables(): Promise<RestaurantTable[]>;

  addTable(input: AddTableInput): Promise<RestaurantTable>;

  removeTable(tableId: string): Promise<void>;

  updateTableStatus(tableId: string, status: TableStatus): Promise<RestaurantTable>;

  // --- Realtime -----------------------------------------------------------------

  /**
   * Registers a listener invoked whenever any waitlist/table data changes
   * (from this tab or, for implementations that support it, other tabs/devices).
   * Returns an unsubscribe function. Consumers should re-fetch on notification
   * rather than assume the listener carries the new data.
   */
  subscribe(listener: () => void): () => void;
}
