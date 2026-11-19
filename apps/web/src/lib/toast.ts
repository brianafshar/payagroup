/** Tiny global toast store — every action confirmation goes through `toast()`. */
export type ToastTone = 'success' | 'error' | 'info' | 'warning';
export interface ToastInput {
  title: string;
  desc?: string;
  tone?: ToastTone;
}
export interface ToastItem extends ToastInput {
  id: number;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const DURATION = 3200;

function emit(): void {
  listeners.forEach((l) => l(items));
}

export function toast(title: string, desc?: string, tone: ToastTone = 'success'): void {
  // Same title already visible → don't stack duplicates (matches the prototype).
  if (items.some((t) => t.title === title)) return;
  const item: ToastItem = { id: nextId++, title, desc, tone };
  items = [...items, item];
  emit();
  setTimeout(() => dismissToast(item.id), DURATION);
}

export function dismissToast(id: number): void {
  const next = items.filter((t) => t.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getToasts(): ToastItem[] {
  return items;
}
