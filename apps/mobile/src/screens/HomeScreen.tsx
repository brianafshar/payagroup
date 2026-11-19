// Design: project/M35 Athlete Home.dc.html
import { faDigits, faNumber, faJoin } from '@baseline/core';
import { Pressable, View } from 'react-native';
import { LIVE } from '../api/config';
import { ATHLETE, measures, MEALS, MEASURE_HISTORY, nutrition, nutritionTotals, profile, recovery } from '../data/athlete';
import { chatMeta, groups, inbox, records, tomorrow } from '../data/live';
import { EXERCISES, selectSession, SESSION, stats, todaySessions, workout } from '../data/workout';
import { greeting, todayLabel } from '../lib';
import { useNav } from '../navigation/types';
import { useTrainingRefresh } from './useTrainingRefresh';
import { useTheme } from '../theme';
import { Icon, MobileHeader, PRCard, Screen, toast, TrendIndicator, Txt, WorkoutCard, type IconRef } from '../ui';

export function HomeScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const w = workout.use();
  const n = nutrition.use();
  const r = recovery.use();
  const m = measures.use();
  profile.use(); // re-render when the live profile (ATHLETE) loads
  const st = stats(w);
  const logged = n.st.filter((x) => x !== 'unlogged').length;
  const kcal = nutritionTotals(n.st)[0];
  const unread = chatMeta.use().unread + groups.use().unread; // direct chat + the coach's groups (#81)
  const notes = inbox.use();
  const next = tomorrow.use().day;
  // Tomorrow's menu from the weekly nutrition plan.
  const nweek = nutrition.use().week;
  const tmrCode = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][(new Date().getDay() + 1) % 7];
  const food = nweek?.find((d) => d.day === tmrCode);
  // #62: the coach's latest unread feedback on a session.
  const fresh = LIVE ? notes.items.find((x) => x.kind === 'feedback' && x.unread) : undefined;
  const recs = records.use();
  const refresh = useTrainingRefresh();
  // Other programs' sessions today (#74), e.g. a run next to the gym session shown in the card.
  const others = todaySessions.use().list.filter((x) => !x.selected && !x.rest);
  // Live: measured in the last 7 days; latest PR and the last two weigh-ins for «recent progress».
  const measuredThisWeek = LIVE ? MEASURE_HISTORY.some((e) => e.iso && Date.now() - Date.parse(e.iso) < 7 * 86400000) : m.extra.length > 0;
  const weighIns = MEASURE_HISTORY.filter((e) => e.v.w != null);
  const pr = LIVE ? recs.list[0] : null;
  const tiles: Array<{ icon: IconRef; label: string; value: string; sub: string; go: () => void }> = [
    {
      icon: 'utensils',
      label: 'تغذیه',
      value: faDigits(logged) + ' از ' + faDigits(MEALS.length),
      sub: faJoin(['وعده ثبت شده', faNumber(kcal, 0, false) + ' کالری']),
      go: () => nav.navigate('Tabs', { screen: 'Nutrition' }),
    },
    {
      icon: 'moon',
      label: 'ریکاوری',
      value: faNumber(r.sleep, 1) + ' ساعت',
      sub: 'خواب · ' + (r.saved ? 'چک‌این انجام شد' : 'چک‌این صبح مانده'),
      go: () => nav.navigate('Tabs', { screen: 'Recovery' }),
    },
  ];
  return (
    <Screen
      scrollProps={LIVE ? { refreshControl: refresh } : undefined}
      header={
        <MobileHeader
          large
          eyebrow={todayLabel()}
          title={greeting() + '، ' + ATHLETE.first}
          actions={[
            { icon: 'chat', label: 'گفتگو با مربی', onPress: () => nav.navigate('Chat'), dot: LIVE ? unread > 0 : true },
            LIVE
              ? { icon: 'bell' as const, label: 'اعلان‌ها', onPress: () => nav.navigate('Notifications'), dot: notes.unread > 0 }
              : { icon: 'bell' as const, label: 'اعلان‌ها', onPress: () => toast('اعلان‌ها', 'مربی برنامه هفته ۴ را به‌روز کرد · دیروز ۲۱:۰۴') },
          ]}
        />
      }
    >
      {fresh ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.navigate('Session', { id: fresh.workoutId })}
          style={{ gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c['brand-primary'] }}
        >
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="chat" size={16} color="brand-primary-text" />
            <Txt size={13} lh={20} w={600} style={{ flex: 1 }}>
              {'بازخورد جدید مربی' + (fresh.title ? ' · ' + fresh.title : '')}
            </Txt>
            <Icon name="chevron-left" size={16} color="text-muted" />
          </View>
          <Txt size={14} lh={22} color="text-secondary" numberOfLines={2}>
            {fresh.text}
          </Txt>
        </Pressable>
      ) : null}
      {!measuredThisWeek ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.navigate('Measure')}
          style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 8,
            backgroundColor: c['brand-primary-subtle'],
            borderWidth: 1,
            borderColor: c['brand-primary'],
          }}
        >
          <Icon name="ruler" size={20} color="text-primary" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={14} lh={22} w={600}>
              اندازه‌گیری هفتگی امروز است
            </Txt>
            <Txt size={12} lh={18} color="text-secondary">
              وزن و دور بدن را ثبت کن · حدود ۲ دقیقه
            </Txt>
          </View>
          <Icon name="chevron-left" size={18} color="text-primary" />
        </Pressable>
      ) : null}
      <WorkoutCard
        eyebrow="تمرین امروز"
        title={SESSION.title}
        meta={
          LIVE && SESSION.rest
            ? SESSION.program
            : faJoin(['هفته ' + faDigits(SESSION.week), 'روز ' + faDigits(SESSION.day), faDigits(EXERCISES.length) + ' حرکت', 'حدود ' + faDigits(SESSION.minutes) + ' دقیقه'])
        }
        status={LIVE && SESSION.rest ? 'planned' : w.finished || st.cur < 0 ? 'completed' : st.done ? 'in-progress' : 'planned'}
        done={st.done}
        total={st.total}
        ctaLabel={LIVE && SESSION.rest ? 'جزئیات' : w.finished ? 'مشاهده تمرین' : st.done ? 'ادامه تمرین' : 'شروع تمرین'}
        onCta={() => nav.navigate('Tabs', { screen: 'Workout' })}
      />
      {others.map((x) => (
        <Pressable
          key={x.programId}
          accessibilityRole="button"
          onPress={() => {
            void selectSession(x.programId);
            nav.navigate('Tabs', { screen: 'Workout' });
          }}
          style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 8,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Icon name="activity" size={18} color="brand-primary-text" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={13} lh={20} w={600}>
              {'امروز · ' + (x.focus || 'جلسه تمرین')}
            </Txt>
            <Txt size={12} lh={18} color="text-muted" numberOfLines={1}>
              {x.name + (x.status === 'completed' ? ' · انجام شد' : x.status === 'in-progress' ? ' · در حال انجام' : '')}
            </Txt>
          </View>
          <Icon name="chevron-left" size={16} color="text-muted" />
        </Pressable>
      ))}
      {LIVE && next ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.navigate('Plan')}
          style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 8,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Icon name="calendar" size={18} color="text-muted" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={13} lh={20} w={600}>
              {'فردا · ' + (next.rest ? 'استراحت' : next.focus || 'جلسه تمرین')}
            </Txt>
            <Txt size={12} lh={18} color="text-muted" numberOfLines={1}>
              {next.rest ? 'برنامه کامل هفته را ببین' : next.exercises.map((e: { name: string }) => e.name).join('، ')}
            </Txt>
          </View>
          <Txt size={12} lh={18} w={600} color="brand-primary-text">
            برنامه هفته
          </Txt>
          <Icon name="chevron-left" size={16} color="text-muted" />
        </Pressable>
      ) : null}
      {LIVE && food?.meals.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.navigate('Tabs', { screen: 'Nutrition' })}
          style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 8,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Icon name="utensils" size={18} color="text-muted" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={13} lh={20} w={600}>
              {'فردا · تغذیه · ' + faDigits(food.meals.length) + ' وعده، ' + faNumber(food.meals.reduce((a, m) => a + m.kcal, 0)) + ' کالری'}
            </Txt>
            <Txt size={12} lh={18} color="text-muted" numberOfLines={1}>
              {food.meals.map((m) => m.meal).join('، ')}
            </Txt>
          </View>
          <Txt size={12} lh={18} w={600} color="brand-primary-text">
            منو
          </Txt>
          <Icon name="chevron-left" size={16} color="text-muted" />
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {tiles.map((t) => (
          <Pressable
            key={t.label}
            accessibilityRole="button"
            onPress={t.go}
            style={{ flex: 1, minWidth: 0, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 14, gap: 6 }}
          >
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name={t.icon} size={16} color="text-muted" />
              <Txt size={13} lh={20} w={500} color="text-muted">
                {t.label}
              </Txt>
            </View>
            <Txt size={22} lh={30} w={700}>
              {t.value}
            </Txt>
            <Txt size={12} lh={18} color="text-muted">
              {t.sub}
            </Txt>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Txt size={16} lh={24} w={600} style={{ flex: 1 }} accessibilityRole="header">
            پیشرفت اخیر
          </Txt>
          <Pressable accessibilityRole="link" onPress={() => nav.navigate('Tabs', { screen: 'Progress' })} hitSlop={8}>
            <Txt size={14} lh={22} w={500} color="brand-primary-text">
              همه
            </Txt>
          </Pressable>
        </View>
        {!LIVE ? (
          <PRCard exercise="پرس سینه" type="حداکثر ۸ تکرار · امروز" value="۶۷٫۵" unit="kg" previous="۶۵ kg" delta={3.8} isNew onPress={() => nav.navigate('Records')} />
        ) : pr ? (
          <PRCard
            exercise={pr.ex}
            type={pr.type + ' · ' + pr.date}
            value={faNumber(pr.v)}
            unit={pr.u}
            previous={pr.p != null ? faNumber(pr.p) + ' ' + pr.u : undefined}
            delta={pr.p != null ? pr.d : undefined}
            isNew={pr.isNew}
            onPress={() => nav.navigate('Records')}
          />
        ) : null}
        {LIVE && !weighIns.length ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => nav.navigate('Measure', { tab: 'hist' })}
            style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 14, flexDirection: 'row', gap: 16, alignItems: 'center' }}
          >
            <View style={{ gap: 2 }}>
              <Txt size={12} lh={18} color="text-muted">
                {'وزن بدن · ' + (LIVE ? weighIns[0].date : '۳۰ شهریور')}
              </Txt>
              <Txt size={20} lh={28} w={700}>
                {(LIVE ? faNumber(weighIns[0].v.w as number) : '۸۲٫۴') + ' '}
                <Txt size={13} lh={28} w={500} color="text-muted">
                  kg
                </Txt>
              </Txt>
            </View>
            <View style={{ flex: 1 }} />
            {!LIVE ? (
              <TrendIndicator value={0.5} unit="kg" goodDirection="none" label="این هفته" />
            ) : weighIns[1] ? (
              <TrendIndicator value={+((weighIns[0].v.w as number) - (weighIns[1].v.w as number)).toFixed(1)} unit="kg" goodDirection="none" label="از قبلی" />
            ) : null}
          </Pressable>
        )}
      </View>
    </Screen>
  );
}
