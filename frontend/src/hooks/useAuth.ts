import { useCallback, useSyncExternalStore } from 'react';
import { authStore, type AuthState } from '../services/authStore';

interface UseAuthResult extends AuthState {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

/** React binding for the module-level `authStore`. Re-renders on login/logout. */
export function useAuth(): UseAuthResult {
  const state = useSyncExternalStore(
    (listener) => authStore.subscribe(listener),
    () => authStore.getState(),
  );

  const login = useCallback((username: string, password: string) => authStore.login(username, password), []);
  const logout = useCallback(() => authStore.logout(), []);

  return {
    ...state,
    isAuthenticated: authStore.isAuthenticated(),
    login,
    logout,
  };
}
