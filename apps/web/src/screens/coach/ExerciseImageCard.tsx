// Exercise picture (#48): the library illustration by default; the coach can upload their own
// (it becomes the thumbnail in the library, programs and the athlete app) and go back to the default.
import { useRef, useState } from 'react';
import { Button, Card } from '@/ds';
import { api, faError } from '@/data/api';
import { illustrationNote, LIBRARY_CREDIT } from '@/data/exercises';
import type { Exercise } from '@/data/types';
import { toast } from '@/lib/toast';

export function ExerciseImageCard({ ex }: { ex: Exercise }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\//.test(f.type)) return toast('فرمت پشتیبانی نمی‌شود', 'یک تصویر JPG، PNG یا WebP انتخاب کنید.', 'error');
    if (f.size > 20 * 1024 * 1024) return toast('حجم فایل زیاد است', 'حداکثر ۲۰ مگابایت', 'error');
    const fd = new FormData();
    fd.append('image', f);
    setBusy(true);
    try {
      await api.exercises.update(ex.id, fd);
      toast('تصویر ذخیره شد', 'در کتابخانه، برنامه‌ها و اپ ورزشکار نمایش داده می‌شود.');
    } catch (e) {
      toast('بارگذاری نشد', faError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.exercises.update(ex.id, { removeImage: true } as Partial<Exercise>);
      toast(ex.hasOwnImage ? 'تصویر پیش‌فرض برگشت' : 'تصویر حذف شد');
    } catch (e) {
      toast('انجام نشد', faError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  // Library v2: start and end pose side by side; the coach's own picture is shown alone.
  const frames: Array<[string | undefined, string]> =
    !ex.hasOwnImage && ex.imageStartSrc && ex.imageSrc
      ? [
          [ex.imageStartSrc, 'شروع'],
          [ex.imageSrc, 'پایان'],
        ]
      : [[ex.imageSrc, '']];
  const note = ex.hasOwnImage || !ex.imageSrc ? '' : illustrationNote(ex.illustrationMatch, ex.badge);
  return (
    <Card title="تصویر حرکت" subtitle={ex.hasOwnImage ? 'تصویر خودتان' : ex.imageSrc ? 'تصویر پیش‌فرض کتابخانه' : 'بدون تصویر'}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {frames.map(([src, label]) => (
              <figure key={label || 'one'} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <div
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-sunken)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                  }}
                >
                  {src ? <img src={src} alt={ex.name + (label ? ' · ' + label : '')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : 'بدون تصویر'}
                </div>
                {label ? <figcaption style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</figcaption> : null}
              </figure>
            ))}
          </div>
          {note ? <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 328 }}>{note}</span> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>تصویر بندانگشتی حرکت در کتابخانه، برنامه‌ها و اپ ورزشکار. JPG، PNG یا WebP تا ۲۰ مگابایت.</span>
          {ex.imageSrc && !ex.hasOwnImage && ex.imageSrc.includes('/illustrations/') ? (
            <a href={LIBRARY_CREDIT.href} target="_blank" rel="noreferrer" dir="ltr" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {LIBRARY_CREDIT.text}
            </a>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input ref={input} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
            <Button variant="secondary" icon="upload" loading={busy} onClick={() => input.current?.click()}>
              {ex.imageSrc ? 'تغییر تصویر' : 'بارگذاری تصویر'}
            </Button>
            {ex.imageSrc ? (
              <Button variant="ghost" icon={ex.hasOwnImage ? 'undo' : 'trash'} disabled={busy} onClick={() => void remove()}>
                {ex.hasOwnImage ? 'بازگشت به تصویر پیش‌فرض' : 'حذف تصویر'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
