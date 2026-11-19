import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, space, type ColorTokens, type Mode, type ModePreference, type ThemeName } from '@baseline/tokens';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

const KEY = 'theme';

export type Weight = 400 | 500 | 600 | 700;

/** Font family per weight (loaded in App). Custom fonts need a family per weight on Android. */
export const fontFamily: Record<Weight, string> = {
  400: 'Vazirmatn_400Regular',
  500: 'Vazirmatn_500Medium',
  600: 'Vazirmatn_600SemiBold',
  700: 'Vazirmatn_700Bold',
};
export const monoFamily: Record<400 | 500 | 600, string> = {
  400: 'IBMPlexMono_400Regular',
  500: 'IBMPlexMono_500Medium',
  600: 'IBMPlexMono_600SemiBold',
};

export interface Theme {
  mode: Mode;
  preference: ModePreference;
  setPreference: (p: ModePreference) => void;
  /** Token colors, e.g. `c['brand-primary']`, `c['text-primary']`. */
  c: ColorTokens;
  space: typeof space;
  radius: typeof radius;
}

const ThemeContext = createContext<Theme | null>(null);

/**
 * Light / Dark / System for the athlete app, sharing tokens with the web panels. The coach's
 * white-label theme keeps its primary color in both modes. Preference persists in AsyncStorage.
 */
export function ThemeProvider({ brand = 'brand', children }: { brand?: ThemeName; children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ModePreference>('system');
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => (v === 'light' || v === 'dark' ? setPref(v) : undefined))
      .catch(() => {});
  }, []);
  const mode: Mode = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo<Theme>(
    () => ({
      mode,
      preference,
      setPreference: (p) => {
        setPref(p);
        (p === 'system' ? AsyncStorage.removeItem(KEY) : AsyncStorage.setItem(KEY, p)).catch(() => {});
      },
      c: colors(brand, mode),
      space,
      radius,
    }),
    [brand, mode, preference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}

/** Theme-aware StyleSheet factory: `const useStyles = makeStyles((c) => ({ … }))`. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: ColorTokens, mode: Mode) => T): () => T {
  const cache = new WeakMap<ColorTokens, T>();
  return function useStyles() {
    const { c, mode } = useTheme();
    let s = cache.get(c);
    if (!s) {
      s = StyleSheet.create(factory(c, mode));
      cache.set(c, s);
    }
    return s;
  };
}
