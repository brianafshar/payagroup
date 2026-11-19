// Permanent deletes in the coach panel (#77), behind a confirmation dialog.
import { api } from '@/data/api';
import { confirmDialog } from './confirm';
import { toast } from './toast';
import { faDigits } from './format';

/** Deletes an athlete with all their data and app account; the coach types the name to confirm. */
export async function deleteAthlete(a: { id: string; name: string }): Promise<boolean> {
  const ok = await confirmDialog({
    title: 'حذف ' + a.name,
    description:
      'ورزشکار برای همیشه حذف می‌شود: برنامه‌ها، سابقه تمرین، اندازه‌گیری‌ها، تغذیه، ریکاوری، گفتگو و حساب اپ او. این کار برگشت‌پذیر نیست. اگر فقط می‌خواهید دسترسی‌اش قطع شود، «غیرفعال کردن» را بزنید.',
    confirmLabel: 'حذف برای همیشه',
    destructive: true,
    typeToConfirm: a.name,
    action: () => api.athletes.remove(a.id),
  });
  if (ok) toast('ورزشکار حذف شد', a.name);
  return ok;
}

/** Admin (#102): deletes a coach with their athletes, programs, library, chat, files and accounts. */
export async function deleteCoach(c: { id: string; name: string; athletes?: number }): Promise<boolean> {
  const n = c.athletes || 0;
  const ok = await confirmDialog({
    title: 'حذف ' + c.name,
    description:
      'مربی برای همیشه حذف می‌شود' +
      (n ? ' همراه با ' + faDigits(n) + ' ورزشکارش و همه داده‌های آن‌ها (برنامه، سابقه تمرین، اندازه‌گیری، تغذیه، گفتگو و حساب اپ)' : '') +
      '؛ برنامه‌ها، کتابخانه حرکات، فایل‌ها و حساب مربی هم پاک می‌شود. این کار برگشت‌پذیر نیست. اگر ورزشکاری باید بماند، اول او را به مربی دیگری منتقل کنید.',
    confirmLabel: 'حذف برای همیشه',
    destructive: true,
    typeToConfirm: c.name,
    action: () => api.coaches.remove(c.id),
  });
  if (ok) toast('مربی حذف شد', c.name);
  return ok;
}

/** Deletes a program; logged workouts stay in the athletes' history. */
export async function deleteProgram(p: { id: string; name: string; template: boolean }): Promise<boolean> {
  const ok = await confirmDialog({
    title: 'حذف «' + p.name + '»',
    description: p.template
      ? 'قالب برای همیشه حذف می‌شود. نسخه‌هایی که قبلاً به ورزشکاران داده شده و سابقه تمرین‌ها سر جایشان می‌مانند. برای کنار گذاشتن بدون حذف، «آرشیو» را بزنید.'
      : 'این برنامه ورزشکار برای همیشه حذف می‌شود و اگر برنامه فعلی اوست، تا برنامه جدیدی بدهید برنامه‌ای ندارد. سابقه تمرین‌های ثبت‌شده می‌ماند.',
    confirmLabel: 'حذف برای همیشه',
    destructive: true,
    action: () => api.programs.remove(p.id),
  });
  if (ok) toast('برنامه حذف شد', p.name);
  return ok;
}
