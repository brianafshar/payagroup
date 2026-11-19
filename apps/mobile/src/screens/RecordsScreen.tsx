// Design: project/M44 Athlete Personal Records.dc.html
import { faNumber, faJoin } from '@baseline/core';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { LIVE } from '../api/config';
import { records } from '../data/live';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { EmptyState, MobileHeader, PRCard, Screen, Tag, Txt } from '../ui';

const RECORDS = [
  { ex: 'پرس سینه', type: 'حداکثر ۸ تکرار', date: 'امروز', v: 67.5, p: 65, u: 'kg', d: 3.8, c: 'str', isNew: true },
  { ex: 'پرس سینه', type: 'حداکثر ۱ تکرار', date: '۲۴ شهریور', v: 82.5, p: 80, u: 'kg', d: 3.1, c: 'str' },
  { ex: 'اسکوات', type: 'حداکثر ۱ تکرار', date: '۱۷ شهریور', v: 110, p: 105, u: 'kg', d: 4.8, c: 'str' },
  { ex: 'ددلیفت', type: 'حداکثر ۱ تکرار', date: '۱۰ شهریور', v: 150, p: 145, u: 'kg', d: 3.4, c: 'str' },
  { ex: 'پرس سرشانه', type: 'حداکثر ۵ تکرار', date: '۳ شهریور', v: 45, p: 42.5, u: 'kg', d: 5.9, c: 'str' },
  { ex: 'پرش عمودی', type: 'بهترین ارتفاع', date: '۲۷ مرداد', v: 51, p: 48, u: 'cm', d: 6.3, c: 'pow' },
  { ex: 'دوی ۱۰۰ متر', type: 'بهترین زمان', date: '۱۲ مرداد', v: 12.8, p: 13.2, u: 'ثانیه', d: -3.0, c: 'spd', lower: true },
];
const CATS = { all: 'همه', str: 'قدرت', pow: 'توان', spd: 'سرعت' } as const;

export function RecordsScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const [cat, setCat] = useState<keyof typeof CATS>('all');
  const live = records.use();
  const list = LIVE ? live.list : RECORDS;
  return (
    <Screen
      gap={10}
      header={
        <>
          <MobileHeader title="رکوردهای شخصی" back="پیشرفت" onBack={() => nav.goBack()} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, backgroundColor: c.background }}
            contentContainerStyle={{ gap: 6, paddingTop: 4, paddingHorizontal: 16, paddingBottom: 8 }}
          >
            {(Object.keys(CATS) as Array<keyof typeof CATS>).map((k) => (
              <Tag key={k} selected={k === cat} onPress={() => setCat(k)}>
                {CATS[k]}
              </Tag>
            ))}
          </ScrollView>
        </>
      }
    >
      {LIVE && live.loaded && !list.length ? <EmptyState icon="trophy" title="هنوز رکوردی ثبت نشده" description="با ثبت ست‌ها، رکوردهای جدیدت خودکار اینجا می‌آیند." /> : null}
      {list
        .filter((r) => cat === 'all' || r.c === cat)
        .map((r, i) => (
          <PRCard
            key={i}
            exercise={r.ex}
            type={faJoin([r.type, r.date])}
            value={faNumber(r.v)}
            unit={r.u}
            previous={r.p != null ? faNumber(r.p) + ' ' + r.u : undefined}
            delta={r.p != null ? r.d : undefined}
            lowerIsBetter={!!r.lower}
            isNew={!!r.isNew}
          />
        ))}
      <Txt size={12} lh={18} color="text-muted" align="center">
        رکوردها هنگام ثبت ست خودکار شناسایی می‌شوند.
      </Txt>
    </Screen>
  );
}
