/**
 * Core domain types for the Restaurant Waitlist Manager.
 *
 * These types are shared by the UI, the `WaitlistService` interface, and every
 * implementation of it (mock or real). Keeping them here means the UI never
 * needs to know whether it is talking to a mock or a real backend.
 */

export type PartyStatus =
  | 'waiting'
  | 'arrival_confirmed'
  | 'table_ready'
  | 'seated'
  | 'cancelled'
  | 'no_show';

export const PARTY_STATUSES: PartyStatus[] = [
  'waiting',
  'arrival_confirmed',
  'table_ready',
  'seated',
  'cancelled',
  'no_show',
];

export type TableStatus = 'available' | 'occupied' | 'unavailable';

export const TABLE_STATUSES: TableStatus[] = ['available', 'occupied', 'unavailable'];

export interface Party {
  id: string;
  name: string;
  partySize: number;
  contact: string;
  status: PartyStatus;
  /** Manually entered by staff. Null until staff sets an estimate. */
  estimatedWaitMinutes: number | null;
  /** Table currently assigned to this party, if any. */
  tableId: string | null;
  /** ISO timestamp. Deadline for the guest to tap "I'm here" once a wait time is set. */
  arrivalDeadline: string | null;
  /** ISO timestamp the guest tapped "I'm here", if they have. */
  arrivalConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  partyId: string | null;
}

export interface JoinWaitlistInput {
  name: string;
  partySize: number;
  contact: string;
}

export interface AddTableInput {
  name: string;
  capacity: number;
}

/** Minutes a guest is given to confirm arrival once staff sets a wait estimate. */
export const ARRIVAL_CONFIRMATION_WINDOW_MINUTES = 15;
