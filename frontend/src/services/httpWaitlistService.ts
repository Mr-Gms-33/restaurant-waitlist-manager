/**
 * Real-backend implementation of `WaitlistService`, talking to the FastAPI
 * app in `backend/` over HTTP, per `openapi.yaml`.
 *
 * Every method here has a 1:1 counterpart in `mockWaitlistService.ts` - same
 * inputs, same return shape, same errors (`WaitlistServiceError`) - so the UI
 * never has to know which one it's talking to.
 */

import type {
  AddTableInput,
  JoinWaitlistInput,
  Party,
  PartyStatus,
  RestaurantTable,
  TableStatus,
} from '../types/domain';
import { WaitlistServiceError, type WaitlistService } from './WaitlistService';

export interface HttpWaitlistServiceOptions {
  /** e.g. "http://localhost:8000/api/v1" */
  baseUrl: string;
  /** Returns the current staff bearer token, or null if not logged in. */
  getToken?: () => string | null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** This call requires a staff bearer token (throws if `getToken()` returns null). */
  auth?: boolean;
  /** Return `null` instead of throwing when the server responds 404. */
  allow404?: boolean;
}

interface ErrorBody {
  error?: string;
}

export class HttpWaitlistService implements WaitlistService {
  private readonly baseUrl: string;
  private readonly getToken: () => string | null;
  private eventSource: EventSource | null = null;
  private readonly changeListeners = new Set<() => void>();

  constructor(options: HttpWaitlistServiceOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.getToken = options.getToken ?? (() => null);
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers({ 'Content-Type': 'application/json' });

    if (options.auth) {
      const token = this.getToken();
      if (!token) {
        throw new WaitlistServiceError('You must be logged in as staff to do this.');
      }
      headers.set('Authorization', `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new WaitlistServiceError('Could not reach the server. Is the backend running?');
    }

    if (response.status === 404 && options.allow404) {
      return null as T;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = (body as ErrorBody | null)?.error ?? `Request failed (status ${response.status})`;
      throw new WaitlistServiceError(message);
    }

    return body as T;
  }

  // --- guest-facing -------------------------------------------------------------------

  joinWaitlist(input: JoinWaitlistInput): Promise<Party> {
    return this.request<Party>('/parties', { method: 'POST', body: input });
  }

  getParty(partyId: string): Promise<Party | null> {
    return this.request<Party | null>(`/parties/${partyId}`, { allow404: true });
  }

  confirmArrival(partyId: string): Promise<Party> {
    return this.request<Party>(`/parties/${partyId}/confirm-arrival`, { method: 'POST' });
  }

  async leaveWaitlist(partyId: string): Promise<void> {
    await this.request<undefined>(`/parties/${partyId}`, { method: 'DELETE', allow404: true });
  }

  async getQueuePosition(partyId: string): Promise<number | null> {
    const result = await this.request<{ position: number | null } | null>(
      `/parties/${partyId}/queue-position`,
      { allow404: true },
    );
    return result?.position ?? null;
  }

  // --- staff-facing: parties ------------------------------------------------------

  listParties(): Promise<Party[]> {
    return this.request<Party[]>('/parties', { auth: true });
  }

  updateWaitTime(partyId: string, minutes: number): Promise<Party> {
    return this.request<Party>(`/parties/${partyId}/wait-time`, {
      method: 'PATCH',
      auth: true,
      body: { minutes },
    });
  }

  updatePartyStatus(partyId: string, status: PartyStatus): Promise<Party> {
    return this.request<Party>(`/parties/${partyId}/status`, {
      method: 'PATCH',
      auth: true,
      body: { status },
    });
  }

  reorderParties(orderedIds: string[]): Promise<Party[]> {
    return this.request<Party[]>('/parties/order', {
      method: 'PUT',
      auth: true,
      body: { orderedIds },
    });
  }

  async assignTable(partyId: string, tableId: string): Promise<{ party: Party; table: RestaurantTable }> {
    return this.request<{ party: Party; table: RestaurantTable }>(
      `/parties/${partyId}/assign-table`,
      { method: 'POST', auth: true, body: { tableId } },
    );
  }

  releaseTable(tableId: string): Promise<RestaurantTable> {
    return this.request<RestaurantTable>(`/tables/${tableId}/release`, {
      method: 'POST',
      auth: true,
    });
  }

  // --- staff-facing: tables ---------------------------------------------------------

  listTables(): Promise<RestaurantTable[]> {
    return this.request<RestaurantTable[]>('/tables', { auth: true });
  }

  addTable(input: AddTableInput): Promise<RestaurantTable> {
    return this.request<RestaurantTable>('/tables', { method: 'POST', auth: true, body: input });
  }

  async removeTable(tableId: string): Promise<void> {
    await this.request<undefined>(`/tables/${tableId}`, { method: 'DELETE', auth: true });
  }

  updateTableStatus(tableId: string, status: TableStatus): Promise<RestaurantTable> {
    return this.request<RestaurantTable>(`/tables/${tableId}/status`, {
      method: 'PATCH',
      auth: true,
      body: { status },
    });
  }

  // --- realtime ------------------------------------------------------------------------

  /**
   * Lazily opens a single shared `EventSource` to `GET /events` on first
   * subscriber, closes it once the last one unsubscribes. No auth: the guest
   * status page (no login) needs to subscribe too.
   */
  subscribe(listener: () => void): () => void {
    this.ensureEventSource();
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
      if (this.changeListeners.size === 0) {
        this.eventSource?.close();
        this.eventSource = null;
      }
    };
  }

  private ensureEventSource(): void {
    if (this.eventSource || typeof EventSource === 'undefined') return;
    const source = new EventSource(`${this.baseUrl}/events`);
    source.addEventListener('update', () => {
      for (const listener of this.changeListeners) listener();
    });
    this.eventSource = source;
  }
}

export function createHttpWaitlistService(options: HttpWaitlistServiceOptions): HttpWaitlistService {
  return new HttpWaitlistService(options);
}
