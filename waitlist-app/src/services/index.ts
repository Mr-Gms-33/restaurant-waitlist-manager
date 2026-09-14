import { authStore } from './authStore';
import { createHttpWaitlistService } from './httpWaitlistService';
import { createMockWaitlistService } from './mockWaitlistService';
import type { WaitlistService } from './WaitlistService';

export type { WaitlistService } from './WaitlistService';
export { WaitlistServiceError } from './WaitlistService';
export { WaitlistServiceProvider, useWaitlistService } from './ServiceProvider';
export { createMockWaitlistService, MockWaitlistService } from './mockWaitlistService';
export type { MockWaitlistServiceOptions } from './mockWaitlistService';
export { createHttpWaitlistService, HttpWaitlistService } from './httpWaitlistService';
export type { HttpWaitlistServiceOptions } from './httpWaitlistService';
export { authStore, AuthError } from './authStore';
export type { AuthState } from './authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
const USE_MOCK_BACKEND = import.meta.env.VITE_USE_MOCK_BACKEND === 'true';

/**
 * The single place that decides which backend implementation the running app
 * uses. Defaults to the real FastAPI backend (`backend/`, see openapi.yaml).
 * Set `VITE_USE_MOCK_BACKEND=true` to fall back to the in-memory mock (e.g.
 * for offline demos or working on the UI without running the backend).
 */
let singleton: WaitlistService | null = null;

export function getWaitlistService(): WaitlistService {
  if (!singleton) {
    singleton = USE_MOCK_BACKEND
      ? createMockWaitlistService({ persist: true, latencyMs: 250 })
      : createHttpWaitlistService({ baseUrl: API_BASE_URL, getToken: () => authStore.getToken() });
  }
  return singleton;
}
