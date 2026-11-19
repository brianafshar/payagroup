/** Global confirmation dialog: `await confirmDialog({...})` resolves true when confirmed (see ConfirmHost). */
export interface ConfirmInput {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** The user types this (e.g. the athlete's name) before the confirm button turns on. */
  typeToConfirm?: string;
  /** Runs before closing; while it runs the button spins, and an error keeps the dialog open. */
  action?: () => Promise<unknown>;
}
export interface ConfirmRequest extends ConfirmInput {
  resolve: (ok: boolean) => void;
}

let current: ConfirmRequest | null = null;
const listeners = new Set<(r: ConfirmRequest | null) => void>();

export function confirmDialog(input: ConfirmInput): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = {
      ...input,
      resolve: (ok) => {
        current = null;
        listeners.forEach((l) => l(null));
        resolve(ok);
      },
    };
    listeners.forEach((l) => l(current));
  });
}

export function subscribeConfirm(l: (r: ConfirmRequest | null) => void): () => void {
  listeners.add(l);
  l(current);
  return () => {
    listeners.delete(l);
  };
}
