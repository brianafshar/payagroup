// «دانلود PDF» and «ارسال پیامکی» for the athlete's weekly program (training, nutrition, supplements,
// recovery). Sending SMSes the athlete a link to the PDF on the gym site; the contact is saved once.
import { useState } from 'react';
import { Button, Modal, TextField } from '@/ds';
import { faError, remote } from '@/data/api';
import type { ID } from '@/data/types';
import { toast } from '@/lib/toast';

const PHONE = /^(09|۰۹)[0-9۰-۹]{9}$/;

function SmsModal({ athleteId, name, phone, onClose }: { athleteId: ID; name: string; phone: string; onClose: () => void }) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await remote.sendProgramSms({ athlete: Number(athleteId), name: n.trim(), phone: p.replace(/\s/g, '') });
      toast('پیامک ارسال شد', 'لینک دانلود برنامه برای ' + n.trim() + ' فرستاده شد.');
      onClose();
    } catch (e) {
      toast('ارسال نشد', faError(e), 'error');
      setBusy(false);
    }
  };
  return (
    <Modal
      title="ارسال برنامه با پیامک"
      description="لینک دانلود PDF برای شماره زیر پیامک می‌شود. نام و شماره برای دفعات بعد ذخیره می‌شود."
      primaryLabel="ارسال پیامک"
      primaryDisabled={!n.trim() || !PHONE.test(p.replace(/\s/g, ''))}
      loading={busy}
      onPrimary={send}
      secondaryLabel="انصراف"
      onSecondary={onClose}
      onClose={onClose}
    >
      <TextField label="نام ورزشکار" value={name} onChange={setN} />
      <TextField label="شماره موبایل" dir="ltr" inputMode="numeric" placeholder="09xxxxxxxxx" value={phone} onChange={setP} />
    </Modal>
  );
}

export function ProgramPdfButtons({ athleteId, name, phone = '' }: { athleteId: ID; name: string; phone?: string }) {
  const [busy, setBusy] = useState(false);
  const [sms, setSms] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await remote.programPdf(athleteId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `برنامه ${name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast('PDF ساخته نشد', faError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="secondary" icon="download" loading={busy} disabled={busy} onClick={download}>
        دانلود PDF
      </Button>
      <Button variant="secondary" icon="send" disabled={busy} onClick={() => setSms(true)}>
        ارسال پیامکی
      </Button>
      {sms ? <SmsModal athleteId={athleteId} name={name} phone={phone} onClose={() => setSms(false)} /> : null}
    </>
  );
}
