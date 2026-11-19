import { iconPrimitives, type IconName } from '@baseline/core';
import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fontFamily, monoFamily, useTheme, type Weight } from '../theme';

export type IconRef = IconName | (string & {});
/** Token name (`text-muted`, `brand-primary-text`, …) or a raw color. */
export type ColorRef = string;

export function useColor(ref: ColorRef | undefined, fallback = 'text-primary'): string {
  const { c } = useTheme();
  const r = ref ?? fallback;
  return c[r] ?? r;
}

export interface TxtProps extends TextProps {
  size?: number;
  /** Line height in px. */
  lh?: number;
  w?: Weight;
  color?: ColorRef;
  align?: TextStyle['textAlign'];
  mono?: boolean;
  /** Force left-to-right (emails, phones, units, codes). */
  ltr?: boolean;
  italic?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

/**
 * Largest text scale the app follows from the phone's font-size setting. The layout is sized for the
 * design's fonts; phones that ship with a large default font otherwise wrap and stretch every screen.
 */
export const MAX_FONT_SCALE = 1.2;

/** Text in Vazirmatn (IBM Plex Mono with `mono`). Sizes mirror the design's inline font specs. */
export function Txt({ size = 14, lh, w = 400, color, align, mono, ltr, italic, style, children, ...rest }: TxtProps) {
  const col = useColor(color);
  const family = mono ? monoFamily[(w >= 600 ? 600 : w >= 500 ? 500 : 400) as 400 | 500 | 600] : fontFamily[w];
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        { fontFamily: family, fontSize: size, lineHeight: lh ?? Math.round(size * 1.5), color: col, fontVariant: ['tabular-nums'] },
        align ? { textAlign: align } : null,
        ltr ? { writingDirection: 'ltr' } : null,
        italic ? { fontStyle: 'italic' } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Icon from the shared indow set (24px grid, 1.75 stroke). */
export function Icon({ name, size = 20, color, stroke = 1.75 }: { name: IconRef; size?: number; color?: ColorRef; stroke?: number }) {
  const col = useColor(color, 'text-secondary');
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {iconPrimitives(name).map((p, i) => {
        if (p.t === 'circle') return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.filled ? col : 'none'} stroke={p.filled ? 'none' : col} />;
        if (p.t === 'rect') return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} />;
        return <Path key={i} d={p.d} fill={p.filled ? col : 'none'} />;
      })}
    </Svg>
  );
}

/** White card with a 1px border — the design's recurring "surface" block. */
export function Surface({
  children,
  padding = 16,
  gap = 12,
  style,
  sunken,
}: {
  children?: ReactNode;
  padding?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  sunken?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        sunken
          ? { backgroundColor: c['surface-sunken'], borderRadius: 8, padding, gap }
          : { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding, gap },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, gap = 8, align = 'center', style }: { children?: ReactNode; gap?: number; align?: ViewStyle['alignItems']; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function Divider({ color = 'border' }: { color?: ColorRef }) {
  return <View style={{ height: 1, backgroundColor: useColor(color) }} />;
}
