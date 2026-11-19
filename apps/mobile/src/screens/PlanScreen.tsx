// «برنامه من»: the program the coach wrote, week by week — what's tomorrow, what's next week, what was
// done. Days open to show their exercises; a logged day opens the session.
import { bandLabel, faDigits, faJoin, faNumber, JALALI_MONTHS, toJalali } from '@baseline/core';
import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { http } from '../api/http';
import { byTime } from '../data/workout';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { Badge, Button, EmptyState, ExerciseImage, Icon, MobileHeader, Screen, Surface, toast, Txt } from '../ui';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const WD: Record<string, string> = { sat: 'شنبه', sun: 'یکشنبه', mon: 'دوشنبه', tue: 'سه‌شنبه', wed: 'چهارشنبه', thu: 'پنجشنبه', fri: 'جمعه' };
const STATUS: Record<string, [string, 'success' | 'warning' | 'error' | 'info']> = {
  completed: ['انجام شد', 'success'],
  partial: ['ناقص', 'warning'],
  missed: ['انجام نشد', 'error'],
  in_progress: ['در حال انجام', 'info'],
  'in-progress': ['در حال انجام', 'info'],
  rest: ['استراحت ✓', 'success'], // a past day with nothing prescribed counts as done (#89)
};
const TIME: Record<string, string> = { morning: 'صبح', noon: 'ظهر', afternoon: 'عصر', night: 'شب' };
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dayMonth = (s: string) => {
  const j = toJalali(new Date(s + 'T12:00:00'));
  return faDigits(j.jd) + ' ' + JALALI_MONTHS[j.jm - 1];
};
/** This week's Saturday, moved by `offset` weeks. */
function weekStart(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7) + 7 * offset);
  return iso(d);
}

function setsText(e: Json): string {
  const load =
    e.value == null || e.value === ''
      ? ''
      : e.unit === 'band'
        ? bandLabel(Number(e.value))
        : faNumber(Number(e.value)) + ' ' + (e.unit === 'kg' ? 'kg' : e.unit === 'km' ? 'کیلومتر' : e.unit === 'm' ? 'متر' : e.unit);
  return faJoin([faDigits(e.sets) + ' × ' + faDigits(e.reps || '—'), load, e.restSec ? 'استراحت ' + faDigits(e.restSec) + ' ثانیه' : '']);
}

export function PlanScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Json | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pdfBusy, setPdfBusy] = useState(false);
  // The weekly program as a PDF (training, nutrition, supplements, recovery). The browser can't send the
  // token, so the server hands out a short-lived signed link.
  const openPdf = async () => {
    setPdfBusy(true);
    try {
      const { url } = await http.post<{ url: string }>('/me/program-link/');
      await Linking.openURL(url);
    } catch {
      toast('PDF باز نشد', 'اتصال را بررسی کن و دوباره امتحان کن.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };
  useEffect(() => {
    setData(null);
    setFailed(false);
    http
      .get<Json>(`/me/schedule/?start=${weekStart(offset)}&days=7`)
      .then((d) => {
        setData(d);
        // Today and tomorrow start open on this week; the first training day on other weeks.
        const days: Json[] = d.days || [];
        const t = days.findIndex((x) => x.today);
        const keys = offset === 0 && t >= 0 ? [days[t], days[t + 1]] : [days.find((x) => !x.rest)];
        setOpen(Object.fromEntries(keys.filter((x): x is Json => !!x).map((x) => [x.date, true])));
      })
      .catch(() => setFailed(true));
  }, [offset]);
  const days: Json[] = data?.days || [];
  const program = data?.program;
  const wk = days.find((d) => d.week)?.week;
  const label = offset === 0 ? 'این هفته' : offset === 1 ? 'هفته بعد' : offset === -1 ? 'هفته قبل' : days.length ? dayMonth(days[0].date) + ' تا ' + dayMonth(days[6].date) : '';
  const trainingDays = days.filter((d) => !d.rest || d.also?.length).length;
  return (
    <Screen gap={12} header={<MobileHeader title="برنامه من" back="بازگشت" onBack={() => nav.goBack()} />}>
      {program ? (
        <Surface padding={14} gap={4}>
          <Txt size={16} lh={24} w={700}>
            {program.name}
          </Txt>
          <Txt size={12} lh={18} color="text-muted">
            {faJoin([faDigits(program.durationWeeks) + ' هفته', program.start ? 'از ' + dayMonth(program.start) : '', program.end ? 'تا ' + dayMonth(program.end) : ''])}
          </Txt>
          <Button variant="secondary" size="sm" icon="download" loading={pdfBusy} onPress={openPdf} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
            دانلود PDF برنامه این هفته
          </Button>
        </Surface>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="هفته قبل" hitSlop={10} onPress={() => setOffset((o) => o - 1)} style={{ padding: 6 }}>
          <Icon name="chevron-right" size={22} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt size={15} lh={22} w={600}>
            {label}
          </Txt>
          <Txt size={12} lh={18} color="text-muted">
            {faJoin([wk ? 'هفته ' + faDigits(wk) + (program ? ' از ' + faDigits(program.durationWeeks) : '') : '', data ? faDigits(trainingDays) + ' روز تمرین' : ''])}
          </Txt>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="هفته بعد" hitSlop={10} onPress={() => setOffset((o) => o + 1)} style={{ padding: 6 }}>
          <Icon name="chevron-left" size={22} />
        </Pressable>
      </View>
      {offset !== 0 ? (
        <Pressable onPress={() => setOffset(0)} style={{ alignSelf: 'center' }}>
          <Txt size={12} lh={18} color="brand-primary-text" w={600}>
            برگشت به این هفته
          </Txt>
        </Pressable>
      ) : null}
      {failed ? <EmptyState icon="alert-circle" title="برنامه باز نشد" description="اتصال را بررسی کن و دوباره امتحان کن." /> : null}
      {data && !program ? <EmptyState icon="clipboard" title="هنوز برنامه‌ای نداری" description="وقتی مربی برنامه‌ات را بنویسد، روزهای تمرین اینجا نمایش داده می‌شوند." /> : null}
      {program && days.length && !trainingDays ? (
        <Txt size={13} lh={20} color="text-muted" align="center">
          در این هفته جلسه‌ای در برنامه نیست (قبل از شروع یا بعد از پایان برنامه).
        </Txt>
      ) : null}
      {program
        ? days.map((d) => {
            const isOpen = !!open[d.date];
            const st = d.status ? STATUS[d.status] : null;
            return (
              <Surface key={d.date} padding={0} gap={0}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  disabled={d.rest}
                  onPress={() => setOpen((o) => ({ ...o, [d.date]: !isOpen }))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 14,
                    borderRadius: 8,
                    borderWidth: d.today ? 1.5 : 0,
                    borderColor: c['brand-primary'],
                  }}
                >
                  <View style={{ width: 54 }}>
                    <Txt size={13} lh={20} w={600} color={d.today ? 'brand-primary-text' : 'text-primary'}>
                      {d.today ? 'امروز' : WD[d.weekday]}
                    </Txt>
                    <Txt size={11} lh={16} color="text-muted">
                      {dayMonth(d.date)}
                    </Txt>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt size={14} lh={22} w={d.rest ? 400 : 600} color={d.rest ? 'text-muted' : 'text-primary'} numberOfLines={1}>
                      {d.rest ? 'استراحت' : (TIME[d.time] ? TIME[d.time] + ' · ' : '') + (d.focus || 'جلسه تمرین')}
                    </Txt>
                    {!d.rest ? (
                      <Txt size={12} lh={18} color="text-muted">
                        {faDigits(d.exercises.length) + ' حرکت · ' + faDigits(d.exercises.reduce((a: number, e: Json) => a + (e.sets || 0), 0)) + ' ست'}
                      </Txt>
                    ) : null}
                    {(d.also || []).map((x: Json) => (
                      // The same day in the athlete's other programs (#74).
                      <Txt key={x.programId} size={12} lh={18} w={500} color="brand-primary-text" numberOfLines={1}>
                        {'+ ' +
                          (TIME[x.time] ? TIME[x.time] + ' · ' : '') +
                          (x.focus || 'جلسه تمرین') +
                          ' · ' +
                          x.name +
                          (x.status === 'completed' ? ' ✓' : x.status === 'missed' ? ' · انجام نشد' : '')}
                      </Txt>
                    ))}
                  </View>
                  {st ? (
                    <Badge tone={st[1]} size="sm">
                      {st[0]}
                    </Badge>
                  ) : null}
                  {!d.rest ? <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="text-muted" /> : null}
                </Pressable>
                {isOpen && !d.rest ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
                    {byTime(d.exercises as Json[]).map((g) => (
                      <View key={g.label || 'all'} style={{ gap: 8 }}>
                        {g.label ? (
                          <Txt size={13} lh={20} w={700} color="brand-primary-text" style={{ paddingTop: 6 }}>
                            {g.label}
                          </Txt>
                        ) : null}
                        {g.items.map(({ e, i }) => (
                          <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingTop: 8, borderTopWidth: 1, borderTopColor: c['border-subtle'] }}>
                            <Txt size={12} lh={20} w={600} color="text-muted" style={{ width: 18 }}>
                              {faDigits(i + 1)}
                            </Txt>
                            <ExerciseImage src={e.imageSrc} start={e.imageStartSrc} name={e.name} size={48} radius={6} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Txt size={14} lh={22} w={500}>
                                {e.name}
                              </Txt>
                              <Txt size={12} lh={18} color="text-secondary">
                                {setsText(e)}
                              </Txt>
                              {e.note ? (
                                <Txt size={12} lh={18} color="text-muted">
                                  {e.note}
                                </Txt>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                    {d.today ? (
                      <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Workout' })} style={{ paddingTop: 4 }}>
                        <Txt size={13} lh={20} w={600} color="brand-primary-text">
                          رفتن به تمرین امروز ←
                        </Txt>
                      </Pressable>
                    ) : d.workoutId ? (
                      <Pressable onPress={() => nav.navigate('Session', { id: d.workoutId })} style={{ paddingTop: 4 }}>
                        <Txt size={13} lh={20} w={600} color="brand-primary-text">
                          دیدن جلسه ثبت‌شده ←
                        </Txt>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Surface>
            );
          })
        : null}
    </Screen>
  );
}
