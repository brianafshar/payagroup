// Getting started for coaches (#84): a few short steps — what to do, what it gives you — each with a
// button to that part of the panel and a ✓ once it's done. Opens by itself the first time a coach
// signs in; the ? icon in the top bar opens it again.
import { useEffect, useState } from 'react';
import { api } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { useSessionUser } from '@/data/session';
import { Button, Icon, IconButton, type IconName } from '@/ds';
import { faDigits } from '@/lib/format';
import { closeGuide, guideSeen, markGuideSeen, openGuide, useGuideOpen } from '@/lib/guide';
import { go } from '@/lib/nav';

interface Step {
  icon: IconName;
  title: string;
  what: string;
  gain: string;
  cta?: string;
  to?: string;
  done?: boolean;
}

export function CoachGuide() {
  const user = useSessionUser();
  const isCoach = user?.role === 'coach';
  const open = useGuideOpen();
  // First visit: open once.
  useEffect(() => {
    if (isCoach && user && !guideSeen(String(user.id))) {
      markGuideSeen(String(user.id));
      openGuide();
    }
  }, [isCoach, user]);
  return isCoach && open ? <GuideDialog /> : null;
}

function GuideDialog() {
  const [i, setI] = useState(0);
  const athletes = useQuery('guide:athletes', () => api.athletes.list());
  const programs = useQuery('guide:programs', () => api.programs.list());

  const a = athletes.data || [];
  const p = programs.data || [];
  const steps: Step[] = [
    {
      icon: 'zap',
      title: 'به پنل PAYA Group خوش آمدید',
      what: 'شاگردها، برنامه‌ها، کتابخانه حرکات، تغذیه و پیگیری پیشرفت — همه در یک جا.',
      gain: 'شاگردها اپ ندارند؛ حساب و برنامه‌شان با پیامک و لینک دانلود به دستشان می‌رسد.',
    },
    {
      icon: 'users',
      title: 'شاگردها را اضافه کنید',
      what: 'نام و شماره موبایل شاگرد را وارد کنید. شماره اجباری است چون پیامک روی آن می‌رود.',
      gain: 'حساب شاگرد همان لحظه فعال می‌شود و پیامک «حساب شما ساخته شد» برایش می‌رود.',
      cta: 'افزودن شاگرد',
      to: 'coach:create-athlete',
      done: a.length > 0,
    },
    {
      icon: 'library',
      title: 'کتابخانه حرکات',
      what: 'حرکت‌های آماده با تصویر در کتابخانه است و بین همه مربی‌های باشگاه مشترک است؛ حرکت جدید هم می‌توانید اضافه کنید.',
      gain: 'در PDF برنامه، نام هر حرکت به صفحه آموزش آن در سایت لینک می‌شود.',
      cta: 'کتابخانه',
      to: 'coach:library',
    },
    {
      icon: 'clipboard',
      title: 'برنامه بسازید و اختصاص دهید',
      what: 'در برنامه‌ساز روزها و حرکت‌ها را بچینید، بعد به یک یا چند شاگرد بدهید؛ برای هر شاگرد جداگانه هم می‌شود تغییرش داد.',
      gain: 'به محض اختصاص برنامه، پیامکی با لینک دانلود PDF برای شاگرد می‌رود. خروجی PDF و ارسال دوباره پیامک از صفحه برنامه هم هست.',
      cta: 'ساخت برنامه',
      to: 'coach:create-program',
      done: p.some((x) => x.kind !== 'template' || (x as { assignedCount?: number }).assignedCount),
    },
    {
      icon: 'utensils',
      title: 'تغذیه، مکمل و ریکاوری',
      what: 'وعده‌ها، کالری، مکمل‌ها و برنامه خواب و ریکاوری هر شاگرد را تنظیم کنید.',
      gain: 'همه‌چیز در پرونده شاگرد کنار برنامه تمرینی‌اش جمع می‌شود.',
      cta: 'برنامه تغذیه',
      to: 'coach:nutrition',
    },
    {
      icon: 'progress',
      title: 'پیگیری و تیم',
      what: 'در «تحلیل‌ها» روند شاگردها را ببینید. اگر سرمربی هستید، از «تیم» مربی‌های باشگاه را با نام کاربری و رمز بسازید.',
      gain: 'نام کاربری و رمز خودتان را هم از «تنظیمات ← امنیت» عوض کنید.',
      cta: 'داشبورد',
      to: 'coach:dashboard',
    },
  ];
  const s = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  const leave = (to?: string) => {
    closeGuide();
    if (to) go(to);
  };
  return (
    <div className="bl-layer" style={{ zIndex: 90 }}>
      <div className="bl-scrim" aria-hidden="true" onClick={() => leave()} />
      <div className="bl-modal bl-modal-md" role="dialog" aria-modal="true" aria-labelledby="guide-title" style={{ gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px 0' }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>{'راهنمای شروع · قدم ' + faDigits(i + 1) + ' از ' + faDigits(steps.length)}</span>
          <IconButton icon="x" label="بستن راهنما" size="sm" onClick={() => leave()} />
        </div>
        <div style={{ padding: '8px 20px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--brand-primary-subtle)',
                color: 'var(--brand-primary-text)',
                flex: 'none',
              }}
            >
              <Icon name={s.icon} size={22} />
            </span>
            <h2 id="guide-title" style={{ margin: 0, fontSize: 18, lineHeight: '28px', fontWeight: 700, flex: 1 }}>
              {s.title}
            </h2>
            {s.done ? (
              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
                <Icon name="check-circle" size={16} /> انجام شده
              </span>
            ) : null}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: '24px' }}>{s.what}</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: '22px', color: 'var(--text-secondary)', display: 'flex', gap: 6 }}>
            <Icon name="trend-up" size={16} />
            <span>{s.gain}</span>
          </p>
          {/* Every step at a glance, with ✓ for what's done. */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '6px 0' }} aria-hidden="true">
            {steps.map((x, k) => (
              <button
                key={k}
                type="button"
                onClick={() => setI(k)}
                title={x.title}
                style={{
                  width: k === i ? 22 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  background: k === i ? 'var(--brand-primary)' : x.done ? 'var(--success)' : 'var(--border)',
                  transition: 'width .15s',
                }}
              />
            ))}
          </div>
        </div>
        <div className="bl-modal-foot" style={{ flexWrap: 'wrap' }}>
          {i > 0 ? (
            <Button variant="ghost" onClick={() => setI(i - 1)}>
              قبلی
            </Button>
          ) : null}
          <span style={{ flex: 1 }} />
          {s.to ? (
            <Button variant="secondary" onClick={() => leave(s.to)}>
              {s.cta}
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => (last ? leave() : setI(i + 1))}>
            {last ? 'شروع کنیم' : i === 0 ? 'بزن بریم' : 'بعدی'}
          </Button>
        </div>
      </div>
    </div>
  );
}
