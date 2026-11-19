import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface Store<T> {
  get(): T;
  set(update: Partial<T> | ((s: T) => Partial<T>)): void;
  reset(): void;
  subscribe(l: () => void): () => void;
  /** React hook returning the current state. */
  use(): T;
  /** Resolves once the persisted value (if any) has been loaded. */
  ready: Promise<void>;
}

/**
 * Tiny store: state lives in memory and is read with `store.use()`. In design mode it is mirrored to
 * AsyncStorage under `key`; in live mode (`persist: false`) the API is the source of truth.
 */
export function createStore<T extends object>(key: string, initial: T, opts: { persist?: boolean } = {}): Store<T> {
  const keep = opts.persist ?? true;
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const persist = () => (keep ? AsyncStorage.setItem('bl:' + key, JSON.stringify(state)).catch(() => {}) : undefined);
  const ready = (keep ? AsyncStorage.getItem('bl:' + key) : Promise.resolve(null))
    .then((raw) => {
      if (raw) {
        state = { ...initial, ...(JSON.parse(raw) as Partial<T>) };
        emit();
      }
    })
    .catch(() => {});
  const store: Store<T> = {
    get: () => state,
    set(update) {
      const patch = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...patch };
      persist();
      emit();
    },
    reset() {
      state = initial;
      persist();
      emit();
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    use: () => useSyncExternalStore(store.subscribe, store.get, store.get),
    ready,
  };
  return store;
}
