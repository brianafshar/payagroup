// Design: project/M41 Athlete Recovery.dc.html
import { View } from 'react-native';
import { faDigits } from '@baseline/core';
import { LIVE } from '../api/config';
import { recovery, type RecoveryKey } from '../data/athlete';
import { saveRecovery } from '../data/live';
import { todayLabel } from '../lib';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { Button, Footer, Icon, MobileHeader, NumberStepper, ScaleInput, Screen, Surface, Switch, TextField, toast, Txt, ValueDisplay } from '../ui';

/** Check key in the coach's plan → the scale shown here. */
const PLAN_KEY: Record<RecoveryKey, string> = { q: 'quality', e: 'energy', t: 'stress', o: 'soreness', f: 'fatigue' };
const WATCH: Array<[string, string, string, string]> = [
  ['rhr', 'ضربان استراحت', 'bpm', '۵۸'],
  ['hrv', 'HRV شبانه', 'ms', '۶۰'],
  ['sleep_score', 'امتیاز خواب', 'از ۱۰۰', '۸۰'],
  ['body_battery', 'Body Battery صبح', 'از ۱۰۰', '۷۰'],
  ['spo2', 'اکسیژن خون', '٪', '۹۷'],
  ['steps', 'قدم‌های دیروز', 'قدم', '۸۰۰۰'],
];
const DAY_FA: Record<string, string> = { sat: 'شنبه', sun: 'یکشنبه', mon: 'دوشنبه', tue: 'سه‌شنبه', wed: 'چهارشنبه', thu: 'پنجشنبه', fri: 'جمعه' };
const fa = (n: number) => faDigits(String(n)).replace('.', '٫');

const SCALES: Array<[RecoveryKey, string, string, string]> = [
  ['q', 'کیفیت خواب', 'خیلی بد', 'عالی'],
  ['e', 'انرژی', 'بی‌رمق', 'پرانرژی'],
  ['t', 'استرس', 'هیچ', 'خیلی زیاد'],
  ['o', 'کوفتگی عضلات', 'هیچ', 'شدید'],
  ['f', 'خستگی', 'هیچ', 'شدید'],
];

export function RecoveryScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const { sleep, v, saved, plan, watch, extra } = recovery.use();
  // Live: only what the coach asks for; without a plan (design preview) everything built in.
  const asks = (k: string) => !plan || plan.checks.includes(k);
  const watchKeys = WATCH.filter(([k]) => plan?.checks.includes(k));
  const custom = plan?.customFields || [];
  const setExtra = (k: string, x: number | boolean | string | null) => recovery.set((st) => ({ extra: { ...st.extra, [k]: x } }));
  const save = async () => {
    if (!(await saveRecovery())) return;
    // High soreness is flagged to the coach (see C30 Recovery analytics).
    toast('چک‌این ثبت شد', (v.o ?? 0) >= 8 ? 'کوفتگی زیاد گزارش شد؛ مربی مطلع می‌شود.' : 'مربی وضعیت امروزت را می‌بیند.');
  };
  return (
    <Screen
      gap={14}
      header={<MobileHeader large eyebrow={todayLabel()} title="ریکاوری" actions={[{ icon: 'chat', label: 'گفتگو با مربی', onPress: () => nav.navigate('Chat') }]} />}
      footer={
        <Footer>
          <Button size="lg" fullWidth onPress={save}>
            {saved ? 'به‌روزرسانی چک‌این' : 'ثبت چک‌این'}
          </Button>
        </Footer>
      }
    >
      <Surface padding={14} gap={10}>
        <Txt size={12} lh={18} w={600} color="text-muted">
          برنامه مربی
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
          {(
            (LIVE && plan
              ? [
                  ['خواب', 'bed', fa(plan.sleepHours), 'ساعت'],
                  ['آب', 'droplet', fa(plan.waterL), 'لیتر'],
                  ['کشش', 'activity', fa(plan.stretchMin), 'دقیقه'],
                  ['روز استراحت', 'moon', plan.restDays.map((d) => DAY_FA[d] || d).join('، ') || '—', undefined],
                ]
              : [
                  ['خواب', 'bed', '۸', 'ساعت'],
                  ['آب', 'droplet', '۲٫۵', 'لیتر'],
                  ['کشش', 'activity', '۱۵', 'دقیقه'],
                  ['روز استراحت', 'moon', 'جمعه', undefined],
                ]) as Array<[string, 'bed' | 'droplet' | 'activity' | 'moon', string, string | undefined]>
          ).map(([label, icon, value, unit]) => (
            <View key={label} style={{ width: '50%' }}>
              <ValueDisplay label={label} icon={icon} value={value} unit={unit} />
            </View>
          ))}
        </View>
      </Surface>
      {saved ? (
        <View
          style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c['brand-primary-subtle'] }}
        >
          <Icon name="check-circle" size={18} color="text-primary" />
          <Txt size={13} lh={20} style={{ flex: 1 }}>
            چک‌این امروز ثبت شد · می‌توانی ویرایشش کنی
          </Txt>
        </View>
      ) : null}
      <Surface gap={16}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Txt size={16} lh={24} w={600} style={{ flex: 1 }} accessibilityRole="header">
            چک‌این صبح
          </Txt>
          <Txt size={12} lh={18} color="text-muted">
            همه اختیاری
          </Txt>
        </View>
        {asks('sleep') ? <NumberStepper label="خواب دیشب" value={sleep} step={0.5} min={0} max={14} unit="ساعت" size="md" onChange={(x) => recovery.set({ sleep: x })} /> : null}
        {SCALES.filter(([k]) => asks(PLAN_KEY[k])).map(([k, label, lo, hi]) => (
          <ScaleInput key={k} label={label} value={v[k]} lowLabel={lo} highLabel={hi} size="sm" onChange={(x) => recovery.set((s) => ({ v: { ...s.v, [k]: x } }))} />
        ))}
        {custom.map((f) =>
          f.kind === 'scale' ? (
            <ScaleInput
              key={f.key}
              label={f.label}
              value={typeof extra[f.key] === 'number' ? (extra[f.key] as number) : null}
              lowLabel="کم"
              highLabel="زیاد"
              size="sm"
              onChange={(x) => setExtra(f.key, x)}
            />
          ) : f.kind === 'yesno' ? (
            <Switch key={f.key} label={f.label} checked={extra[f.key] === true} onChange={(on) => setExtra(f.key, on)} />
          ) : (
            <TextField
              key={f.key}
              label={f.label}
              suffix={f.unit || undefined}
              optional
              type={f.kind === 'number' ? 'decimal' : 'text'}
              value={extra[f.key] != null ? String(extra[f.key]) : ''}
              onChange={(t) => {
                const n = Number(t.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace('٫', '.'));
                setExtra(f.key, f.kind === 'number' ? (t.trim() && Number.isFinite(n) ? n : null) : t);
              }}
            />
          ),
        )}
      </Surface>
      {watchKeys.length ? (
        <Surface gap={12}>
          <Txt size={16} lh={24} w={600} accessibilityRole="header">
            از ساعت ورزشی
          </Txt>
          <Txt size={12} lh={18} color="text-muted">
            اختیاری · اعداد امروز صبح را از اپ ساعتت (Garmin، Polar، Apple Watch…) وارد کن.
          </Txt>
          {watchKeys.map(([k, label, unit, ph]) => (
            <TextField
              key={k}
              label={label}
              suffix={unit}
              placeholder={ph}
              optional
              type="numeric"
              value={watch[k] || ''}
              onChange={(t) => recovery.set((st) => ({ watch: { ...st.watch, [k]: t } }))}
            />
          ))}
        </Surface>
      ) : null}
    </Screen>
  );
}
