import { BAND_LEVELS, faClock, faDigits, faJoin, faNumber, parseFaNumber } from '@baseline/core';
import { createElement, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Image, Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { fontFamily, useTheme } from '../theme';
import { Button, SegmentedControl } from './controls';
import { Badge, ProgressBar, TrendIndicator } from './display';
import { Icon, MAX_FONT_SCALE, Txt } from './primitives';

/** Today's workout card (`variant="hero"` on Home). */
export function WorkoutCard({
  eyebrow,
  title,
  meta,
  status = 'in-progress',
  done,
  total,
  ctaLabel,
  onCta,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  status?: 'in-progress' | 'completed' | 'planned';
  done: number;
  total: number;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? (
            <Txt size={12} lh={16} w={500} color="text-muted" style={{ marginBottom: 2 }}>
              {eyebrow}
            </Txt>
          ) : null}
          <Txt size={22} lh={28} w={600}>
            {title}
          </Txt>
          {meta ? (
            <Txt size={13} lh={20} color="text-muted">
              {meta}
            </Txt>
          ) : null}
        </View>
        <Badge status={status} />
      </View>
      <ProgressBar
        label="پیشرفت"
        value={done}
        max={total}
        size="lg"
        valueLabel={faJoin([faDigits(done) + ' از ' + faDigits(total) + ' ست', '٪' + faDigits(Math.round((done / Math.max(1, total)) * 100))])}
      />
      {ctaLabel ? (
        <Button size="lg" fullWidth iconRight="arrow-left" onPress={onCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </View>
  );
}

/** Personal-record card; `isNew` adds the gold outline and «رکورد جدید» badge. */
export function PRCard({
  exercise,
  type,
  value,
  unit,
  previous,
  delta,
  lowerIsBetter,
  isNew,
  onPress,
}: {
  exercise: string;
  type?: string;
  value: string;
  unit?: string;
  previous?: string;
  delta?: number;
  lowerIsBetter?: boolean;
  isNew?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
        backgroundColor: c.surface,
        borderWidth: isNew ? 2 : 1,
        borderColor: isNew ? c['record-strong'] : c.border,
        borderRadius: 8,
        padding: isNew ? 11 : 12,
      }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: c['record-subtle'], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="trophy" size={18} color="record" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt size={14} lh={20} w={600}>
            {exercise}
          </Txt>
          {isNew ? <Badge tone="record">رکورد جدید</Badge> : null}
        </View>
        {type ? (
          <Txt size={12} lh={16} color="text-muted">
            {type}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
          <Txt size={18} lh={24} w={600}>
            {value}
          </Txt>
          {unit ? (
            <Txt size={13} lh={16} w={500} color="text-muted">
              {unit}
            </Txt>
          ) : null}
        </View>
        {previous ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 }}>
            <Txt size={12} lh={16} color="text-muted">
              {'قبلی ' + previous}
            </Txt>
            {delta != null ? <TrendIndicator value={delta} goodDirection={lowerIsBetter ? 'down' : 'up'} size="sm" /> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export type MealStatus = 'followed' | 'partial' | 'skipped' | 'unlogged';

/** A meal from the coach's plan with "did you follow it?" logging. */
export function MealCard({
  meal,
  time,
  items,
  macros,
  status,
  onChange,
}: {
  meal: string;
  time?: string;
  items: string;
  macros?: string;
  status: MealStatus;
  onChange: (s: MealStatus) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Txt size={15} lh={22} w={600}>
          {meal}
        </Txt>
        {time ? (
          <Txt size={13} lh={22} color="text-muted">
            {time}
          </Txt>
        ) : null}
      </View>
      <Txt size={15} lh={22}>
        {items}
      </Txt>
      {macros ? (
        <Txt size={13} lh={20} color="text-muted">
          {macros}
        </Txt>
      ) : null}
      <View style={{ marginTop: 8 }}>
        <SegmentedControl
          fullWidth
          label={'رعایت ' + meal}
          value={status === 'unlogged' ? undefined : status}
          onChange={(v) => onChange(v as MealStatus)}
          options={[
            { value: 'followed', label: 'رعایت شد' },
            { value: 'partial', label: 'تا حدی' },
            { value: 'skipped', label: 'رد شد' },
          ]}
        />
      </View>
    </View>
  );
}

export function MacroSummary({ items }: { items: Array<{ label: string; value: number | null; target: number; unit: string }> }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {items.map((r) => (
        <View key={r.label} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Txt size={13} lh={18} w={500} color="text-secondary">
              {r.label}
            </Txt>
            {r.value == null ? (
              <Txt size={13} lh={18} italic color="text-muted">
                ثبت نشده
              </Txt>
            ) : (
              <Txt size={13} lh={18} w={600}>
                {faNumber(r.value, 0)}
                <Txt size={13} lh={18} color="text-muted">
                  {' / ' + faNumber(r.target, 0) + ' ' + r.unit}
                </Txt>
              </Txt>
            )}
          </View>
          <View style={{ height: 6, borderRadius: 999, backgroundColor: c['surface-sunken'], overflow: 'hidden' }}>
            {r.value != null ? (
              <View style={{ width: `${Math.min(100, (r.value / r.target) * 100)}%`, height: '100%', borderRadius: 999, backgroundColor: c['brand-primary-text'] }} />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export type SetState = 'pending' | 'active' | 'done';

/** Header row for `SetRow` columns: set · previous · kg · reps · done. */
export function SetRowHeader({ unit = 'kg' }: { unit?: string }) {
  const cols: Array<[string, number | undefined]> = [
    ['ست', 32],
    ['قبلی', undefined],
    [unit, 76],
    ['تکرار', 64],
    ['انجام شد', 48],
  ];
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, paddingHorizontal: 8 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {cols.map(([t, w], i) => (
        <Txt key={i} size={12} lh={16} w={500} color="text-muted" align={i >= 2 ? 'center' : undefined} style={w ? { width: w } : { flex: 1 }}>
          {t}
        </Txt>
      ))}
    </View>
  );
}

/**
 * One set in the logger. Targets are prefilled: tick if done as prescribed, edit only if different.
 */
export function SetRow({
  index,
  previous,
  weight,
  reps,
  state,
  isPR,
  onWeight,
  onReps,
  onToggle,
  band,
}: {
  index: number;
  previous: string;
  weight: string;
  reps: string;
  state: SetState;
  isPR?: boolean;
  /** Band exercise: the weight cell is the band level (1 yellow … 5 black); tapping moves to the next one. */
  band?: boolean;
  onWeight: (v: string) => void;
  onReps: (v: string) => void;
  onToggle: () => void;
}) {
  const { c } = useTheme();
  const active = state === 'active';
  const done = state === 'done';
  const input = {
    width: '100%' as const,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: done ? 'transparent' : c['border-strong'],
    backgroundColor: done ? 'transparent' : c.surface,
    textAlign: 'center' as const,
    fontFamily: fontFamily[600],
    fontSize: 18,
    color: c['text-primary'],
    padding: 0,
  };
  return (
    <View
      accessibilityLabel={'ست ' + faDigits(index) + (done ? '، انجام شد' : '')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 60,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: active ? c['brand-primary-subtle'] : done ? c.background : 'transparent',
        borderWidth: active ? 1.5 : 0,
        borderColor: c['brand-primary-text'],
      }}
    >
      <View style={{ width: 32, alignItems: 'center' }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: active ? c['brand-primary-text'] : c['surface-sunken'],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt size={13} lh={16} w={600} color={active ? c.surface : 'text-secondary'}>
            {faDigits(index)}
          </Txt>
        </View>
      </View>
      <Txt size={14} lh={20} color="text-muted" numberOfLines={1} style={{ flex: 1 }}>
        {previous}
      </Txt>
      <View style={{ width: 76 }}>
        {band ? (
          <BandCell index={index} level={parseFaNumber(weight) ?? 0} done={done} onLevel={(l) => onWeight(faDigits(l))} />
        ) : (
          <TextInput
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={'وزنه ست ' + faDigits(index)}
            value={weight}
            onChangeText={onWeight}
            keyboardType="decimal-pad"
            editable={!done}
            style={input}
          />
        )}
      </View>
      <View style={{ width: 64 }}>
        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={'تکرار ست ' + faDigits(index)}
          value={reps}
          onChangeText={onReps}
          keyboardType="number-pad"
          editable={!done}
          style={input}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: done }}
        accessibilityLabel={done ? 'انجام شد، برای بازگردانی بزنید' : 'ثبت ست ' + faDigits(index)}
        onPress={onToggle}
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: done ? c['brand-primary-text'] : c['border-strong'],
          backgroundColor: done ? c['brand-primary'] : c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="check" size={20} stroke={2.25} color={done ? 'on-brand-primary' : 'text-muted'} />
      </Pressable>
      {isPR ? (
        <View
          style={{
            position: 'absolute',
            top: -6,
            start: 40,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            height: 18,
            paddingHorizontal: 6,
            borderRadius: 4,
            backgroundColor: c['record-subtle'],
            borderWidth: 1,
            borderColor: c['record-strong'],
          }}
        >
          <Icon name="trophy" size={12} stroke={2} color="record" />
          <Txt size={11} lh={16} w={600} color="record">
            رکورد
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** True while the phone asks for less motion (the exercise pictures then stay still). */
function useReduceMotion(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((r) => live && setStill(r));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setStill);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return still;
}

/**
 * Exercise picture (the coach's own, or the library illustration). With a start pose it alternates
 * start ↔ end every 1.2 s so the movement reads at a glance; still when reduce motion is on.
 * `size` makes a square thumbnail; without it the picture fills the width (4:3).
 */
export function ExerciseImage({
  src,
  start,
  name,
  size,
  radius = 8,
  caption,
}: {
  src?: string | null;
  start?: string | null;
  name: string;
  size?: number;
  radius?: number;
  /** Show «شروع حرکت / پایان حرکت» under a full-width picture. */
  caption?: boolean;
}) {
  const { c } = useTheme();
  const still = useReduceMotion();
  const two = !!(src && start);
  const [end, setEnd] = useState(false);
  useEffect(() => {
    if (!two || still) return;
    const t = setInterval(() => setEnd((x) => !x), 1200);
    return () => clearInterval(t);
  }, [two, still]);
  const box = size ? { width: size, height: size } : { width: '100%' as const, aspectRatio: 4 / 3 };
  const uri = two && !end && !still ? start! : src;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ ...box, borderRadius: radius, overflow: 'hidden', backgroundColor: c['surface-sunken'], alignItems: 'center', justifyContent: 'center' }}>
        {uri ? (
          <Image
            source={{ uri }}
            accessibilityLabel={name + (two ? (end ? ' · پایان حرکت' : ' · شروع حرکت') : '')}
            resizeMode="contain"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Icon name="dumbbell" size={size ? Math.round(size / 2.4) : 32} color="text-muted" />
        )}
      </View>
      {caption && two ? (
        <Txt size={12} lh={18} color="text-muted" align="center">
          {still ? 'شروع و پایان حرکت' : end ? 'پایان حرکت' : 'شروع حرکت'}
        </Txt>
      ) : null}
    </View>
  );
}

/** Band level of a set: the band's colour and name; tap for the next level (wraps after black). */
function BandCell({ index, level, done, onLevel }: { index: number; level: number; done: boolean; onLevel: (l: number) => void }) {
  const { c } = useTheme();
  const b = BAND_LEVELS.find((x) => x.level === Math.round(level));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'شدت کش ست ' + faDigits(index) + ': ' + (b ? b.label : 'انتخاب نشده')}
      accessibilityHint="برای کش بعدی بزنید"
      disabled={done}
      onPress={() => onLevel(b ? (b.level % BAND_LEVELS.length) + 1 : 1)}
      style={{
        height: 48,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: done ? 'transparent' : c['border-strong'],
        backgroundColor: done ? 'transparent' : c.surface,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: b?.color || c['surface-sunken'], borderWidth: 1, borderColor: c.border }} />
      <Txt size={14} lh={20} w={600}>
        {b ? b.short : '—'}
      </Txt>
    </Pressable>
  );
}

/**
 * Exercise video (coach's own upload). With `src` (live mode) the web build plays it inline and phones
 * open it in the system player; without it playback is simulated (design review).
 */
export function VideoPlayer({ title, duration = '0:45', src }: { title: string; duration?: string; src?: string | null }) {
  const { c } = useTheme();
  if (src && Platform.OS === 'web')
    return (
      <View accessibilityLabel={'ویدیو: ' + title} style={{ borderRadius: 8, overflow: 'hidden', backgroundColor: c['surface-inverse'], aspectRatio: 16 / 9 }}>
        {createElement('video', { src, controls: true, playsInline: true, preload: 'metadata', title, style: { width: '100%', height: '100%', objectFit: 'contain' } })}
      </View>
    );
  if (src)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={'پخش ویدیو: ' + title}
        onPress={() => void Linking.openURL(src)}
        style={{ borderRadius: 8, overflow: 'hidden', backgroundColor: c['surface-inverse'], aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', paddingStart: 3 }}>
          <Icon name="play" size={26} color="text-primary" />
        </View>
        <Txt size={13} lh={20} w={500} color={c['text-inverse']} style={{ position: 'absolute', start: 16, top: 12 }}>
          {title}
        </Txt>
      </Pressable>
    );
  return <SimulatedVideo title={title} duration={duration} />;
}

function SimulatedVideo({ title, duration }: { title: string; duration: string }) {
  const { c } = useTheme();
  const [m, s] = duration.split(':').map(Number);
  const total = m * 60 + (s || 0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos((x) => (x + 0.25 >= total ? (setPlaying(false), total) : x + 0.25)), 250);
    return () => clearInterval(t);
  }, [playing, total]);
  const toggle = () => {
    if (!playing && pos >= total) setPos(0);
    setPlaying(!playing);
  };
  const inv = c['text-inverse'];
  return (
    <View accessibilityLabel={'ویدیو: ' + title} style={{ borderRadius: 8, overflow: 'hidden', backgroundColor: c['surface-inverse'], aspectRatio: 16 / 9 }}>
      <Pressable onPress={toggle} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {!playing ? (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', paddingStart: 3 }}>
            <Icon name="play" size={26} color="text-primary" />
          </View>
        ) : null}
        {!playing ? (
          <Txt size={13} lh={20} w={500} color={inv} style={{ position: 'absolute', start: 16, top: 12 }}>
            {title}
          </Txt>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 8, backgroundColor: 'rgba(0,0,0,.35)' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'توقف' : 'پخش'}
          onPress={toggle}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} color={inv} />
        </Pressable>
        <Txt size={12} lh={16} w={500} color={inv} ltr>
          {faClock(pos) + ' / ' + faClock(total)}
        </Txt>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.28)', flexDirection: 'row' }}>
          <View style={{ width: `${(pos / total) * 100}%`, height: '100%', borderRadius: 2, backgroundColor: inv }} />
        </View>
      </View>
    </View>
  );
}

export function Stat({ value, label, center }: { value: ReactNode; label: string; center?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c['surface-sunken'], borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, gap: 2, alignItems: center ? 'center' : undefined }}>
      {center ? (
        <>
          <Txt size={18} lh={26} w={700}>
            {value}
          </Txt>
          <Txt size={11} lh={16} color="text-muted">
            {label}
          </Txt>
        </>
      ) : (
        <>
          <Txt size={11} lh={16} color="text-muted">
            {label}
          </Txt>
          <Txt size={16} lh={24} w={700}>
            {value}
          </Txt>
        </>
      )}
    </View>
  );
}
