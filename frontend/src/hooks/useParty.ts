import { useCallback, useEffect, useState } from 'react';
import { useWaitlistService } from '../services';
import type { Party } from '../types/domain';

interface UsePartyResult {
  party: Party | null;
  queuePosition: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Live-updating view of a single party, for the guest status page.
 *
 * Subscribes to the service so it re-fetches whenever staff (or the guest,
 * in another tab) changes anything - this is what makes the guest's browser
 * page feel "live" without a real push backend.
 */
export function useParty(partyId: string | undefined): UsePartyResult {
  const service = useWaitlistService();
  const [party, setParty] = useState<Party | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!partyId) {
      setParty(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([service.getParty(partyId), service.getQueuePosition(partyId)])
      .then(([p, position]) => {
        if (!active) return;
        setParty(p);
        setQueuePosition(position);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [service, partyId, tick]);

  useEffect(() => {
    const unsubscribe = service.subscribe(refresh);
    return unsubscribe;
  }, [service, refresh]);

  return { party, queuePosition, loading, error, refresh };
}
