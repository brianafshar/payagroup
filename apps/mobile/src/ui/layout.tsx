import { BottomTabBarHeightContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, useWindowDimensions, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { BrandMark } from './display';
import { Icon, Txt, type IconRef } from './primitives';

export interface HeaderAction {
  icon: IconRef;
  label: string;
  onPress: () => void;
  dot?: boolean;
}

export const BRAND = { name: 'Ali Fitness', initials: 'AF' };

/**
 * Keyboard handling for every screen. Android apps now draw edge-to-edge, so the window no longer shrinks
 * when the keyboard opens: like iOS, the content has to make room itself (#59).
 */
export const KEYBOARD_BEHAVIOR = Platform.OS === 'web' ? undefined : 'padding';

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

/**
 * Space to keep clear at the bottom for the phone's navigation bar / home indicator (#60): zero while the
 * keyboard is up (it covers that area) or when the tab bar below already takes care of it.
 */
export function useBottomInset(min = 0): number {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardOpen();
  return kb ? min : Math.max(insets.bottom, min);
}

/**
 * Mobile header. Default: back link · centered title · actions on a surface bar.
 * `large`: coach brand + actions, then an eyebrow and a 28px title on the page background.
 */
export function MobileHeader({
  title,
  back,
  onBack,
  actions = [],
  large,
  eyebrow,
}: {
  title: string;
  back?: string;
  onBack?: () => void;
  actions?: HeaderAction[];
  large?: boolean;
  eyebrow?: string;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: large ? c.background : c.surface, borderBottomWidth: large ? 0 : 1, borderBottomColor: c.border }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingStart: 16, paddingEnd: 8 }}>
        {back ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={'بازگشت به ' + back}
            onPress={onBack}
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, marginStart: -8 }}
          >
            <Icon name="chevron-right" size={24} color="brand-primary-text" />
            <Txt size={16} lh={24} w={500} color="brand-primary-text">
              {back}
            </Txt>
          </Pressable>
        ) : large ? (
          <BrandMark name={BRAND.name} initials={BRAND.initials} size="sm" />
        ) : null}
        {!large ? (
          <Txt size={17} lh={24} w={600} align="center" numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Txt>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={{ flexDirection: 'row', gap: 2, minWidth: back ? 60 : undefined, justifyContent: 'flex-end' }}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={a.onPress}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={a.icon} size={22} />
              {a.dot ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 9,
                    end: 9,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: c.error,
                    borderWidth: 2,
                    borderColor: large ? c.background : c.surface,
                  }}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
      {large ? (
        <View style={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 12 }}>
          {eyebrow ? (
            <Txt size={13} lh={20} w={500} color="text-muted">
              {eyebrow}
            </Txt>
          ) : null}
          <Txt size={28} lh={40} w={600} accessibilityRole="header">
            {title}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** Page frame: header, scrolling content (16px gutters), optional sticky footer. */
export function Screen({
  header,
  children,
  footer,
  surface,
  gap = 16,
  contentStyle,
  scrollProps,
}: {
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  surface?: boolean;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
}) {
  const { c } = useTheme();
  // Inside the tabs the tab bar sits below; elsewhere, without a footer, the last item clears the nav bar.
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const bottom = useBottomInset();
  const pad = 24 + (footer || inTabs ? 0 : bottom);
  return (
    <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1, backgroundColor: surface ? c.surface : c.background }}>
      {header}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[{ paddingTop: 8, paddingHorizontal: 16, paddingBottom: pad, gap }, contentStyle]} {...scrollProps}>
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

/** Sticky action area at the bottom of a page. */
export function Footer({ children, gap = 6, row }: { children?: ReactNode; gap?: number; row?: boolean }) {
  const { c } = useTheme();
  const bottom = useBottomInset(16);
  return (
    <View
      style={{
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: bottom,
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
        gap,
        flexDirection: row ? 'row' : 'column',
      }}
    >
      {children}
    </View>
  );
}

const TAB_META: Record<string, { label: string; icon: IconRef }> = {
  Home: { label: 'خانه', icon: 'home' },
  Workout: { label: 'تمرین', icon: 'dumbbell' },
  Nutrition: { label: 'تغذیه', icon: 'utensils' },
  Recovery: { label: 'ریکاوری', icon: 'moon' },
  Progress: { label: 'پیشرفت', icon: 'progress' },
  Profile: { label: 'پروفایل', icon: 'user' },
};

/** Bottom navigation (design system `BottomNav`): 6 tabs, active tab in a brand pill. */
export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        paddingTop: 4,
        paddingHorizontal: 4,
        paddingBottom: Math.max(insets.bottom, 8),
        minHeight: 64,
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      {state.routes.map((route, i) => {
        const on = state.index === i;
        const meta = TAB_META[route.name] ?? { label: route.name, icon: 'circle' };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={meta.label}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 }}
          >
            <View
              style={{ width: 52, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c['brand-primary-subtle'] : 'transparent' }}
            >
              <Icon name={meta.icon} size={22} color={on ? 'brand-primary-text' : 'text-muted'} />
            </View>
            <Txt size={11} lh={14} w={on ? 600 : 500} color={on ? 'brand-primary-text' : 'text-muted'}>
              {meta.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Black background with 45° orange lines fading toward the bottom-right (login & invite). */
export function LoginBackdrop({ children }: { children?: ReactNode }) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
        <Defs>
          <Pattern id="lines" patternUnits="userSpaceOnUse" width={32} height={32} patternTransform="rotate(-45)">
            <Rect x={30} y={0} width={2} height={32} fill="rgba(255,154,31,0.45)" />
          </Pattern>
          <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0a0a0a" stopOpacity={0} />
            <Stop offset="0.55" stopColor="#0a0a0a" stopOpacity={0.6} />
            <Stop offset="0.9" stopColor="#0a0a0a" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#lines)" />
        <Rect width={width} height={height} fill="url(#fade)" />
      </Svg>
      {children}
    </View>
  );
}
