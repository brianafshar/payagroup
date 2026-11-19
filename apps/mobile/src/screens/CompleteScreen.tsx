// Design: project/M39 Athlete Workout Complete.dc.html
import { faDigits, faNumber, faTime } from '@baseline/core';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LIVE } from '../api/config';
import { chat } from '../data/athlete';
import { sendChat } from '../data/live';
import { finishLive, SEED, SESSION, stats, workout, type CardioInput } from '../data/workout';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { Button, Footer, Icon, PRCard, ScaleInput, Screen, Stat, TextField, toast, Txt } from '../ui';

export function CompleteScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const w = workout.use();
  const st = stats(w);
  // Live: the server's PR list from finishing the workout (falls back to the sets flagged while logging).
  const prs = LIVE && w.summaryPrs ? w.summaryPrs : st.prs;
  const [rpe, setRpe] = useState<number | null>(w.rpe);
  const [msg, setMsg] = useState('');
  // Cardio details (optional): feed the coach's running analytics — distance, pace, HR zones, cadence.
  const [cardioOpen, setCardioOpen] = useState(false);
  const [cardio, setCardio] = useState<Record<keyof CardioInput, string>>({
    distanceKm: '',
    durationMin: '',
    avgHr: '',
    maxHr: '',
    cadenceSpm: '',
    elevationM: '',
    aerobicTe: '',
    anaerobicTe: '',
    ltHr: '',
    ltPace: '',
  });
  const num = (v: string) => {
    const n = Number(v.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٫,]/g, '.'));
    return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
  };
  // «۵:۰۵» or «5.1» → minutes per km
  const mmssToMin = (v: string) => {
    const t = v.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
    const m = /^(\d{1,2})[:٫.,](\d{2})$/.exec(t);
    if (m && t.includes(':')) return +m[1] + +m[2] / 60;
    return num(v);
  };
  const done = () => {
    workout.set({ rpe });
    if (LIVE) {
      const c: CardioInput = {
        distanceKm: num(cardio.distanceKm),
        durationMin: num(cardio.durationMin) && Math.round(num(cardio.durationMin) as number),
        avgHr: num(cardio.avgHr) && Math.round(num(cardio.avgHr) as number),
        maxHr: num(cardio.maxHr) && Math.round(num(cardio.maxHr) as number),
        cadenceSpm: num(cardio.cadenceSpm) && Math.round(num(cardio.cadenceSpm) as number),
        elevationM: num(cardio.elevationM) && Math.round(num(cardio.elevationM) as number),
        aerobicTe: num(cardio.aerobicTe) != null ? Math.min(5, num(cardio.aerobicTe) as number) : null,
        anaerobicTe: num(cardio.anaerobicTe) != null ? Math.min(5, num(cardio.anaerobicTe) as number) : null,
        ltHr: num(cardio.ltHr) && Math.round(num(cardio.ltHr) as number),
        ltPace: mmssToMin(cardio.ltPace),
      };
      void finishLive(rpe, msg.trim(), c);
      if (msg.trim()) void sendChat(msg.trim(), { ref: SESSION.title });
    } else if (msg.trim())
      chat.set((s) => ({
        msgs: [
          ...s.msgs,
          ...(s.msgs.some((x) => 'd' in x && x.d === 'امروز') ? [] : [{ d: 'امروز' }]),
          { from: 'a' as const, t: msg.trim(), at: faTime(new Date()), ref: SESSION.title },
        ],
      }));
    nav.navigate('Tabs', { screen: 'Home' });
    toast('تمرین ثبت شد', msg.trim() ? 'پیامت برای مربی ارسال شد.' : 'مربی خلاصه تمرینت را می‌بیند.');
  };
  return (
    <Screen
      surface
      gap={18}
      contentStyle={{ paddingTop: insets.top + 40 }}
      footer={
        <Footer gap={8}>
          <Button size="lg" fullWidth onPress={done}>
            ثبت و بازگشت به خانه
          </Button>
          {LIVE ? null : (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              icon="refresh"
              onPress={() => {
                workout.set(SEED);
                nav.navigate('Tabs', { screen: 'Workout' });
              }}
            >
              شروع دوباره تمرین (نمونه)
            </Button>
          )}
        </Footer>
      }
    >
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c['brand-primary'], alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={32} color="#1a1a1a" />
        </View>
        <Txt size={24} lh={36} w={700} align="center" accessibilityRole="header">
          تمرین تمام شد
        </Txt>
        <Txt size={14} lh={22} color="text-secondary" align="center">
          {SESSION.title + ' · هفته ' + faDigits(SESSION.week) + ' · روز ' + faDigits(SESSION.day)}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat center label="ست" value={faDigits(st.done) + '/' + faDigits(st.total)} />
        <Stat center label="حجم" value={faDigits((st.vol / 1000).toFixed(1), true) + ' t'} />
        <Stat center label="رکورد جدید" value={faDigits(prs.length)} />
      </View>
      {prs.slice(0, 2).map((p, i) => (
        <PRCard
          key={i}
          exercise={p.ex}
          type={'حداکثر ' + faDigits(p.r || 8) + ' تکرار · امروز'}
          value={faNumber(p.w)}
          unit="kg"
          previous={p.prev ? faNumber(p.prev) + ' kg' : undefined}
          delta={p.prev ? +(((p.w - p.prev) / p.prev) * 100).toFixed(1) : undefined}
          isNew
        />
      ))}
      <ScaleInput label="تمرین چقدر سخت بود؟" value={rpe} onChange={setRpe} lowLabel="خیلی راحت" highLabel="حداکثر توان" />
      <Button variant="secondary" icon={cardioOpen ? 'chevron-up' : 'activity'} onPress={() => setCardioOpen((o) => !o)}>
        {cardioOpen ? 'بستن جزئیات دویدن / هوازی' : 'افزودن جزئیات دویدن / هوازی'}
      </Button>
      {cardioOpen ? (
        <View style={{ gap: 12 }}>
          <Txt size={12} lh={18} color="text-muted">
            اختیاری · از ساعت ورزشی یا اپ دویدن وارد کن تا مربی مسافت، پیس، نواحی ضربان و کادنس را ببیند. Training Effect و آستانه لاکتات را ساعت (مثلاً گارمین) بعد از تمرین نشان
            می‌دهد.
          </Txt>
          {(
            [
              ['distanceKm', 'مسافت', 'کیلومتر', '۵'],
              ['durationMin', 'مدت', 'دقیقه', '۳۰'],
              ['avgHr', 'میانگین ضربان', 'bpm', '۱۵۰'],
              ['maxHr', 'حداکثر ضربان', 'bpm', '۱۸۰'],
              ['cadenceSpm', 'کادنس', 'قدم در دقیقه', '۱۷۰'],
              ['elevationM', 'صعود', 'متر', '۴۰'],
              ['aerobicTe', 'Training Effect هوازی', 'از ۵', '۳٫۲'],
              ['anaerobicTe', 'Training Effect بی‌هوازی', 'از ۵', '۱٫۴'],
              ['ltHr', 'ضربان آستانه لاکتات', 'bpm', '۱۶۵'],
              ['ltPace', 'سرعت آستانه لاکتات', 'دقیقه/کیلومتر', '۵:۰۵'],
            ] as const
          ).map(([k, label, suffix, ph]) => (
            <TextField key={k} label={label} suffix={suffix} placeholder={ph} optional type="decimal" value={cardio[k]} onChange={(v) => setCardio((s) => ({ ...s, [k]: v }))} />
          ))}
        </View>
      ) : null}
      <TextField label="پیام به مربی" optional placeholder="مثلاً شانه چپ امروز مشکلی نداشت" value={msg} onChange={setMsg} multiline />
    </Screen>
  );
}
