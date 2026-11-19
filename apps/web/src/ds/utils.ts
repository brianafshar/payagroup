import { useId, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export { fmt } from '@/lib/format';

export type Numeric = number | string;

/** className joiner — falsy parts are dropped. */
export function cx(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(' ');
}

/** Coerces numeric-ish props (`"3"`, `3`) with a default. */
export function num(v: Numeric | null | undefined, d: number): number;
export function num(v: Numeric | null | undefined): number | undefined;
export function num(v: Numeric | null | undefined, d?: number): number | undefined {
  if (v === undefined || v === null || v === '') return d;
  const n = Number(v);
  return Number.isNaN(n) ? d : n;
}

/** Stable DOM id with a readable prefix. */
export function useUid(prefix = 'bl'): string {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Local state that also follows its prop: when the parent passes a new value the local
 * copy resets to it (uncontrolled-with-sync, same behaviour as the design prototypes).
 */
export function useSynced<T>(v: T): [T, Dispatch<SetStateAction<T>>] {
  const s = useState<T>(v);
  const prev = useRef(v);
  if (prev.current !== v) {
    prev.current = v;
    if (s[0] !== v) s[1](v);
  }
  return s;
}
