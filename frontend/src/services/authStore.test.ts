import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, AuthStore } from './authStore';

const BASE_URL = 'http://test-backend/api/v1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AuthStore', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts unauthenticated', () => {
    const store = new AuthStore({ baseUrl: BASE_URL, persist: false });
    expect(store.isAuthenticated()).toBe(false);
    expect(store.getToken()).toBeNull();
  });

  it('logs in successfully and stores the token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        accessToken: 'tok_123',
        tokenType: 'bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        staffName: 'Pilot Staff',
      }),
    );

    const store = new AuthStore({ baseUrl: BASE_URL, persist: false });
    await store.login('staff', 'waitlist123');

    expect(store.isAuthenticated()).toBe(true);
    expect(store.getToken()).toBe('tok_123');
    expect(store.getState().staffName).toBe('Pilot Staff');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/auth/login`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws AuthError on invalid credentials and does not authenticate', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Invalid username or password' }, 401));

    const store = new AuthStore({ baseUrl: BASE_URL, persist: false });
    await expect(store.login('staff', 'wrong')).rejects.toThrow(AuthError);
    expect(store.isAuthenticated()).toBe(false);
  });

  it('throws AuthError when the server is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));

    const store = new AuthStore({ baseUrl: BASE_URL, persist: false });
    await expect(store.login('staff', 'waitlist123')).rejects.toThrow(AuthError);
  });

  it('treats an expired token as logged out', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        accessToken: 'tok_expired',
        tokenType: 'bearer',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        staffName: 'Pilot Staff',
      }),
    );

    const store = new AuthStore({ baseUrl: BASE_URL, persist: false });
    await store.login('staff', 'waitlist123');

    expect(store.getToken()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('notifies subscribers on login and logout', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        accessToken: 'tok_123',
        tokenType: 'bearer',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        staffName: 'Pilot Staff',
      }),
    );

    const store = new AuthStore({ baseUrl: BASE_URL, persist: false });
    const listener = vi.fn();
    store.subscribe(listener);

    await store.login('staff', 'waitlist123');
    expect(listener).toHaveBeenCalledTimes(1);

    store.logout();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.isAuthenticated()).toBe(false);
  });
});
