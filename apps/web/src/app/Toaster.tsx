import { useEffect, useState } from 'react';
import { dismissToast, getToasts, subscribeToasts, type ToastItem } from '@/lib/toast';

/** Renders the global toast stack (fed by `toast()` from anywhere in the app). */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(getToasts);
  useEffect(() => subscribeToasts(setItems), []);
  return (
    <div className="bl-toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'bl-apptoast' + (t.tone === 'error' ? ' is-error' : '')} role={t.tone === 'error' ? 'alert' : 'status'} onClick={() => dismissToast(t.id)}>
          <span className="bl-apptoast-ic" aria-hidden="true">
            {t.tone === 'error' ? '!' : '✓'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="bl-apptoast-title">{t.title}</div>
            {t.desc ? <div className="bl-apptoast-desc">{t.desc}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
