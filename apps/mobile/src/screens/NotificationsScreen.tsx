// In-app notifications (live): what the coach said or changed and today's check-in reminder. It's the same
// news push would bring, so the app is complete without push (Expo Go, web, regions where Expo is blocked).
import { faDigits } from '@baseline/core';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { enableWebPush, webPushState, type WebPushState } from '../api/webpush';
import { inbox, loadInbox, markInboxRead } from '../data/live';
import { useNav, type Nav } from '../navigation/types';
import { Button, EmptyState, Icon, ListGroup, ListRow, MobileHeader, Screen, Surface, toast, Txt, type IconRef } from '../ui';

type Item = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function when(iso: string): string {
  const d = new Date(iso);
  const hm = faDigits(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'امروز ' + hm;
  if (days === 1) return 'دیروز ' + hm;
  return d.toLocaleDateString('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
}

/** Title, detail, icon and where tapping goes, per notification kind. */
function describe(x: Item, nav: Nav): { icon: IconRef; title: string; sub?: string; go: () => void } {
  switch (x.kind) {
    case 'message':
      return {
        icon: 'chat',
        title: (x.value > 1 ? faDigits(x.value) + ' پیام جدید از ' : 'پیام جدید از ') + x.coachName,
        sub: x.text,
        go: () => nav.navigate('Chat'),
      };
    case 'feedback':
      return {
        icon: 'chat',
        title: 'بازخورد مربی' + (x.title ? ' روی «' + x.title + '»' : ''),
        sub: x.text,
        go: () => nav.navigate('Session', { id: x.workoutId }),
      };
    case 'program':
      return { icon: 'dumbbell', title: 'مربی برنامه تمرینت را به‌روز کرد', sub: x.title, go: () => nav.navigate('Tabs', { screen: 'Workout' }) };
    case 'program.assigned':
      return { icon: 'dumbbell', title: 'برنامه تمرینی جدید', sub: x.title, go: () => nav.navigate('Tabs', { screen: 'Workout' }) };
    case 'nutrition':
      return { icon: 'utensils', title: 'برنامه غذایی‌ات به‌روز شد', go: () => nav.navigate('Tabs', { screen: 'Nutrition' }) };
    case 'recovery_plan':
      return { icon: 'moon', title: 'برنامه ریکاوری‌ات به‌روز شد', go: () => nav.navigate('Tabs', { screen: 'Recovery' }) };
    case 'checkin':
      return { icon: 'bed', title: 'چک‌این امروز مانده', sub: 'خواب، انرژی و کوفتگی امروز را ثبت کن', go: () => nav.navigate('Tabs', { screen: 'Recovery' }) };
    default:
      return { icon: 'bell', title: 'اعلان', go: () => {} };
  }
}

/** Web app only: turn on notifications for this phone / browser, or how to (iPhone: home screen first). */
function WebPushCard() {
  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void webPushState().then(setState);
  }, []);
  if (!state || state === 'on' || state === 'off' || state === 'unsupported') return null;
  const text: Record<'install-first' | 'denied' | 'ask', [string, string]> = {
    'install-first': [
      'اعلان‌ها در آیفون',
      'برای اینکه پیام‌های مربی را به‌صورت اعلان بگیری، اول indow را به صفحه اصلی اضافه کن: در Safari دکمه اشتراک‌گذاری (مربع با فلش رو به بالا) ← «Add to Home Screen». بعد از آیکون صفحه اصلی بازش کن و اینجا اعلان‌ها را روشن کن. (iOS 16.4 به بعد)',
    ],
    denied: ['اعلان‌ها بسته شده', 'اجازه اعلان برای این سایت رد شده است. از تنظیمات مرورگر یا گوشی (Settings ← Notifications) دوباره اجازه بده.'],
    ask: ['اعلان‌ها را روشن کن', 'پیام‌های مربی و بازخورد تمرین‌ها روی گوشی‌ات اعلان می‌شوند، حتی وقتی اپ بسته است.'],
  };
  const [title, body] = text[state];
  return (
    <Surface padding={14} gap={8}>
      <Txt size={15} lh={22} w={700}>
        <Icon name="bell" size={16} /> {title}
      </Txt>
      <Txt size={13} lh={21} color="text-secondary">
        {body}
      </Txt>
      {state === 'ask' ? (
        <Button
          variant="primary"
          icon="bell"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            const next = await enableWebPush().catch(() => null);
            if (!next || next === 'ask') toast('اعلان فعال نشد', 'اتصال اینترنت را بررسی کن و دوباره امتحان کن.', 'error');
            setState(next || 'ask');
            setBusy(false);
          }}
        >
          فعال کردن اعلان‌ها
        </Button>
      ) : null}
    </Surface>
  );
}

export function NotificationsScreen() {
  const nav = useNav();
  const { items, loaded } = inbox.use();
  useEffect(() => {
    // Refresh, then everything shown counts as seen.
    void loadInbox()
      .catch(() => {})
      .then(markInboxRead);
  }, []);
  return (
    <Screen gap={12} header={<MobileHeader title="اعلان‌ها" back="خانه" onBack={() => nav.goBack()} />}>
      {Platform.OS === 'web' ? <WebPushCard /> : null}
      {loaded && !items.length ? <EmptyState icon="bell" title="اعلان تازه‌ای نداری" description="پیام‌های مربی و تغییرات برنامه‌ات اینجا می‌آیند." /> : null}
      {items.length ? (
        <ListGroup>
          {items.map((x, i) => {
            const d = describe(x, nav);
            return (
              <ListRow
                key={x.kind + i}
                icon={d.icon}
                iconColor={x.unread ? 'brand-primary' : undefined}
                title={d.title}
                subtitle={[d.sub, when(x.at)].filter(Boolean).join(' · ')}
                onPress={d.go}
              />
            );
          })}
        </ListGroup>
      ) : null}
    </Screen>
  );
}
