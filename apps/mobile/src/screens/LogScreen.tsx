// Design: project/M38 Athlete Set Logging.dc.html
import { bandLabel, faClock, faDigits, faNumber, parseFaNumber, faJoin } from '@baseline/core';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { EXERCISES, finishWorkout, isBand, isPR, logSet, nextUnfinished, stats, undoLastSet, workout, type SetLog } from '../data/workout';
import { useNav, type RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { Badge, Button, ExerciseImage, Footer, Icon, MobileHeader, Screen, SetRow, SetRowHeader, TextField, toast, Txt } from '../ui';

/**
 * Log sets for one exercise. Each pending set is prefilled with the plan (last session's numbers):
 * tick if done as prescribed, edit weight/reps first only if different. Ticking starts the rest timer.
 */
export function LogScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Log'>>();
  const w = workout.use();
  const [e, setE] = useState(() => (params?.e != null ? params.e : Math.max(0, stats(workout.get()).cur)));
  const [edits, setEdits] = useState<Record<string, [string, string]>>({});
  const [note, setNote] = useState('');
  const [rest, setRest] = useState(0);
  const [restOn, setRestOn] = useState(false);

  useEffect(() => {
    if (!restOn) return;
    const t = setInterval(() => {
      setRest((r) => {
        if (r <= 1) {
          setRestOn(false);
          toast('استراحت تمام شد', 'آماده ست بعدی هستی.');
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [restOn]);

  const ex = EXERCISES[e];
  const logs = w.logs[e] || [];
  const n = logs.length;
  const full = n >= ex.sets;
  const prevOf = (k: number) => ex.prev[k] || ex.prev[ex.prev.length - 1];
  const draft = (k: number): [string, string] => edits[e + '-' + k] ?? [faNumber(prevOf(k)[0], 2, false), faDigits(prevOf(k)[1])];
  const plan = (k: number): SetLog => {
    const [ws, rs] = draft(k);
    return [parseFaNumber(ws) ?? prevOf(k)[0], parseFaNumber(rs) ?? prevOf(k)[1]];
  };
  const [pw, pr] = plan(n);
  const hadPR = logs.some((x) => isPR(ex, x));
  const willPR = !full && isPR(ex, [pw, pr]) && !hadPR;
  const st = stats(w);
  const next = nextUnfinished(w, e);
  const band = isBand(ex);
  /** «۶۰ کیلو» or, for band work, «کش سبز». */
  const load = (v: number) => (band ? bandLabel(v) || 'کش' : faNumber(v) + ' کیلو');

  const startRest = (sec: number) => {
    setRest(sec);
    setRestOn(true);
  };
  const complete = () => {
    logSet(e, [pw, pr]);
    if (willPR) toast('رکورد جدید! 🏆', faJoin([ex.name, faNumber(pw) + ' kg × ' + faDigits(pr)]));
    setNote('');
    if (n + 1 < ex.sets) startRest(ex.rest);
  };
  const pick = (j: number) => {
    setRestOn(false);
    setRest(0);
    setNote('');
    setE(j);
  };
  const edit = (k: number, idx: 0 | 1, v: string) => {
    const d = draft(k).slice() as [string, string];
    d[idx] = v;
    setEdits((s) => ({ ...s, [e + '-' + k]: d }));
  };
  const cta = () => {
    if (!full) complete();
    else if (next > -1) pick(next);
    else {
      finishWorkout();
      nav.navigate('Complete');
    }
  };

  return (
    <Screen
      surface
      gap={14}
      header={
        <>
          <MobileHeader title="ثبت ست‌ها" back="تمرین" onBack={() => nav.goBack()} actions={[{ icon: 'stopwatch', label: 'تایمر استراحت', onPress: () => startRest(ex.rest) }]} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, backgroundColor: c.surface }}
            contentContainerStyle={{ gap: 6, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 8 }}
          >
            {EXERCISES.map((x, j) => {
              const d = (w.logs[j] || []).length >= x.sets;
              const on = j === e;
              return (
                <Pressable
                  key={x.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => pick(j)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: on ? c['brand-primary'] : c.border,
                    backgroundColor: on ? c['brand-primary-subtle'] : c.surface,
                    justifyContent: 'center',
                  }}
                >
                  <Txt size={12} lh={16} w={500}>
                    {(d ? '✓ ' : '') + x.name}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      }
      footer={
        <Footer>
          <Button size="lg" fullWidth icon={full ? 'arrow-left' : 'check'} onPress={cta}>
            {!full ? 'ثبت ست ' + faDigits(n + 1) : next > -1 ? 'حرکت بعد: ' + EXERCISES[next].name : 'پایان تمرین'}
          </Button>
          <Txt size={12} lh={18} color="text-muted" align="center">
            {!full ? 'استراحت ' + faDigits(ex.rest) + ' ثانیه بعد از ثبت ست شروع می‌شود.' : 'کل تمرین: ' + faDigits(st.done) + ' از ' + faDigits(st.total) + ' ست'}
          </Txt>
        </Footer>
      }
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {ex.image ? (
          // The movement while logging: start ↔ end pose; tap for steps and tips.
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={'تصویر و نکات ' + ex.name} onPress={() => nav.navigate('Exercise', { e })}>
            <ExerciseImage src={ex.image} start={ex.imageStart} name={ex.name} size={96} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={12} lh={18} color="text-muted">
            {faJoin(['حرکت ' + faDigits(e + 1) + ' از ' + faDigits(EXERCISES.length), faDigits(ex.sets) + ' × ' + ex.reps, 'استراحت ' + faDigits(ex.rest) + ' ثانیه'])}
          </Txt>
          <Pressable accessibilityRole="link" onPress={() => nav.navigate('Exercise', { e })}>
            <Txt size={18} lh={28} w={700}>
              {ex.name}
            </Txt>
          </Pressable>
        </View>
        <Badge tone={full ? 'success' : 'neutral'}>{faDigits(Math.min(n, ex.sets)) + ' از ' + faDigits(ex.sets) + ' ست'}</Badge>
      </View>
      <View style={{ gap: 4 }}>
        <SetRowHeader unit={band ? 'کش' : 'kg'} />
        {Array.from({ length: ex.sets }, (_, k) => {
          const l = logs[k];
          const p = prevOf(k);
          const d = draft(k);
          return (
            <SetRow
              key={k}
              index={k + 1}
              previous={(band ? bandLabel(p[0]).replace('کش ', '') || '—' : faNumber(p[0])) + ' × ' + faDigits(p[1])}
              band={band}
              weight={l ? faNumber(l[0], 2, false) : d[0]}
              reps={l ? faDigits(l[1]) : d[1]}
              state={l ? 'done' : k === n ? 'active' : 'pending'}
              isPR={(l && isPR(ex, l)) || (k === n && willPR)}
              onWeight={(v) => edit(k, 0, v)}
              onReps={(v) => edit(k, 1, v)}
              onToggle={() => {
                if (l && k === n - 1) undoLastSet(e);
                else if (!l && k === n) complete();
              }}
            />
          );
        })}
      </View>
      {!full ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Txt size={14} lh={22} w={600} style={{ flex: 1 }}>
              {'ست ' + faDigits(n + 1)}
            </Txt>
            {willPR ? (
              <Badge tone="record" icon="trophy">
                رکورد جدید اگر کامل شود
              </Badge>
            ) : null}
          </View>
          <Txt size={13} lh={20} color="text-secondary">
            {'برنامه: ' +
              load(pw) +
              '، ' +
              faDigits(pr) +
              ' تکرار. اگر همین را زدی فقط تیک بزن؛ ' +
              (band ? 'اگر کش دیگری زدی، روی رنگ کش بزن تا عوض شود.' : 'اگر کمتر یا بیشتر رفتی، عدد ردیف را عوض کن.')}
          </Txt>
          <TextField placeholder="یادداشت یا RPE (اختیاری)" size="sm" value={note} onChange={setNote} accessibilityLabel="یادداشت ست" />
        </View>
      ) : null}
      {restOn ? (
        <View
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c['brand-primary-subtle'] }}
          accessibilityLiveRegion="polite"
        >
          <Icon name="stopwatch" size={20} color="text-primary" />
          <View style={{ flex: 1 }}>
            <Txt size={12} lh={18} color="text-secondary">
              استراحت
            </Txt>
            <Txt size={22} lh={30} w={600} mono ltr>
              {faClock(rest)}
            </Txt>
          </View>
          <Button variant="secondary" size="sm" onPress={() => setRest((r) => r + 15)}>
            +۱۵ ث
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setRestOn(false);
              setRest(0);
            }}
          >
            رد کردن
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
