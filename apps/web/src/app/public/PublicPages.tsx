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
      <Section title="ورود">
        <p style={p}>با نام کاربری و رمزی که سرمربی یا مدیر سیستم به شما داده وارد شوید. تیک «من را به خاطر بسپار» نام کاربری را برای دفعه بعد نگه می‌دارد و شما را وارد نگه می‌دارد.</p>
        <p style={p}>نام کاربری و رمز را هر زمان از «تنظیمات ← امنیت» عوض کنید. اگر رمز را فراموش کردید، از سرمربی بخواهید رمز جدید برایتان بگذارد.</p>
      </Section>
      <Section title="مربی‌ها">
        <p style={p}>۱. از «ورزشکاران» شاگرد را با نام و شماره موبایل اضافه کنید؛ همان لحظه یک پیامک «حساب شما ساخته شد» برایش می‌رود.</p>
        <p style={p}>۲. از «کتابخانه» حرکت‌های مشترک باشگاه را ببینید یا حرکت جدید بسازید؛ کتابخانه و قالب‌ها برای همه مربی‌های باشگاه مشترک است.</p>
        <p style={p}>۳. در «برنامه‌ها» برنامه بسازید و به یک یا چند شاگرد بدهید. هر بار برنامه‌ای به شاگرد اختصاص پیدا کند، پیامکی با لینک دانلود PDF برنامه برایش می‌رود.</p>
        <p style={p}>۴. از صفحه برنامه می‌توانید خروجی PDF بگیرید یا هر زمان دوباره پیامک بفرستید؛ نام هر حرکت در PDF به صفحه آموزش آن در سایت لینک است.</p>
        <p style={p}>۵. تغذیه، مکمل و ریکاوری هر شاگرد را از بخش‌های خودشان تنظیم کنید و پیشرفت را در «تحلیل‌ها» ببینید.</p>
      </Section>
      <Section title="سرمربی">
        <p style={p}>سرمربی از «تیم» مربی‌های باشگاه را با نام کاربری و رمز می‌سازد، فعال یا غیرفعال می‌کند و شاگردهای همه را می‌بیند.</p>
      </Section>
      <Section title="شاگردها">
        <p style={p}>شاگرد اپ یا حساب جداگانه ندارد. پیامک‌ها را روی همان شماره‌ای که مربی ثبت کرده دریافت می‌کند و برنامه را از لینک داخل پیامک دانلود می‌کند. برای تغییر شماره یا مشکل در دریافت پیامک با مربی‌تان صحبت کنید.</p>
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
        <p style={p}>نام و شماره موبایل شاگردها، برنامه‌های تمرینی، تغذیه، مکمل، ریکاوری، اندازه‌گیری‌ها و پروفایل سلامت. نام کاربری و رمز (به‌صورت رمزنگاری‌شده) برای ورود مربی‌ها.</p>
      </Section>
      <Section title="چه کسی می‌بیند">
        <p style={p}>اطلاعات هر شاگرد فقط برای مربی‌های همان باشگاه (سرمربی و مربی‌ها) قابل مشاهده است. شماره موبایل فقط برای ارسال پیامک حساب و برنامه استفاده می‌شود.</p>
      </Section>
      <Section title="امنیت و آمار استفاده">
        <p style={p}>
          برای امنیت، ورود از هر دستگاه (نوع دستگاه، زمان و آدرس IP) ثبت می‌شود و هر کس می‌تواند دستگاه‌هایش را ببیند و از آن‌ها خارج شود. برای بهتر کردن سرویس، مدت استفاده از هر
          بخش هم بدون محتوای پیام‌ها و تمرین‌ها ثبت می‌شود.
        </p>
      </Section>
      <Section title="محل نگهداری و پیامک">
        <p style={p}>داده‌ها روی همین رایانه‌ی باشگاه نگهداری می‌شود. فقط هنگام ارسال پیامک، نام، شماره و لینک برنامه به سرویس پیامک (کاوه‌نگار) و فایل PDF به سایت باشگاه داده می‌شود؛ هیچ داده دیگری به شخص یا شرکتی داده نمی‌شود.</p>
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
