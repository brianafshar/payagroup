// «دانلود PDF» and «ارسال برای شاگرد» for the athlete's weekly program (training, nutrition, supplements,
// recovery). Sending attaches the PDF to a message in the athlete's chat.
import { useState } from 'react';
import { Button } from '@/ds';
import { faError, remote } from '@/data/api';
import type { ID } from '@/data/types';
import { toast } from '@/lib/toast';

export function ProgramPdfButtons({ athleteId, name }: { athleteId: ID; name: string }) {
  const [busy, setBusy] = useState<'' | 'get' | 'send'>('');
  const download = async () => {
    setBusy('get');
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
      setBusy('');
    }
  };
  const send = async () => {
    setBusy('send');
    try {
      await remote.sendProgramPdf(athleteId);
      toast('برنامه برای ' + name + ' ارسال شد', 'فایل PDF در گفتگو با شاگرد قرار گرفت.');
    } catch (e) {
      toast('ارسال نشد', faError(e), 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <Button variant="secondary" icon="download" loading={busy === 'get'} disabled={!!busy} onClick={download}>
        دانلود PDF
      </Button>
      <Button variant="secondary" icon="send" loading={busy === 'send'} disabled={!!busy} onClick={send}>
        ارسال برای شاگرد
      </Button>
    </>
  );
}
