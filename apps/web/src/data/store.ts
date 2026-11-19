/** Change counter: every mutation bumps it and `useQuery` refetches. */
let version = 0;
const listeners = new Set<() => void>();

export function changed(): void {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getVersion(): number {
  return version;
}
