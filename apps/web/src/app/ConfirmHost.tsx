import { useEffect, useState } from 'react';
import { faError } from '@/data/api';
import { Modal, TextField } from '@/ds';
import { subscribeConfirm, type ConfirmRequest } from '@/lib/confirm';
import { toast } from '@/lib/toast';

/** Renders the dialog opened by `confirmDialog()` (mounted once in App). */
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeConfirm((r) => (setReq(r), setTyped(''), setBusy(false))), []);
  if (!req) return null;
  const need = req.typeToConfirm?.trim();
  const ok = !need || typed.trim() === need;
  const confirm = async () => {
    if (!ok || busy) return;
    if (req.action) {
      setBusy(true);
      try {
        await req.action();
      } catch (e) {
        setBusy(false);
        toast('انجام نشد', faError(e), 'error');
        return;
      }
    }
    req.resolve(true);
  };
  return (
    <Modal
      title={req.title}
      description={req.description}
      tone={req.destructive ? 'destructive' : 'default'}
      primaryLabel={req.confirmLabel || 'تأیید'}
      secondaryLabel="انصراف"
      primaryDisabled={!ok}
      loading={busy}
      onPrimary={confirm}
      onClose={() => !busy && req.resolve(false)}
    >
      {need ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <TextField label={'برای تأیید، «' + need + '» را بنویسید'} onChange={setTyped} />
        </form>
      ) : null}
    </Modal>
  );
}
