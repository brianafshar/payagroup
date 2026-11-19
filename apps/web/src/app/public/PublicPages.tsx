// Help and privacy (#79): plain pages anyone can open — from the login screens, the panel's help menu
// and the athlete app's profile. Short on purpose.
import type { ReactNode } from 'react';
import { AuthShell } from '@/app/auth';
import { Button } from '@/ds';
import { useSupportEmail } from './usePublicInfo';

const h3 = { margin: '4px 0 0', fontSize: 15, fontWeight: 700 } as const;
const p = { margin: 0, fontSize: 14, lineHeight: '26px', color: 'var(--text-secondary)' } as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h3 style={h3}>{title}</h3>
      {children}
    </section>
  );
}

function Contact() {
  const email = useSupportEmail();
  return email ? (
    <p style={p}>
      {'سؤال یا مشکلی بود؟ به '}
      <a href={'mailto:' + email} dir="ltr">
        {email}
      </a>
      {' ایمیل بزنید.'}
    </p>
  ) : null;
}

function Back() {
  return (
    <Button variant="secondary" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign('/'))}>
      بازگشت
    </Button>
  );
}

export function HelpPage() {
  return (
    <AuthShell title="راهنما" description="شروع کار در چند قدم" width={620}>
      <Section title="مربی‌ها">
        <p style={p}>۱. با ایمیلی که برایتان فرستاده شده وارد پنل شوید.</p>
        <p style={p}>۲. از «ورزشکاران» شاگردها را اضافه کنید؛ لینک دعوت برایشان ایمیل یا کپی می‌شود.</p>
        <p style={p}>۳. از «برنامه‌ها» یک برنامه بسازید و به شاگردها بدهید.</p>
        <p style={p}>۴. پیشرفت را در «تحلیل‌ها» ببینید و در «گفتگو» با شاگردها در ارتباط باشید.</p>
        <p style={p}>داخل پنل، آیکن ؟ بالای صفحه راهنمای قدم‌به‌قدم را دوباره باز می‌کند.</p>
      </Section>
      <Section title="شاگردها">
        <p style={p}>۱. لینک دعوت مربی را باز کنید و رمز بسازید.</p>
        <p style={p}>
          ۲. اپ اندروید را از <a href="/download/">صفحه دانلود</a> بگیرید؛ روی آیفون همان صفحه را در Safari باز کنید و «Add to Home Screen» را بزنید.
        </p>
        <p style={p}>۳. هر روز تمرین امروز را ببینید، ست‌ها را تیک بزنید و چک‌این صبح را ثبت کنید.</p>
        <p style={p}>رمز را فراموش کرده‌اید؟ در صفحه ورود «رمز عبور را فراموش کرده‌اید؟» را بزنید؛ رمز جدید ایمیل می‌شود.</p>
      </Section>
      <Contact />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <a href="/privacy" style={{ fontSize: 14, alignSelf: 'center' }}>
          حریم خصوصی
        </a>
        <Back />
      </div>
    </AuthShell>
  );
}

export function PrivacyPage() {
  return (
    <AuthShell title="حریم خصوصی" description="چه اطلاعاتی نگه می‌داریم و چه کسی آن را می‌بیند" width={620}>
      <Section title="چه چیزی ذخیره می‌شود">
        <p style={p}>اطلاعات حساب (نام، ایمیل، شماره)، برنامه‌ها و تمرین‌های ثبت‌شده، تغذیه، ریکاوری، اندازه‌گیری‌ها، پروفایل سلامت و پیام‌های گفتگو.</p>
      </Section>
      <Section title="چه کسی می‌بیند">
        <p style={p}>داده‌های تمرینی و سلامت هر شاگرد فقط برای خودش و مربی‌اش است. مدیران پلتفرم فقط اطلاعات حساب را می‌بینند، نه سلامت و تمرین.</p>
      </Section>
      <Section title="امنیت و آمار استفاده">
        <p style={p}>
          برای امنیت، ورود از هر دستگاه (نوع دستگاه، زمان و آدرس IP) ثبت می‌شود و هر کس می‌تواند دستگاه‌هایش را ببیند و از آن‌ها خارج شود. برای بهتر کردن سرویس، مدت استفاده از هر
          بخش هم بدون محتوای پیام‌ها و تمرین‌ها ثبت می‌شود.
        </p>
      </Section>
      <Section title="محل نگهداری و حذف">
        <p style={p}>
          داده‌ها روی سرور داخل ایران نگهداری و هر روز پشتیبان‌گیری می‌شوند. با درخواست شما یا مربی‌تان، حساب و همه داده‌ها برای همیشه حذف می‌شود. داده‌ها به هیچ شخص یا شرکت دیگری
          داده نمی‌شود.
        </p>
      </Section>
      <Contact />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <a href="/help" style={{ fontSize: 14, alignSelf: 'center' }}>
          راهنما
        </a>
        <Back />
      </div>
    </AuthShell>
  );
}
