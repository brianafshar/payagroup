// A past (or today's) session with the coach's feedback (#62): opened from the notifications list.
import { faDigits, faJoin, faNumber } from '@baseline/core';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { http } from '../api/http';
import { useNav } from '../navigation/types';
import { EmptyState, Icon, ListGroup, ListRow, MobileHeader, Screen, Surface, Txt, ValueDisplay } from '../ui';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const STATUS: Record<string, string> = { completed: 'کامل انجام شد', partial: 'ناقص انجام شد', missed: 'انجام نشد', in_progress: 'در حال انجام', planned: 'برنامه‌ریزی‌شده' };

export function SessionScreen() {
  const nav = useNav();
  const { id } = useRoute<RouteProp<RootStackParamList, 'Session'>>().params;
  const [log, setLog] = useState<Json | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    http
      .get<Json>(`/workouts/${id}/`)
      .then(setLog)
      .catch(() => setFailed(true));
  }, [id]);
  const date = log ? new Date(log.date + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  // Sets grouped by exercise, in order.
  const groups: Array<{ name: string; done: number; total: number; best: string }> = [];
  for (const s of log?.sets || []) {
    let g = groups.find((x) => x.name === s.exerciseName);
    if (!g) groups.push((g = { name: s.exerciseName, done: 0, total: 0, best: '' }));
    g.total += 1;
    if (s.done) {
      g.done += 1;
      const w = s.actualValue ?? s.targetValue;
      const r = s.actualReps || s.targetReps;
      if (w) g.best = faNumber(w) + ' ' + s.unit + (r ? ' × ' + faDigits(r) : '');
    }
  }
  return (
    <Screen gap={12} header={<MobileHeader title={log?.focus || 'جلسه تمرین'} back="بازگشت" onBack={() => nav.goBack()} />}>
      {failed ? <EmptyState icon="alert-circle" title="جلسه باز نشد" description="اتصال را بررسی کن و دوباره امتحان کن." /> : null}
      {log ? (
        <>
          {log.coachFeedback?.length ? (
            <Surface padding={14} gap={8}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Icon name="chat" size={16} color="brand-primary-text" />
                <Txt size={13} lh={20} w={600}>
                  بازخورد مربی
                </Txt>
              </View>
              {log.coachFeedback.map((f: string, i: number) => (
                <Txt key={i} size={15} lh={26}>
                  {f}
                </Txt>
              ))}
            </Surface>
          ) : null}
          <Surface>
            <Txt size={12} lh={18} color="text-muted">
              {faJoin([date, STATUS[log.status] || log.status])}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
              {log.durationMin ? <ValueDisplay label="مدت" value={faDigits(log.durationMin)} unit="دقیقه" /> : null}
              {log.volumeKg ? <ValueDisplay label="حجم" value={faNumber(Math.round(log.volumeKg), 0)} unit="kg" /> : null}
              {log.rpe ? <ValueDisplay label="RPE" value={faDigits(log.rpe)} unit="از ۱۰" /> : null}
              {log.distanceKm ? <ValueDisplay label="مسافت" value={faNumber(log.distanceKm)} unit="km" /> : null}
            </View>
          </Surface>
          {groups.length ? (
            <ListGroup>
              {groups.map((g) => (
                <ListRow
                  key={g.name}
                  icon={g.done >= g.total ? 'check-circle' : g.done ? 'circle-half' : 'x-circle'}
                  iconColor={g.done >= g.total ? 'success' : g.done ? 'brand-primary-text' : 'text-muted'}
                  title={g.name}
                  subtitle={g.best || undefined}
                  value={faDigits(g.done) + '/' + faDigits(g.total)}
                  chevron={false}
                />
              ))}
            </ListGroup>
          ) : null}
          {log.athleteNote ? (
            <Surface padding={14} gap={4}>
              <Txt size={12} lh={18} w={600} color="text-muted">
                یادداشت تو
              </Txt>
              <Txt size={14} lh={24} color="text-secondary">
                {log.athleteNote}
              </Txt>
            </Surface>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
