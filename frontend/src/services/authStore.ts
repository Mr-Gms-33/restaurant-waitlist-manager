/**
 * Staff authentication state, kept outside React so both UI components
 * (via `useAuth()`) and `HttpWaitlistService` (via `getToken()`) can read the
 * current bearer token without needing to be inside the same component tree.
 *
 * Talks directly to the backend's `POST /auth/login` - this endpoint isn't
 * part of `WaitlistService` because the mock backend has no real auth.
 */

const STORAGE_KEY = 'waitlist-app:auth:v1';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthState {
  token: string | null;
  staffName: string | null;
  expiresAt: string | null;
}

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  staffName: string;
}

const EMPTY_STATE: AuthState = { token: null, staffName: null, expiresAt: null };

function loadFromStorage(): AuthState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<AuthState>) };
  } catch {
    return EMPTY_STATE;
  }
}

function saveToStorage(state: AuthState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures - the session just won't survive a reload.
  }
}

export class AuthStore {
  private state: AuthState;
  private readonly listeners = new Set<() => void>();
  private readonly baseUrl: string;
  private readonly persist: boolean;

  constructor(options: { baseUrl: string; persist?: boolean }) {
    this.baseUrl = options.baseUrl;
    this.persist = options.persist ?? true;
    this.state = this.persist ? loadFromStorage() : EMPTY_STATE;
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(next: AuthState): void {
    this.state = next;
    if (this.persist) saveToStorage(next);
    for (const listener of this.listeners) listener();
  }

  /** Returns the current bearer token, or null if missing/expired. */
  getToken(): string | null {
    if (!this.state.token) return null;
    if (this.state.expiresAt && new Date(this.state.expiresAt).getTime() <= Date.now()) {
      this.setState(EMPTY_STATE);
      return null;
    }
    return this.state.token;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  async login(username: string, password: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new AuthError('Could not reach the server. Is the backend running?');
    }

    if (!response.ok) {
      if (response.status === 401) throw new AuthError('Invalid username or password.');
      throw new AuthError(`Login failed (status ${response.status}).`);
    }

    const body = (await response.json()) as LoginResponse;
    this.setState({
      token: body.accessToken,
      staffName: body.staffName,
      expiresAt: body.expiresAt,
    });
  }

  logout(): void {
    this.setState(EMPTY_STATE);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';

/** App-wide singleton, mirroring `getWaitlistService()`. */
export const authStore = new AuthStore({ baseUrl: API_BASE_URL });
