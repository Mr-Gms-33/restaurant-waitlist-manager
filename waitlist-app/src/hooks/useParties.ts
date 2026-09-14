import { useCallback, useEffect, useState } from 'react';
import { useWaitlistService } from '../services';
import type { Party } from '../types/domain';

interface UsePartiesResult {
  parties: Party[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Live-updating list of every party, for the staff dashboard. */
export function useParties(): UsePartiesResult {
  const service = useWaitlistService();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    service
      .listParties()
      .then((result) => {
        if (!active) return;
        setParties(result);
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
  }, [service, tick]);

  useEffect(() => {
    const unsubscribe = service.subscribe(refresh);
    return unsubscribe;
  }, [service, refresh]);

  return { parties, loading, error, refresh };
}
