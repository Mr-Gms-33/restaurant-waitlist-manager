import { createContext, useContext, type ReactNode } from 'react';
import type { WaitlistService } from './WaitlistService';

const WaitlistServiceContext = createContext<WaitlistService | null>(null);

interface WaitlistServiceProviderProps {
  service: WaitlistService;
  children: ReactNode;
}

/**
 * Makes a `WaitlistService` implementation available to the whole component
 * tree. Swapping backends (mock -> real) means changing the `service` passed
 * in here - nothing else in the UI has to change.
 */
export function WaitlistServiceProvider({ service, children }: WaitlistServiceProviderProps) {
  return (
    <WaitlistServiceContext.Provider value={service}>{children}</WaitlistServiceContext.Provider>
  );
}

/** Access the current `WaitlistService`. Must be used within a `WaitlistServiceProvider`. */
export function useWaitlistService(): WaitlistService {
  const service = useContext(WaitlistServiceContext);
  if (!service) {
    throw new Error('useWaitlistService must be used within a WaitlistServiceProvider');
  }
  return service;
}
