/** The coach's getting-started guide (#84): opened from the top bar's help, and once automatically. */
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openGuide(): void {
  open = true;
  emit();
}
export function closeGuide(): void {
  open = false;
  emit();
}
export function useGuideOpen(): boolean {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => open,
    () => false,
  );
}

const key = (userId: string) => 'indow-guide-seen:' + userId;
/** Shown once per coach (per browser); the help icon opens it again any time. */
export function guideSeen(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === '1';
  } catch {
    return true; // storage blocked: don't pop up on every page
  }
}
export function markGuideSeen(userId: string): void {
  try {
    localStorage.setItem(key(userId), '1');
  } catch {
    /* ignore */
  }
}
