// Design: project/M36 Athlete Todays Workout.dc.html
import { bandLabel, faDigits, faNumber, faJoin } from '@baseline/core';
import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { LIVE } from '../api/config';
import { byTime, EXERCISES, finishWorkout, SESSION, stats, workout } from '../data/workout';
import { useNav } from '../navigation/types';
import { SessionPicker } from './SessionPicker';
import { useTrainingRefresh } from './useTrainingRefresh';
import { Button, EmptyState, ExerciseImage, Footer, Icon, ListGroup, ListRow, MobileHeader, Modal, ProgressBar, Screen, Surface, Txt, ValueDisplay } from '../ui';

export function WorkoutScreen() {
  const nav = useNav();
  const w = workout.use();
  const { c } = useTheme();
  const st = stats(w);
  const [confirm, setConfirm] = useState(false);
  // #64: a finished session is closed — a summary with «ویرایش تمرین»; editing reopens the sets.
  const [editing, setEditing] = useState(false);
  const refresh = useTrainingRefresh();
  const scrollProps = LIVE ? { refreshControl: refresh } : undefined;
  const open = (e: number) => nav.navigate('Log', { e });
  const doFinish = () => {
    setConfirm(false);
    finishWorkout();
    nav.navigate('Complete');
  };
  if (LIVE && (!w.loaded || !EXERCISES.length))
    return (
      <Screen
        scrollProps={scrollProps}
        header={
          <MobileHeader
            title="تمرین امروز"
            back="خانه"
            onBack={() => nav.navigate('Tabs', { screen: 'Home' })}
            actions={w.loaded ? [{ icon: 'calendar', label: 'برنامه هفته', onPress: () => nav.navigate('Plan') }] : []}
          />
        }
      >
        <SessionPicker />
        <EmptyState
          icon={w.loaded ? 'moon' : 'clock'}
          title={!w.loaded ? 'در حال بارگذاری…' : SESSION.program === 'بدون برنامه' ? 'هنوز برنامه‌ای نداری' : 'امروز روز استراحت است'}
          description={
            !w.loaded ? undefined : SESSION.program === 'بدون برنامه' ? 'مربی‌ات به‌زودی برنامه تمرینی را برایت می‌فرستد.' : 'ریکاوری بخشی از پیشرفت است. چک‌این صبح را فراموش نکن.'
          }
        >
          {w.loaded && SESSION.program !== 'بدون برنامه' ? (
            <Button variant="secondary" icon="calendar" onPress={() => nav.navigate('Plan')}>
              برنامه روزهای بعد
            </Button>
          ) : null}
        </EmptyState>
      </Screen>
    );
  if (w.finished && !editing) {
    const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
    return (
      <Screen
        scrollProps={scrollProps}
        header={
          <MobileHeader
            title="تمرین امروز"
            back="خانه"
            onBack={() => nav.navigate('Tabs', { screen: 'Home' })}
            actions={[{ icon: 'calendar', label: 'برنامه هفته', onPress: () => nav.navigate('Plan') }]}
          />
        }
        footer={
          <Footer>
            <Button variant="secondary" size="lg" fullWidth icon="edit" onPress={() => setEditing(true)}>
              ویرایش تمرین
            </Button>
          </Footer>
        }
      >
        <SessionPicker />
        <Surface>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="check-circle" size={28} color="success" />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={18} lh={28} w={700}>
                تمرین امروز ثبت شد
              </Txt>
              <Txt size={12} lh={18} color="text-muted">
                {faJoin([SESSION.title, 'هفته ' + faDigits(SESSION.week), SESSION.program])}
              </Txt>
            </View>
          </View>
          <ProgressBar
            label="ست‌های انجام‌شده"
            value={st.done}
            max={st.total || 1}
            size="lg"
            valueLabel={faJoin([faDigits(st.done) + ' از ' + faDigits(st.total), '٪' + faDigits(pct)])}
          />
          <View style={{ flexDirection: 'row', gap: 32 }}>
            <ValueDisplay label="حجم کل" value={faNumber(Math.round(st.vol), 0)} unit="kg" />
            {w.rpe ? <ValueDisplay label="سختی (RPE)" value={faDigits(w.rpe)} unit="از ۱۰" /> : null}
          </View>
          <Txt size={12} lh={18} color="text-muted">
            اگر ستی را اشتباه ثبت کردی، «ویرایش تمرین» را بزن. مربی نسخه‌ی نهایی را می‌بیند.
          </Txt>
        </Surface>
        {w.feedback?.length ? (
          <Surface padding={14} gap={8}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="chat" size={16} color="brand-primary-text" />
              <Txt size={13} lh={20} w={600}>
                بازخورد مربی
              </Txt>
            </View>
            {w.feedback.map((f, i) => (
              <Txt key={i} size={14} lh={24}>
                {f}
              </Txt>
            ))}
          </Surface>
        ) : null}
        <ListGroup>
          {EXERCISES.map((e, i) => {
            const n = (w.logs[i] || []).length;
            return (
              <ListRow
                key={e.id}
                icon={n >= e.sets ? 'check-circle' : n ? 'circle-half' : 'x-circle'}
                iconColor={n >= e.sets ? 'success' : n ? 'brand-primary-text' : 'text-muted'}
                title={e.name}
                value={faDigits(n) + '/' + faDigits(e.sets)}
                chevron={false}
              />
            );
          })}
        </ListGroup>
      </Screen>
    );
  }
  return (
    <>
      <Screen
        scrollProps={scrollProps}
        header={
          <MobileHeader
            title={editing ? 'ویرایش تمرین' : 'تمرین امروز'}
            back="خانه"
            onBack={() => nav.navigate('Tabs', { screen: 'Home' })}
            actions={[
              { icon: 'calendar', label: 'برنامه هفته', onPress: () => nav.navigate('Plan') },
              { icon: 'play', label: 'ویدیوی حرکت فعلی', onPress: () => nav.navigate('Exercise', { e: Math.max(0, st.cur) }) },
            ]}
          />
        }
        footer={
          <Footer>
            {st.cur > -1 ? (
              <Button size="lg" fullWidth iconRight="arrow-left" onPress={() => open(st.cur)}>
                {'ادامه: ' + EXERCISES[st.cur].name}
              </Button>
            ) : null}
            {editing ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                icon="check"
                onPress={() => {
                  finishWorkout(w.rpe); // recount completed / partial with the edited sets
                  setEditing(false);
                }}
              >
                ذخیره تغییرات
              </Button>
            ) : (
              <Button variant={st.cur > -1 ? 'ghost' : 'primary'} size="lg" fullWidth onPress={() => (st.cur > -1 ? setConfirm(true) : doFinish())}>
                پایان تمرین
              </Button>
            )}
          </Footer>
        }
      >
        <SessionPicker />
        <Surface>
          <View style={{ gap: 2 }}>
            <Txt size={18} lh={28} w={700}>
              {SESSION.title}
            </Txt>
            <Txt size={12} lh={18} color="text-muted">
              {faJoin(['هفته ' + faDigits(SESSION.week), 'روز ' + faDigits(SESSION.day), SESSION.program])}
            </Txt>
          </View>
          <ProgressBar
            label="پیشرفت"
            value={st.done}
            max={st.total}
            size="lg"
            valueLabel={faJoin([faDigits(st.done) + ' از ' + faDigits(st.total) + ' ست', '٪' + faDigits(Math.round((st.done / st.total) * 100))])}
          />
          <View style={{ flexDirection: 'row', gap: 32 }}>
            <ValueDisplay label="حجم تا الان" value={faNumber(Math.round(st.vol), 0)} unit="kg" />
            <ValueDisplay label="زمان برنامه" value={'~' + faDigits(SESSION.minutes)} unit="دقیقه" />
          </View>
        </Surface>
        <View style={{ gap: 8 }}>
          <Txt size={12} lh={18} w={600} color="text-muted">
            حرکات · برای ثبت ست روی هر حرکت بزن
          </Txt>
          {byTime(EXERCISES).map((g) => (
            <View key={g.label || 'all'} style={{ gap: 6 }}>
              {g.label ? (
                <Txt size={14} lh={20} w={700} color="brand-primary-text" accessibilityRole="header">
                  {g.label}
                </Txt>
              ) : null}
              <ListGroup>
                {g.items.map(({ e, i }) => {
                  const n = (w.logs[i] || []).length;
                  const full = n >= e.sets;
                  return (
                    <ListRow
                      key={e.id}
                      icon={full ? 'check-circle' : n ? 'circle-half' : 'circle'}
                      iconColor={full ? 'success' : n ? 'brand-primary-text' : undefined}
                      thumb={
                        <View>
                          <ExerciseImage src={e.image} name={e.name} size={56} />
                          {n ? (
                            <View
                              style={{
                                position: 'absolute',
                                bottom: -4,
                                end: -4,
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: c.surface,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon name={full ? 'check-circle' : 'circle-half'} size={18} color={full ? 'success' : 'brand-primary-text'} />
                            </View>
                          ) : null}
                        </View>
                      }
                      title={e.name}
                      subtitle={faJoin([
                        faDigits(e.sets) + ' × ' + e.reps,
                        e.unit === 'band' ? bandLabel(e.w) : faNumber(e.w) + ' kg',
                        'استراحت ' + faDigits(e.rest) + ' ثانیه',
                        n > 0 && !full && 'در حال انجام',
                      ])}
                      value={faDigits(n) + '/' + faDigits(e.sets)}
                      onPress={() => open(i)}
                    />
                  );
                })}
              </ListGroup>
            </View>
          ))}
        </View>
        <Surface padding={14} gap={6}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="file-text" size={16} color="text-muted" />
            <Txt size={13} lh={20} w={500} color="text-muted">
              یادداشت مربی
            </Txt>
          </View>
          <Txt size={14} lh={24} color="text-secondary">
            {SESSION.coachNote}
          </Txt>
        </Surface>
      </Screen>
      <Modal
        open={confirm}
        title="تمرین را تمام می‌کنی؟"
        description={faDigits(st.total - st.done) + ' ست باقی مانده است. ست‌های انجام‌نشده «رد شده» ثبت می‌شوند و مربی آن را می‌بیند.'}
        primaryLabel="پایان تمرین"
        secondaryLabel="ادامه تمرین"
        onPrimary={doFinish}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
