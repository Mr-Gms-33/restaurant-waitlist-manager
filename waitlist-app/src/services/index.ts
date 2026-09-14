import { createMockWaitlistService } from './mockWaitlistService';
import type { WaitlistService } from './WaitlistService';

export type { WaitlistService } from './WaitlistService';
export { WaitlistServiceError } from './WaitlistService';
export { WaitlistServiceProvider, useWaitlistService } from './ServiceProvider';
export { createMockWaitlistService, MockWaitlistService } from './mockWaitlistService';
export type { MockWaitlistServiceOptions } from './mockWaitlistService';

/**
 * The single place that decides which backend implementation the running app
 * uses. Today it always returns the mock (there is no real backend yet), but
 * a future `HttpWaitlistService` could be swapped in here - behind an env
 * flag, for example - without any other file changing.
 */
let singleton: WaitlistService | null = null;

export function getWaitlistService(): WaitlistService {
  if (!singleton) {
    singleton = createMockWaitlistService({ persist: true, latencyMs: 250 });
  }
  return singleton;
}
