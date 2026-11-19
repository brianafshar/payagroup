// Design: project/M43 Athlete Progress.dc.html
import { faDigits, JALALI_MONTHS, toJalali } from '@baseline/core';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LIVE } from '../api/config';
import { MEASURE_HISTORY, measures } from '../data/athlete';
import { loadProgress, progress, records } from '../data/live';
import { SESSION } from '../data/workout';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { ScrollView } from 'react-native';
import { ComparisonBar, Icon, LineChart, ListGroup, ListRow, MobileHeader, ProgressBar, Screen, Surface, Tag, Txt } from '../ui';
import { ProgressTrends } from './ProgressTrends';

const LIFTS = {
  bench: ['1RM پرس سینه', 'پرس سینه', [60, 65, 70, 72.5, 75, 77.5, 80, 82.5]],
  squat: ['1RM اسکوات', 'اسکوات', [85, 90, 95, 97.5, 100, 105, 107.5, 110]],
  dead: ['1RM ددلیفت', 'ددلیفت', [120, 125, 130, 135, 140, 142.5, 147.5, 150]],
} as const;
type Lift = string;
// #63: up to 3 years, or everything since the first logged session.
const DAYS = { m: 30, '3m': 90, '6m': 180, '1y': 365, '2y': 730, '3y': 1095, all: 3650 } as const;
const RANGE_LABEL: Record<keyof typeof DAYS, string> = { m: 'ماه', '3m': '۳ ماه', '6m': '۶ ماه', '1y': '۱ سال', '2y': '۲ سال', '3y': '۳ سال', all: 'همه' };
const MONTHS_IN: Record<keyof typeof DAYS, number> = { m: 2, '3m': 4, '6m': 8, '1y': 13, '2y': 25, '3y': 37, all: 999 };
const faMonth = (iso: string) => JALALI_MONTHS[toJalali(new Date(iso + 'T12:00:00')).jm - 1];
const MONTHS = ['بهمن', 'اسفند', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'];
const ADHERENCE: Record<string, readonly number[]> = { m: [95, 89, 82], '3m': [94, 88, 81], '6m': [93, 87, 80] };

export function ProgressScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const [range, setRange] = useState<keyof typeof DAYS>('6m');
  const [lift, setLift] = useState<Lift>('bench');
  const [liftOpen, setLiftOpen] = useState(false);
  const { extra } = measures.use();
  const live = progress.use().data;
  const recs = records.use().list;
  useEffect(() => {
    if (LIVE) void loadProgress(DAYS[range]).catch(() => {});
  }, [range]);
  const n = MONTHS_IN[range];
  // Lifts: the design's sample series, or (live) the monthly best estimated 1RM of the most-trained lifts.
  const lifts: Record<string, { label: string; name: string; labels: string[]; values: number[] }> = LIVE
    ? Object.fromEntries(
        ((live?.lifts || []) as Array<{ exerciseId: number; name: string; labels: string[]; values: number[] }>)
          .filter((l) => l.values.length)
          .map((l) => [String(l.exerciseId), { label: '1RM ' + l.name, name: l.name, labels: l.labels.map(faMonth), values: l.values }]),
      )
    : Object.fromEntries(Object.entries(LIFTS).map(([k, [lb, nm, v]]) => [k, { label: lb, name: nm, labels: MONTHS.slice(-n), values: v.slice(-n) }]));
  const liftKeys = Object.keys(lifts);
  const cur = lifts[lift] || lifts[liftKeys[0]];
  const label = cur?.label || '';
  const vals = cur ? cur.values.slice(-n) : [];
  const labels = cur ? cur.labels.slice(-n) : [];
  const A: ReadonlyArray<number | null> = LIVE
    ? [live?.adherence?.training ?? null, live?.adherence?.nutrition ?? null, live?.adherence?.recovery ?? null]
    : (ADHERENCE[range] ?? ADHERENCE['6m']);
  const newPrs = recs.filter((x) => x.isNew).length;
  const lastMeasure = MEASURE_HISTORY[0];
  return (
    <Screen gap={14} header={<MobileHeader large title="پیشرفت" actions={[{ icon: 'chat', label: 'گفتگو با مربی', onPress: () => nav.navigate('Chat') }]} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="بازه زمانی" contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
        {(Object.keys(DAYS) as Array<keyof typeof DAYS>).map((k) => (
          <Tag key={k} selected={k === range} onPress={() => setRange(k)}>
            {RANGE_LABEL[k]}
          </Tag>
        ))}
      </ScrollView>
      <Surface>
        <Txt size={12} lh={18} w={600} color="text-muted">
          پایبندی
        </Txt>
        {(
          [
            ['تمرین', A[0]],
            ['تغذیه', A[1]],
            ['ریکاوری', A[2]],
          ] as const
        ).map(([l, v]) => (
          <ProgressBar key={l} label={l} value={v ?? 0} valueLabel={v == null ? '—' : '٪' + faDigits(v)} />
        ))}
      </Surface>
      {!LIVE && cur ? (
        <Surface>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', zIndex: 2 }}>
            <Txt size={12} lh={18} w={600} color="text-muted" style={{ flex: 1 }}>
              قدرت
            </Txt>
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="انتخاب حرکت"
                onPress={() => setLiftOpen(!liftOpen)}
                style={{
                  height: 32,
                  minWidth: 128,
                  paddingHorizontal: 12,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: c['border-strong'],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: c.surface,
                }}
              >
                <Txt size={14} lh={20} style={{ flex: 1 }}>
                  {cur.name}
                </Txt>
                <Icon name="chevron-down" size={18} color="text-muted" />
              </Pressable>
              {liftOpen ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 36,
                    start: 0,
                    end: 0,
                    backgroundColor: c['surface-elevated'],
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 4,
                    elevation: 4,
                  }}
                >
                  {liftKeys.map((k) => (
                    <Pressable
                      key={k}
                      accessibilityRole="menuitem"
                      onPress={() => {
                        setLift(k);
                        setLiftOpen(false);
                      }}
                      style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: lifts[k] === cur ? c['brand-primary-subtle'] : 'transparent' }}
                    >
                      <Txt size={14} lh={20} w={lifts[k] === cur ? 600 : 400}>
                        {lifts[k].name}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <ComparisonBar label={label} first={vals[0]} current={vals[vals.length - 1]} unit="kg" firstDate={labels[0]} currentDate={labels[labels.length - 1]} />
          {vals.length > 1 ? (
            <LineChart labels={labels} values={[...vals]} unit="kg" height={160} summary={label + ' از ' + labels[0] + ' تا ' + labels[labels.length - 1]} />
          ) : null}
        </Surface>
      ) : LIVE && live && !live.trends?.lifts?.length ? (
        <Surface>
          <Txt size={12} lh={18} w={600} color="text-muted">
            قدرت
          </Txt>
          <Txt size={14} lh={22} color="text-secondary">
            با ثبت چند جلسه تمرین، روند قدرتت اینجا نمایش داده می‌شود.
          </Txt>
        </Surface>
      ) : null}
      {LIVE ? <ProgressTrends t={live?.trends} long={DAYS[range] > 180} /> : null}
      <ListGroup>
        <ListRow
          icon="trophy"
          title="رکوردهای شخصی"
          subtitle={LIVE ? (newPrs ? faDigits(newPrs) + ' رکورد جدید این هفته' : 'رکوردها و نتایج تست‌ها') : '۱ رکورد جدید این هفته'}
          value={LIVE ? faDigits(recs.length) : '۹'}
          onPress={() => nav.navigate('Records')}
        />
        <ListRow
          icon="ruler"
          title="اندازه‌گیری بدن"
          subtitle={LIVE ? (lastMeasure ? 'آخرین: ' + lastMeasure.date : 'هنوز ثبت نشده') : extra.length ? 'آخرین: امروز' : 'آخرین: ۳۰ شهریور · بعدی جمعه'}
          onPress={() => nav.navigate('Measure')}
        />
        <ListRow icon="dumbbell" title="تمرین امروز" subtitle={LIVE ? SESSION.title : 'سینه + پشت بازو'} onPress={() => nav.navigate('Tabs', { screen: 'Workout' })} />
      </ListGroup>
    </Screen>
  );
}
