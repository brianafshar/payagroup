import { faDigits, faNumber, parseFaNumber } from '@baseline/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';
import { fontFamily, makeStyles, useTheme } from '../theme';
import { Icon, MAX_FONT_SCALE, Txt, type IconRef } from './primitives';

/* ---------------- Button ---------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
const HEIGHT = { sm: 32, md: 40, lg: 48 } as const;

export interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconRef;
  iconRight?: IconRef;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ children, variant = 'primary', size = 'md', icon, iconRight, loading, disabled, fullWidth, onPress, accessibilityLabel, style }: ButtonProps) {
  const { c } = useTheme();
  const dis = !!disabled;
  const bg = { primary: c['brand-primary'], secondary: c.surface, ghost: 'transparent', destructive: c.error }[variant];
  const bgPressed = { primary: c['brand-primary-pressed'], secondary: c['surface-sunken'], ghost: c['border-subtle'], destructive: c['error-hover'] }[variant];
  const fg = dis ? c['text-disabled'] : { primary: c['on-brand-primary'], secondary: c['text-primary'], ghost: c['text-secondary'], destructive: c['on-error'] }[variant];
  const fs = size === 'lg' ? 16 : size === 'sm' ? 13 : 14;
  const is = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: dis, busy: !!loading }}
      disabled={dis || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: HEIGHT[size],
          paddingHorizontal: size === 'lg' ? 20 : size === 'sm' ? 12 : 16,
          borderRadius: 6,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: size === 'sm' ? 6 : 8,
          backgroundColor: dis && variant !== 'ghost' ? c['surface-sunken'] : pressed ? bgPressed : bg,
          borderWidth: 1,
          borderColor: variant === 'secondary' && !dis ? c.border : 'transparent',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={is} color={fg} /> : null}
      {children != null ? (
        <Txt size={fs} lh={size === 'lg' ? 24 : 20} w={500} color={fg} numberOfLines={1}>
          {children}
        </Txt>
      ) : null}
      {iconRight && !loading ? <Icon name={iconRight} size={is} color={fg} /> : null}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'ghost',
  size = 'md',
  disabled,
  dot,
}: {
  icon: IconRef;
  label: string;
  onPress?: () => void;
  variant?: 'ghost' | 'secondary' | 'primary';
  size?: 'sm' | 'md' | 'lg' | 'touch';
  disabled?: boolean;
  dot?: boolean;
}) {
  const { c } = useTheme();
  const dim = size === 'touch' ? 44 : HEIGHT[size];
  const bg = disabled
    ? variant === 'primary'
      ? c['surface-sunken']
      : 'transparent'
    : variant === 'primary'
      ? c['brand-primary']
      : variant === 'secondary'
        ? c.surface
        : 'transparent';
  const fg = disabled ? c['text-disabled'] : variant === 'primary' ? c['on-brand-primary'] : c['text-secondary'];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => ({
        width: dim,
        height: dim,
        borderRadius: size === 'touch' ? 999 : 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed && !disabled && variant !== 'primary' ? c['surface-sunken'] : bg,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: c.border,
      })}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : size === 'touch' ? 22 : size === 'lg' ? 22 : 18} color={fg} />
      {dot ? (
        <View style={{ position: 'absolute', top: 9, end: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: c.error, borderWidth: 2, borderColor: c.surface }} />
      ) : null}
    </Pressable>
  );
}

/* ---------------- Fields ---------------- */

function FieldLabel({ label, optional }: { label?: ReactNode; optional?: boolean }) {
  if (!label) return null;
  return (
    <Txt size={13} lh={16} w={500}>
      {label}
      {optional ? (
        <Txt size={13} lh={16} color="text-muted">
          {'  اختیاری'}
        </Txt>
      ) : null}
    </Txt>
  );
}

function FieldMessage({ error, hint }: { error?: ReactNode; hint?: ReactNode }) {
  if (error)
    return (
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
        <View style={{ marginTop: 1 }}>
          <Icon name="alert-circle" size={14} stroke={2} color="error" />
        </View>
        <Txt size={12} lh={16} color="error" style={{ flex: 1 }}>
          {error}
        </Txt>
      </View>
    );
  if (hint)
    return (
      <Txt size={12} lh={16} color="text-muted">
        {hint}
      </Txt>
    );
  return null;
}

export interface TextFieldProps {
  label?: ReactNode;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'text' | 'email' | 'password' | 'decimal' | 'numeric' | 'tel';
  suffix?: ReactNode;
  readOnly?: boolean;
  /** Left-to-right content (emails, phones). */
  ltr?: boolean;
  multiline?: boolean;
  accessibilityLabel?: string;
  onSubmitEditing?: () => void;
}

const KEYBOARD: Record<string, KeyboardTypeOptions> = { email: 'email-address', decimal: 'decimal-pad', numeric: 'number-pad', tel: 'phone-pad' };

/** Text input (controlled when `value` is passed). Password fields get a show/hide eye. */
export function TextField(p: TextFieldProps) {
  const { c } = useTheme();
  const [shown, setShown] = useState(false);
  const [focus, setFocus] = useState(false);
  const isPw = p.type === 'password';
  const h = p.multiline ? undefined : p.size === 'lg' ? 48 : p.size === 'sm' ? 32 : 40;
  const fs = p.size === 'lg' ? 16 : 14;
  return (
    <View style={{ gap: 6, minWidth: 0 }}>
      <FieldLabel label={p.label} optional={p.optional} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: p.multiline ? 'flex-start' : 'center',
          gap: 8,
          height: h,
          minHeight: p.multiline ? 88 : undefined,
          paddingHorizontal: 12,
          paddingVertical: p.multiline ? 8 : 0,
          borderRadius: 6,
          borderWidth: focus ? 1.5 : 1,
          borderColor: p.error ? c.error : focus ? c['focus-ring'] : p.readOnly ? c.border : c['border-strong'],
          backgroundColor: p.readOnly ? c['surface-sunken'] : c.surface,
        }}
      >
        <TextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          accessibilityLabel={p.accessibilityLabel ?? (typeof p.label === 'string' ? p.label : undefined)}
          value={p.value}
          onChangeText={p.onChange}
          placeholder={p.placeholder}
          placeholderTextColor={c['text-muted']}
          editable={!p.readOnly}
          secureTextEntry={isPw && !shown}
          keyboardType={KEYBOARD[p.type ?? ''] ?? 'default'}
          autoCapitalize={p.type === 'email' || isPw ? 'none' : 'sentences'}
          autoCorrect={!(p.type === 'email' || isPw)}
          autoComplete={p.type === 'email' ? 'email' : isPw ? 'password' : 'off'}
          multiline={p.multiline}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onSubmitEditing={p.onSubmitEditing}
          style={{
            flex: 1,
            minWidth: 0,
            height: p.multiline ? undefined : '100%',
            fontFamily: fontFamily[400],
            fontSize: fs,
            color: c['text-primary'],
            padding: 0,
            writingDirection: p.ltr ? 'ltr' : 'rtl',
            // LTR content (emails, phones) still sits at the right edge, as in the web design.
            ...(p.ltr ? { textAlign: 'right' as const } : null),
            textAlignVertical: p.multiline ? 'top' : 'center',
          }}
        />
        {p.suffix ? (
          <Txt size={14} color="text-muted">
            {p.suffix}
          </Txt>
        ) : null}
        {p.readOnly ? <Icon name="lock" size={14} color="text-muted" /> : null}
        {isPw ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'پنهان کردن رمز' : 'نمایش رمز'}
            onPress={() => setShown(!shown)}
            hitSlop={8}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={shown ? 'eye-off' : 'eye'} size={18} color="text-muted" />
          </Pressable>
        ) : null}
      </View>
      <FieldMessage error={p.error} hint={p.hint} />
    </View>
  );
}

/* ---------------- Choice controls ---------------- */

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  error,
}: {
  label?: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  error?: ReactNode;
}) {
  const { c } = useTheme();
  const on = !!checked;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        onPress={() => onChange?.(!on)}
        style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            marginTop: 1,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: error ? c.error : on ? c['brand-primary-text'] : c['border-strong'],
            backgroundColor: on ? c['brand-primary-text'] : c.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {on ? <Icon name="check" size={14} stroke={2.5} color={c.surface} /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={14} lh={20}>
            {label}
          </Txt>
          {description ? (
            <Txt size={13} lh={18} color="text-muted">
              {description}
            </Txt>
          ) : null}
        </View>
      </Pressable>
      <FieldMessage error={error} />
    </View>
  );
}

/** 40×24 switch with a check in the thumb (design system `Switch`). */
export function Switch({ label, description, checked, onChange }: { label?: ReactNode; description?: ReactNode; checked?: boolean; onChange?: (v: boolean) => void }) {
  const { c } = useTheme();
  const on = !!checked;
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={() => onChange?.(!on)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        {label ? (
          <Txt size={14} lh={20}>
            {label}
          </Txt>
        ) : null}
        {description ? (
          <Txt size={13} lh={18} color="text-muted">
            {description}
          </Txt>
        ) : null}
      </View>
      <View style={{ width: 40, height: 24, borderRadius: 12, backgroundColor: on ? c['brand-primary-text'] : c['border-strong'], justifyContent: 'center', paddingHorizontal: 3 }}>
        <View
          style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c.surface, alignSelf: on ? 'flex-start' : 'flex-end', alignItems: 'center', justifyContent: 'center' }}
        >
          {on ? <Icon name="check" size={12} stroke={2.5} color="brand-primary-text" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export interface SegOption {
  value: string;
  label: string;
  icon?: IconRef;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth,
  label,
}: {
  options: SegOption[];
  value?: string;
  onChange?: (v: string) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  label?: string;
}) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', padding: 2, gap: 2, backgroundColor: c['surface-sunken'], borderRadius: 6, alignSelf: fullWidth ? 'stretch' : 'flex-start' }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange?.(o.value)}
            style={{
              flex: fullWidth ? 1 : undefined,
              height: size === 'sm' ? 28 : size === 'lg' ? 44 : 32,
              paddingHorizontal: size === 'sm' ? 10 : 12,
              borderRadius: 4,
              flexDirection: 'row',
              gap: 6,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? c.surface : 'transparent',
              borderWidth: on ? 1 : 0,
              borderColor: c.border,
            }}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={on ? 'text-primary' : 'text-secondary'} /> : null}
            <Txt size={size === 'sm' ? 12 : size === 'lg' ? 15 : 13} lh={16} w={on ? 600 : 500} color={on ? 'text-primary' : 'text-secondary'}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pill filter chip (design system `Tag`, `variant="filter"` when `onPress` is given). */
export function Tag({ children, selected, onPress }: { children?: ReactNode; selected?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  const body = (
    <View
      style={{
        height: 28,
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? c['brand-primary-text'] : c.border,
        backgroundColor: selected ? c['brand-primary-subtle'] : c.surface,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
      }}
    >
      {selected && onPress ? <Icon name="check" size={14} stroke={2} color="brand-primary-text" /> : null}
      <Txt size={13} lh={16} w={500} color={selected ? 'brand-primary-text' : 'text-secondary'}>
        {children}
      </Txt>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/* ---------------- Numeric input ---------------- */

/** − value + stepper (DOM order kept: minus on the right in RTL, as designed) with a typed field (design system `NumberStepper`). */
export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  unit,
  size = 'lg',
}: {
  label?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  size?: 'md' | 'lg';
}) {
  const s = useStepperStyles();
  const [text, setText] = useState(faNumber(value, 2, false));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(faNumber(value, 2, false));
  }, [value]);
  const set = (n: number) => onChange(Math.min(max, Math.max(min, +n.toFixed(2))));
  const dim = size === 'md' ? 48 : 56;
  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <Txt size={13} lh={16} w={500}>
          {label}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={'کاهش ' + faDigits(step, true)}
          onPress={() => set(value - step)}
          style={({ pressed }) => [s.btn, { width: dim, height: dim }, pressed && s.pressed]}
        >
          <Icon name="minus" size={22} stroke={2} color="text-primary" />
        </Pressable>
        <View style={[s.val, { height: dim }]}>
          <TextInput
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={typeof label === 'string' ? label : 'مقدار'}
            value={text}
            keyboardType="decimal-pad"
            onFocus={() => (editing.current = true)}
            onBlur={() => {
              editing.current = false;
              setText(faNumber(value, 2, false));
            }}
            onChangeText={(t) => {
              setText(t);
              const n = parseFaNumber(t);
              if (n != null) set(n);
            }}
            style={[s.input, { fontSize: size === 'md' ? 22 : 28 }]}
          />
          {unit ? (
            <Txt size={14} lh={20} w={500} color="text-muted">
              {unit}
            </Txt>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={'افزایش ' + faDigits(step, true)}
          onPress={() => set(value + step)}
          style={({ pressed }) => [s.btn, { width: dim, height: dim }, pressed && s.pressed]}
        >
          <Icon name="plus" size={22} stroke={2} color="text-primary" />
        </Pressable>
      </View>
    </View>
  );
}
const useStepperStyles = makeStyles((c) => ({
  btn: { borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: c['surface-sunken'] },
  // Value + unit read left-to-right (`۱٫۵ L`), as in the design.
  val: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    backgroundColor: c['surface-sunken'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    direction: 'ltr',
  },
  input: { minWidth: 56, fontFamily: fontFamily[600], color: c['text-primary'], textAlign: 'center', padding: 0 },
}));

/** 1–10 rating (design system `ScaleInput`); tapping the chosen value clears it. */
export function ScaleInput({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  lowLabel,
  highLabel,
  size = 'md',
}: {
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  size?: 'sm' | 'md';
}) {
  const { c } = useTheme();
  const opts: number[] = [];
  for (let i = min; i <= max; i++) opts.push(i);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Txt size={13} lh={16} w={500}>
          {label}
        </Txt>
        {value == null ? (
          <Txt size={14} lh={20} italic color="text-muted">
            ثبت نشده
          </Txt>
        ) : (
          <Txt size={16} lh={24} w={600}>
            {faDigits(value)}
            <Txt size={16} lh={24} color="text-muted">
              {' / ' + faDigits(max)}
            </Txt>
          </Txt>
        )}
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={typeof label === 'string' ? label : undefined} style={{ flexDirection: 'row', gap: 4 }}>
        {opts.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={String(o)}
              onPress={() => onChange(on ? null : o)}
              style={{
                flex: 1,
                height: size === 'sm' ? 36 : 44,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: on ? c['brand-primary-text'] : c.border,
                backgroundColor: on ? c['brand-primary'] : c.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={size === 'sm' ? 13 : 15} lh={20} w={on ? 600 : 500} color={on ? 'on-brand-primary' : 'text-secondary'}>
                {faDigits(o)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt size={12} lh={16} color="text-muted">
          {lowLabel}
        </Txt>
        <Txt size={12} lh={16} color="text-muted">
          {highLabel}
        </Txt>
      </View>
    </View>
  );
}
