// Design: project/M37 Athlete Exercise Details.dc.html
import { bandLabel, faDigits, faNumber, illustrationNote, ISSUES, MUSCLES } from '@baseline/core';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { View } from 'react-native';
import { EXERCISES, isBand, type WorkoutExercise } from '../data/workout';
import { useNav, type RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { LIVE } from '../api/config';
import { Button, ExerciseImage, Footer, MobileHeader, Screen, Stat, Tag, Txt, VideoPlayer } from '../ui';

/** The picture under the coach's video (or alone), with the look-alike / band note. */
function ExercisePicture({ e }: { e: WorkoutExercise }) {
  if (!e.image) return null;
  const note = illustrationNote(e.illustrationMatch, e.badge);
  return (
    <View style={{ gap: 4 }}>
      <ExerciseImage src={e.image} start={e.imageStart} name={e.name} caption />
      {note ? (
        <Txt size={12} lh={18} color="text-muted" align="center">
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt size={15} lh={24} w={600} accessibilityRole="header">
        {title}
      </Txt>
      {children}
    </View>
  );
}

export function ExerciseScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Exercise'>>();
  const i = Math.min(EXERCISES.length - 1, Math.max(0, params?.e ?? 0));
  const e = EXERCISES[i];
  return (
    <Screen
      surface
      header={<MobileHeader title={e.name} back="تمرین" onBack={() => nav.goBack()} />}
      footer={
        <Footer>
          <Button size="lg" fullWidth icon="edit" onPress={() => nav.navigate('Log', { e: i })}>
            ثبت ست‌ها
          </Button>
        </Footer>
      }
    >
      {LIVE && !e.video ? null : <VideoPlayer title={'ویدیوی آموزشی ' + e.name} duration="0:45" src={e.video} />}
      <ExercisePicture e={e} />
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Tag>{e.cat}</Tag>
        <Tag>{e.eq}</Tag>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="ست × تکرار" value={faDigits(e.sets) + ' × ' + e.reps} />
        {isBand(e) ? <Stat label="شدت کش" value={bandLabel(e.w) || '—'} /> : <Stat label="وزنه هدف" value={faNumber(e.w) + ' kg'} />}
        <Stat label="استراحت" value={faDigits(e.rest) + ' ثانیه'} />
      </View>
      {e.steps?.length ? (
        <Section title="مراحل اجرا">
          {e.steps.map((t, k) => (
            <View key={k} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c['brand-primary-subtle'], alignItems: 'center', justifyContent: 'center' }}>
                <Txt size={12} lh={22} w={600} color="brand-primary-text">
                  {faDigits(k + 1)}
                </Txt>
              </View>
              <Txt size={14} lh={22} color="text-secondary" style={{ flex: 1 }}>
                {t}
              </Txt>
            </View>
          ))}
        </Section>
      ) : null}
      {e.cues.length ? (
        <Section title={e.steps?.length ? 'نکات و خطاهای رایج' : 'نکات اجرا'}>
          {e.cues.map((t, k) => (
            <View key={k} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Txt size={14} lh={22} color="brand-primary-text">
                •
              </Txt>
              <Txt size={14} lh={22} color="text-secondary" style={{ flex: 1 }}>
                {t}
              </Txt>
            </View>
          ))}
        </Section>
      ) : null}
      {e.musclesPrimary?.length || e.musclesSecondary?.length ? (
        <Section title="عضلات درگیر">
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(e.musclesPrimary || []).map((m) => (
              <Tag key={'p' + m} selected>
                {MUSCLES[m] || m}
              </Tag>
            ))}
            {(e.musclesSecondary || []).map((m) => (
              <Tag key={'s' + m}>{MUSCLES[m] || m}</Tag>
            ))}
          </View>
        </Section>
      ) : null}
      {e.issues?.length ? (
        <Section title="مناسب برای">
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {e.issues.map((m) => (
              <Tag key={m}>{ISSUES[m] || m}</Tag>
            ))}
          </View>
        </Section>
      ) : null}
      {e.note ? (
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 14, gap: 6 }}>
          <Txt size={13} lh={20} w={600} color="text-muted">
            یادداشت مربی برای تو
          </Txt>
          <Txt size={14} lh={24}>
            {e.note}
          </Txt>
        </View>
      ) : null}
      <View style={{ gap: 6 }}>
        <Txt size={15} lh={24} w={600}>
          دفعه قبل · ۲۴ شهریور
        </Txt>
        <Txt size={14} lh={22} color="text-secondary" mono ltr>
          {e.prev.map((p) => (isBand(e) ? bandLabel(p[0]).replace('کش ', '') : faNumber(p[0])) + '×' + faDigits(p[1])).join('   ')}
        </Txt>
      </View>
    </Screen>
  );
}
