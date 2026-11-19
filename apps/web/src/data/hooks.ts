import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getVersion, subscribe } from './store';

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetches with `fn` and refetches whenever the data store changes (any mutation) or `key`
 * changes. Previous data stays visible while refetching the same key, so tables don't flash; data
 * of another key is never returned (a page whose id arrives later must not render the old result).
 */
export function useQuery<T>(key: string, fn: () => Promise<T>): QueryState<T> {
  const storeVersion = useSyncExternalStore(subscribe, getVersion, getVersion);
  const [state, setState] = useState<{ key: string | null; data: T | undefined; loading: boolean; error: Error | null }>({
    key: null,
    data: undefined,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current().then(
      (data) => live && setState({ key, data, loading: false, error: null }),
      (error: unknown) => live && setState((s) => ({ ...s, key, loading: false, error: error instanceof Error ? error : new Error(String(error)) })),
    );
    return () => {
      live = false;
    };
  }, [key, storeVersion, nonce]);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  if (state.key !== key) return { data: undefined, loading: true, error: null, refetch };
  return { data: state.data, loading: state.loading, error: state.error, refetch };
}

export interface MutationState<A extends unknown[], R> {
  run: (...args: A) => Promise<R>;
  pending: boolean;
  error: Error | null;
}

/** Wraps an API mutation with pending/error state; resolves with the API result. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>): MutationState<A, R> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(
    async (...args: A) => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error };
}
