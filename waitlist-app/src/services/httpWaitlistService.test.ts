import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpWaitlistService } from './httpWaitlistService';
import { WaitlistServiceError } from './WaitlistService';

const BASE_URL = 'http://test-backend/api/v1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Minimal fake EventSource so `subscribe()` can be exercised under jsdom. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  listeners: Record<string, Array<() => void>> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: () => void) {
    (this.listeners[event] ??= []).push(handler);
  }

  removeEventListener(event: string, handler: () => void) {
    this.listeners[event] = (this.listeners[event] ?? []).filter((h) => h !== handler);
  }

  close() {
    this.closed = true;
  }

  emit(event: string) {
    for (const handler of this.listeners[event] ?? []) handler();
  }
}

describe('HttpWaitlistService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('joins the waitlist via POST /parties with no auth header', async () => {
    const party = {
      id: 'party_1',
      name: 'Jane',
      partySize: 2,
      contact: '555',
      status: 'waiting',
      estimatedWaitMinutes: null,
      tableId: null,
      arrivalDeadline: null,
      arrivalConfirmedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    fetchMock.mockResolvedValue(jsonResponse(party, 201));

    const service = createHttpWaitlistService({ baseUrl: BASE_URL });
    const result = await service.joinWaitlist({ name: 'Jane', partySize: 2, contact: '555' });

    expect(result).toEqual(party);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/parties`);
    expect(init.method).toBe('POST');
    expect(init.headers.get('Authorization')).toBeNull();
    expect(JSON.parse(init.body)).toEqual({ name: 'Jane', partySize: 2, contact: '555' });
  });

  it('returns null for getParty on a 404 instead of throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'not found' }, 404));

    const service = createHttpWaitlistService({ baseUrl: BASE_URL });
    await expect(service.getParty('missing')).resolves.toBeNull();
  });

  it('throws WaitlistServiceError with the server message on non-ok responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Table T1 is not available' }, 409));

    const service = createHttpWaitlistService({
      baseUrl: BASE_URL,
      getToken: () => 'tok_123',
    });

    await expect(service.assignTable('party_1', 'table_1')).rejects.toThrow(
      'Table T1 is not available',
    );
  });

  it('rejects staff calls locally (no request made) when there is no token', async () => {
    const service = createHttpWaitlistService({ baseUrl: BASE_URL, getToken: () => null });

    await expect(service.listParties()).rejects.toThrow(WaitlistServiceError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attaches the bearer token for staff calls', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    const service = createHttpWaitlistService({ baseUrl: BASE_URL, getToken: () => 'tok_abc' });
    await service.listParties();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get('Authorization')).toBe('Bearer tok_abc');
  });

  it('treats a 204 response as void', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const service = createHttpWaitlistService({ baseUrl: BASE_URL });
    await expect(service.leaveWaitlist('party_1')).resolves.toBeUndefined();
  });

  it('subscribes/unsubscribes through a single shared EventSource', () => {
    const service = createHttpWaitlistService({ baseUrl: BASE_URL });

    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubscribeA = service.subscribe(listenerA);
    service.subscribe(listenerB);

    expect(FakeEventSource.instances).toHaveLength(1);
    const source = FakeEventSource.instances[0];
    expect(source.url).toBe(`${BASE_URL}/events`);

    source.emit('update');
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubscribeA();
    source.emit('update');
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(2);
    expect(source.closed).toBe(false);
  });

  it('closes the EventSource once the last subscriber unsubscribes', () => {
    const service = createHttpWaitlistService({ baseUrl: BASE_URL });
    const unsubscribe = service.subscribe(vi.fn());

    unsubscribe();

    expect(FakeEventSource.instances[0].closed).toBe(true);
  });
});
