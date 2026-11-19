import { faDigits, faNumber } from '@baseline/core';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Divider, Icon, Txt, type IconRef } from './primitives';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info' | 'record';

function toneColors(c: Record<string, string>, tone: Tone): { bg: string; fg: string } {
  switch (tone) {
    case 'brand':
      return { bg: c['brand-primary-subtle'], fg: c['brand-primary-text'] };
    case 'neutral':
      return { bg: c['surface-sunken'], fg: c['text-secondary'] };
    default:
      return { bg: c[tone + '-subtle'], fg: c[tone] };
  }
}

const STATUS: Record<string, { tone: Tone; icon: IconRef; label: string }> = {
  'in-progress': { tone: 'brand', icon: 'circle-half', label: 'در حال انجام' },
  completed: { tone: 'success', icon: 'check-circle', label: 'انجام‌شده' },
  planned: { tone: 'neutral', icon: 'circle', label: 'برنامه‌ریزی‌شده' },
  missed: { tone: 'error', icon: 'x-circle', label: 'ازدست‌رفته' },
  rest: { tone: 'neutral', icon: 'moon', label: 'روز استراحت' },
};

export function Badge({ children, tone, icon, status, size = 'sm' }: { children?: ReactNode; tone?: Tone; icon?: IconRef; status?: keyof typeof STATUS; size?: 'sm' | 'md' }) {
  const { c } = useTheme();
  const S = status ? STATUS[status] : null;
  const t = tone ?? S?.tone ?? 'neutral';
  const { bg, fg } = toneColors(c, t);
  const ic = icon ?? S?.icon;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: size === 'sm' ? 4 : 5,
        height: size === 'sm' ? 20 : 24,
        paddingHorizontal: size === 'sm' ? 6 : 8,
        borderRadius: 4,
        backgroundColor: bg,
        alignSelf: 'flex-start',
      }}
    >
      {ic ? <Icon name={ic} size={size === 'sm' ? 12 : 14} stroke={2} color={fg} /> : null}
      <Txt size={size === 'sm' ? 12 : 13} lh={16} w={500} color={fg}>
        {children ?? S?.label}
      </Txt>
    </View>
  );
}

export function ProgressBar({
  label,
  value,
  max = 100,
  valueLabel,
  size = 'md',
  tone,
}: {
  label?: ReactNode;
  value: number;
  max?: number;
  valueLabel?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: string;
}) {
  const { c } = useTheme();
  const pct = max ? Math.max(0, Math.min(value, max)) / max : 0;
  return (
    <View style={{ gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      {label || valueLabel ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Txt size={13} lh={16} color="text-secondary">
            {label}
          </Txt>
          <Txt size={13} lh={16} w={500}>
            {valueLabel ?? faDigits(Math.round(pct * 100)) + '٪'}
          </Txt>
        </View>
      ) : null}
      <View style={{ height: size === 'lg' ? 10 : size === 'sm' ? 4 : 6, borderRadius: 999, backgroundColor: c['surface-sunken'], overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 999, backgroundColor: tone ? c[tone] : c['brand-primary-text'] }} />
      </View>
    </View>
  );
}

/** Labelled value; missing data renders «ثبت نشده» — never a fabricated value. */
export function ValueDisplay({ label, value, unit, icon }: { label: ReactNode; value?: ReactNode; unit?: ReactNode; icon?: IconRef }) {
  const empty = value == null || value === '';
  return (
    <View style={{ gap: 2, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={14} color="text-muted" /> : null}
        <Txt size={12} lh={16} w={500} color="text-muted">
          {label}
        </Txt>
      </View>
      {empty ? (
        <Txt size={14} lh={24} italic color="text-muted">
          ثبت نشده
        </Txt>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
          <Txt size={16} lh={24} w={600}>
            {value}
          </Txt>
          {unit ? (
            <Txt size={13} lh={16} w={500} color="text-muted">
              {unit}
            </Txt>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Signed change: green when it moves in the good direction, red otherwise, neutral when none. */
export function TrendIndicator({
  value,
  unit = '%',
  goodDirection = 'up',
  label,
  size = 'md',
}: {
  value: number;
  unit?: string;
  goodDirection?: 'up' | 'down' | 'none';
  label?: string;
  size?: 'sm' | 'md';
}) {
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const tone = dir === 'flat' || goodDirection === 'none' ? 'text-secondary' : dir === goodDirection ? 'success' : 'error';
  const txt = (value > 0 ? '+' : value < 0 ? '−' : '±') + faNumber(Math.abs(value), 1) + (unit === '%' ? '٪' : unit ? ' ' + unit : '');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Icon name={dir === 'up' ? 'arrow-up-right' : dir === 'down' ? 'arrow-down-right' : 'arrow-right'} size={size === 'sm' ? 12 : 14} stroke={2.25} color={tone} />
      <Txt size={size === 'sm' ? 12 : 13} lh={16} w={600} color={tone}>
        {txt}
      </Txt>
      {label ? (
        <Txt size={size === 'sm' ? 12 : 13} lh={16} color="text-muted" style={{ marginStart: 4 }}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

/** Bordered group of `ListRow`s with dividers between them. */
export function ListGroup({ children }: { children?: ReactNode }) {
  const { c } = useTheme();
  const kids = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surface }}>
      {kids.map((k, i) => (
        <Fragment key={i}>
          {i > 0 ? <Divider color="border-subtle" /> : null}
          {k}
        </Fragment>
      ))}
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  danger,
  chevron = true,
  iconColor,
  thumb,
}: {
  icon?: IconRef;
  /** A picture in place of the icon (e.g. the exercise's thumbnail). */
  thumb?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  iconColor?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: pressed && onPress ? c['surface-sunken'] : c.surface,
      })}
    >
      {thumb ?? null}
      {icon && !thumb ? (
        <View style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: c['surface-sunken'], alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={danger ? 'error' : (iconColor ?? 'text-secondary')} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={15} lh={22} w={500} color={danger ? 'error' : 'text-primary'}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt size={13} lh={18} color="text-muted">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt size={14} lh={20} color="text-secondary">
          {value}
        </Txt>
      ) : null}
      {chevron ? <Icon name="chevron-left" size={18} color="text-muted" /> : null}
    </Pressable>
  );
}

const TONE_ICON: Record<Tone, IconRef> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
  record: 'trophy',
  neutral: 'info',
  brand: 'info',
};

export function Banner({ tone = 'info', title, description, icon }: { tone?: Tone; title?: ReactNode; description?: ReactNode; icon?: IconRef }) {
  const { c } = useTheme();
  const { bg, fg } = toneColors(c, tone);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: tone === 'neutral' ? c.surface : bg,
        borderWidth: tone === 'neutral' ? 1 : 0,
        borderColor: c.border,
      }}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
    >
      <View style={{ paddingTop: 1 }}>
        <Icon name={icon ?? TONE_ICON[tone]} size={18} stroke={2} color={fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <Txt size={14} lh={20} w={600}>
            {title}
          </Txt>
        ) : null}
        {description ? (
          <Txt size={13} lh={20} color="text-secondary">
            {description}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('');
}

const AVATAR = { sm: [32, 12], md: [40, 13], lg: [48, 16], xl: [64, 20] } as const;

export function Avatar({ name, uri, size = 'md' }: { name: string; uri?: string | null; size?: keyof typeof AVATAR }) {
  const { c } = useTheme();
  const [d, fs] = AVATAR[size];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: c['surface-sunken'],
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: d, height: d }} />
      ) : (
        <Txt size={fs} lh={fs + 4} w={600} color="text-secondary">
          {initialsOf(name)}
        </Txt>
      )}
    </View>
  );
}

/** Coach brand: initials tile on the primary color with the secondary bar (or an uploaded logo). */
export function BrandMark({
  name,
  initials,
  logo,
  size = 'md',
  inverse,
  showName = true,
}: {
  name: string;
  initials: string;
  logo?: string;
  size?: 'sm' | 'md' | 'lg';
  inverse?: boolean;
  showName?: boolean;
}) {
  const { c } = useTheme();
  const tile = size === 'lg' ? 56 : size === 'sm' ? 32 : 36;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: tile,
          height: tile,
          borderRadius: size === 'lg' ? 8 : 6,
          backgroundColor: logo ? c.surface : c['brand-primary'],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {logo ? (
          <Image source={{ uri: logo }} style={{ width: tile, height: tile }} resizeMode="contain" />
        ) : (
          <>
            <Txt size={size === 'lg' ? 20 : size === 'sm' ? 12 : 14} lh={size === 'lg' ? 24 : 16} w={600} color="on-brand-primary" ltr>
              {initials}
            </Txt>
            <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, height: size === 'lg' ? 6 : 4, backgroundColor: c['brand-secondary'] }} />
          </>
        )}
      </View>
      {showName ? (
        <Txt size={size === 'lg' ? 20 : 15} lh={size === 'lg' ? 28 : 20} w={600} color={inverse ? '#FFFFFF' : 'text-primary'} ltr>
          {name}
        </Txt>
      ) : null}
    </View>
  );
}

export function DescriptionList({ items }: { items: Array<{ label: string; value?: string | null }> }) {
  return (
    <View style={{ gap: 16 }}>
      {items.map((it) => (
        <View key={it.label} style={{ gap: 2 }}>
          <Txt size={12} lh={16} w={500} color="text-muted">
            {it.label}
          </Txt>
          {it.value ? (
            <Txt size={14} lh={22}>
              {it.value}
            </Txt>
          ) : (
            <Txt size={14} lh={22} italic color="text-muted">
              ارائه نشده
            </Txt>
          )}
        </View>
      ))}
    </View>
  );
}

/** Private health data block: shield, access note, "restricted" badge and an audit footer. */
export function SensitiveSection({ title, accessNote, footer, children }: { title: string; accessNote: string; footer?: string; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, overflow: 'hidden' }}>
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
          paddingVertical: 16,
          paddingHorizontal: 20,
          backgroundColor: c.background,
          borderBottomWidth: 1,
          borderBottomColor: c['border-subtle'],
        }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="shield" size={18} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={16} lh={24} w={600}>
            {title}
          </Txt>
          <Txt size={13} lh={20} color="text-muted">
            {accessNote}
          </Txt>
        </View>
        <Badge tone="neutral" icon="lock">
          محدود
        </Badge>
      </View>
      <View style={{ padding: 20, gap: 16 }}>{children}</View>
      {footer ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: c['border-subtle'] }}>
          <Icon name="history" size={14} color="text-muted" />
          <Txt size={12} lh={16} color="text-muted">
            {footer}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** Centered icon + title + description for empty and loading states (live data). */
export function EmptyState({ icon, title, description, children }: { icon: IconRef; title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c['surface-sunken'], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color="text-muted" />
      </View>
      <Txt size={18} lh={28} w={600} align="center" accessibilityRole="header">
        {title}
      </Txt>
      {description ? (
        <Txt size={14} lh={22} color="text-secondary" align="center">
          {description}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}
