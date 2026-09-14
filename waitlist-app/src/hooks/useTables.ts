import { useCallback, useEffect, useState } from 'react';
import { useWaitlistService } from '../services';
import type { RestaurantTable } from '../types/domain';

interface UseTablesResult {
  tables: RestaurantTable[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Live-updating list of every table, for the staff dashboard. */
export function useTables(): UseTablesResult {
  const service = useWaitlistService();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    service
      .listTables()
      .then((result) => {
        if (!active) return;
        setTables(result);
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

  return { tables, loading, error, refresh };
}
