/**
 * indow design tokens — the single source of truth for the web panels (Admin + Coach)
 * and the athlete mobile app. Light values mirror `ds/baseline/tokens.css` from the design
 * handoff; dark values follow the "Light / Dark mode" section of the handoff README.
 *
 * Two independent axes:
 *  - theme (`data-theme`): white-label brand colors — `brand` (platform orange) or a coach theme.
 *  - mode  (`data-mode`):  light | dark — swaps neutrals & surfaces; the brand hue is kept.
 */
import { alpha, ensureContrast, mix } from './color';

export * from './color';

export type ColorTokens = Record<string, string>;

export const themeNames = ['brand', 'base', 'ali-fitness', 'northline', 'kova'] as const;
export type ThemeName = (typeof themeNames)[number];
export type Mode = 'light' | 'dark';
export type ModePreference = Mode | 'system';

/** Neutrals, status, data-viz and elevation for light mode (`:root` / `data-theme="base"`). */
export const lightNeutrals: ColorTokens = {
  background: '#f5f6f8',
  surface: '#ffffff',
  'surface-sunken': '#eef0f3',
  'surface-elevated': '#ffffff',
  'surface-inverse': '#1a2029',
  'border-subtle': '#e6e9ee',
  border: '#d3d8df',
  'border-strong': '#7d8796',
  'text-primary': '#151a22',
  'text-secondary': '#465061',
  'text-muted': '#5c6778',
  'text-disabled': '#9aa3b0',
  'text-inverse': '#ffffff',
  overlay: 'rgba(21, 26, 34, 0.48)',
  success: '#157347',
  'success-subtle': '#e8f5ed',
  warning: '#a84b06',
  'warning-subtle': '#fdf0e4',
  error: '#c4312a',
  'error-subtle': '#fdecea',
  info: '#1d63b8',
  'info-subtle': '#e9f1fb',
  record: '#7a5b00',
  'record-subtle': '#faf3d6',
  'error-hover': '#a5271f',
  'on-error': '#ffffff',
  'record-strong': '#c99a06',
  'viz-1': '#2563c9',
  'viz-2': '#c96f00',
  'viz-3': '#0f8a6b',
  'viz-4': '#b43d86',
  'viz-5': '#5b6b82',
  'viz-6': '#8a6a1a',
  'viz-muted': '#8792a2',
  'viz-grid': '#e6e9ee',
  'viz-target': '#465061',
  'viz-area': 'rgba(37, 99, 201, 0.10)',
  'shadow-1': '0 1px 2px rgba(16, 24, 40, 0.06)',
  'shadow-2': '0 4px 12px rgba(16, 24, 40, 0.08), 0 1px 3px rgba(16, 24, 40, 0.06)',
  'shadow-3': '0 16px 40px rgba(16, 24, 40, 0.16), 0 2px 6px rgba(16, 24, 40, 0.08)',
  'sidebar-bg': 'var(--surface)',
};

/** Dark mode: black + orange, white text (handoff README › Dark palette). */
export const darkNeutrals: ColorTokens = {
  background: '#0A0A0A',
  surface: '#141414',
  'surface-sunken': '#0F0F0F',
  'surface-elevated': '#1C1C1C',
  'surface-inverse': '#FFFFFF',
  'border-subtle': '#1F1F1F',
  border: '#2A2A2A',
  'border-strong': '#4A4A4A',
  'text-primary': '#FFFFFF',
  'text-secondary': '#D4D4D4',
  'text-muted': '#A3A3A3',
  'text-disabled': '#6B6B6B',
  'text-inverse': '#111418',
  overlay: 'rgba(0,0,0,.64)',
  success: '#4ADE80',
  'success-subtle': 'rgba(74,222,128,.12)',
  warning: '#FFB255',
  'warning-subtle': 'rgba(255,154,31,.14)',
  error: '#F87171',
  'error-subtle': 'rgba(248,113,113,.14)',
  info: '#60A5FA',
  'info-subtle': 'rgba(96,165,250,.14)',
  record: '#FACC15',
  'record-subtle': 'rgba(250,204,21,.12)',
  'error-hover': '#EF4444',
  'on-error': '#111418',
  'record-strong': '#FACC15',
  // Series keep their hue, lightened ~15% for contrast on dark surfaces.
  'viz-1': mix('#2563c9', '#FFFFFF', 0.3),
  'viz-2': mix('#c96f00', '#FFFFFF', 0.25),
  'viz-3': mix('#0f8a6b', '#FFFFFF', 0.3),
  'viz-4': mix('#b43d86', '#FFFFFF', 0.3),
  'viz-5': mix('#5b6b82', '#FFFFFF', 0.3),
  'viz-6': mix('#8a6a1a', '#FFFFFF', 0.3),
  'viz-muted': '#6B6B6B',
  'viz-grid': '#262626',
  'viz-target': '#A3A3A3',
  'viz-area': 'rgba(255,154,31,.14)',
  // Shadows are replaced by 1px borders; modals keep a deep drop shadow.
  'shadow-1': '0 0 0 1px #2A2A2A',
  'shadow-2': '0 0 0 1px #2A2A2A, 0 4px 12px rgba(0,0,0,.4)',
  'shadow-3': '0 0 0 1px #2A2A2A, 0 8px 24px rgba(0,0,0,.5)',
  'sidebar-bg': '#0A0A0A',
};

/** Brand (white-label) colors per theme, light mode. `base` is the neutral default. */
export const brandThemes: Record<ThemeName, ColorTokens> = {
  base: {
    'brand-primary': '#2c4bc7',
    'brand-primary-hover': '#2844b3',
    'brand-primary-pressed': '#233c9f',
    'on-brand-primary': '#ffffff',
    'brand-primary-text': '#2c4bc7',
    'brand-primary-subtle': '#eaedf9',
    'brand-secondary': '#0f7f86',
    'on-brand-secondary': '#ffffff',
    'brand-secondary-text': '#0e777e',
    'brand-secondary-subtle': '#e7f2f3',
  },
  brand: {
    'brand-primary': '#ff9a1f',
    'brand-primary-hover': '#f08a0c',
    'brand-primary-pressed': '#d97a06',
    'on-brand-primary': '#111418',
    'brand-primary-text': '#9a5600',
    'brand-primary-subtle': '#fff5e9',
    'brand-secondary': '#111418',
    'on-brand-secondary': '#ffffff',
    'brand-secondary-text': '#111418',
    'brand-secondary-subtle': '#e8e8e8',
    'surface-inverse': '#0a0a0a',
  },
  'ali-fitness': {
    'brand-primary': '#0f6b5b',
    'brand-primary-hover': '#0e6052',
    'brand-primary-pressed': '#0c5649',
    'on-brand-primary': '#ffffff',
    'brand-primary-text': '#0f6b5b',
    'brand-primary-subtle': '#e7f0ef',
    'brand-secondary': '#c98404',
    'on-brand-secondary': '#111418',
    'brand-secondary-text': '#996403',
    'brand-secondary-subtle': '#faf3e6',
  },
  northline: {
    'brand-primary': '#8e1b3a',
    'brand-primary-hover': '#801834',
    'brand-primary-pressed': '#72162e',
    'on-brand-primary': '#ffffff',
    'brand-primary-text': '#8e1b3a',
    'brand-primary-subtle': '#f4e8eb',
    'brand-secondary': '#2f6f9f',
    'on-brand-secondary': '#ffffff',
    'brand-secondary-text': '#2f6f9f',
    'brand-secondary-subtle': '#eaf1f5',
  },
  kova: {
    'brand-primary': '#f5c400',
    'brand-primary-hover': '#e6b800',
    'brand-primary-pressed': '#d3a900',
    'on-brand-primary': '#111418',
    'brand-primary-text': '#896e00',
    'brand-primary-subtle': '#fef9e6',
    'brand-secondary': '#1c1c1e',
    'on-brand-secondary': '#ffffff',
    'brand-secondary-text': '#1c1c1e',
    'brand-secondary-subtle': '#e8e8e8',
  },
};

const DARK_SURFACE = darkNeutrals.surface;

/**
 * Dark-mode brand colors. The platform `brand` theme uses the exact values from the handoff;
 * coach themes keep their primary and get a text color lifted to AA contrast on dark surfaces.
 */
export function darkBrand(theme: ThemeName): ColorTokens {
  if (theme === 'brand') {
    return {
      'brand-primary': '#FF9A1F',
      'brand-primary-hover': '#FFA940',
      'brand-primary-pressed': '#F08A0C',
      'on-brand-primary': '#111418',
      'brand-primary-text': '#FFB255',
      'brand-primary-subtle': 'rgba(255,154,31,0.14)',
      'brand-secondary': '#FFFFFF',
      'on-brand-secondary': '#111418',
      'brand-secondary-text': '#FFFFFF',
      'brand-secondary-subtle': '#1F1F1F',
    };
  }
  const t = brandThemes[theme];
  const primary = t['brand-primary'];
  const secondary = t['brand-secondary'];
  return {
    'brand-primary': primary,
    'brand-primary-hover': mix(primary, '#FFFFFF', 0.12),
    'brand-primary-pressed': t['brand-primary-hover'],
    'on-brand-primary': t['on-brand-primary'],
    'brand-primary-text': ensureContrast(primary, DARK_SURFACE),
    'brand-primary-subtle': alpha(primary, 0.16),
    'brand-secondary': ensureContrast(secondary, DARK_SURFACE, 3),
    'on-brand-secondary': t['on-brand-secondary'],
    'brand-secondary-text': ensureContrast(secondary, DARK_SURFACE),
    'brand-secondary-subtle': alpha(secondary, 0.16),
  };
}

/** Resolved color set for a theme + mode (used by React Native and tests). */
export function colors(theme: ThemeName = 'brand', mode: Mode = 'light'): ColorTokens {
  const out: ColorTokens = { ...(mode === 'dark' ? darkNeutrals : lightNeutrals) };
  Object.assign(out, mode === 'dark' ? darkBrand(theme) : brandThemes[theme]);
  if (mode === 'dark') out['surface-inverse'] = darkNeutrals['surface-inverse'];
  out['focus-ring'] = out['brand-primary-text'];
  return out;
}

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const radius = { xs: 4, sm: 6, md: 8, lg: 12, full: 999 } as const;
export const control = { sm: 32, md: 40, lg: 48 } as const;
export const layout = { sidebar: 248, sidebarRail: 72, topbar: 56, bottomNav: 64, contentMax: 1440 } as const;
export const duration = { instant: 80, fast: 140, base: 200, slow: 320 } as const;
export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;
export const zIndex = { sticky: 10, dropdown: 100, drawer: 200, modal: 300, toast: 400, tooltip: 500 } as const;
export const fonts = { sans: 'Vazirmatn', mono: 'IBM Plex Mono' } as const;

/** Type scale: [fontSize, lineHeight, fontWeight]. */
export const type = {
  display: [40, 48, 600],
  h1: [32, 40, 600],
  h2: [24, 32, 600],
  h3: [20, 28, 600],
  h4: [16, 24, 600],
  bodyLg: [16, 24, 400],
  body: [14, 22, 400],
  bodySm: [13, 20, 400],
  caption: [12, 16, 400],
  label: [13, 16, 500],
  overline: [11, 16, 600],
  metricXl: [40, 44, 600],
  metricLg: [28, 32, 600],
  metricMd: [20, 24, 600],
  metricSm: [14, 20, 500],
} as const;

function block(selector: string, vars: ColorTokens): string {
  return selector + ' {\n' + Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n') + '\n}\n';
}

/**
 * CSS custom properties for every theme × mode. Theme lives on any element (`data-theme`),
 * mode lives on <html> (`data-mode`), so a white-label preview can sit inside the platform UI.
 */
export function buildCss(): string {
  const scale: ColorTokens = {};
  Object.entries(space).forEach(([k, v]) => (scale['space-' + k] = v + 'px'));
  Object.entries(radius).forEach(([k, v]) => (scale['radius-' + k] = v + 'px'));
  Object.entries(control).forEach(([k, v]) => (scale['control-' + k] = v + 'px'));
  scale['sidebar-width'] = layout.sidebar + 'px';
  scale['sidebar-rail'] = layout.sidebarRail + 'px';
  scale['topbar-height'] = layout.topbar + 'px';
  scale['bottomnav-height'] = layout.bottomNav + 'px';
  scale['content-max'] = layout.contentMax + 'px';
  Object.entries(duration).forEach(([k, v]) => (scale['duration-' + k] = v + 'ms'));
  Object.entries(easing).forEach(([k, v]) => (scale['ease-' + k] = v));
  Object.entries(zIndex).forEach(([k, v]) => (scale['z-' + k] = String(v)));
  scale['font-sans'] = "'Vazirmatn', system-ui, sans-serif";
  scale['font-mono'] = '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace';

  let css = block(':root', scale);
  css += block(':root, [data-theme="base"]', { ...lightNeutrals, ...brandThemes.base, 'focus-ring': 'var(--brand-primary-text)' });
  for (const t of themeNames) {
    if (t === 'base') continue;
    css += block(`[data-theme="${t}"]`, { ...brandThemes[t], 'focus-ring': 'var(--brand-primary-text)' });
  }
  css += block(':root[data-mode="dark"], :root[data-mode="dark"] [data-theme="base"]', { ...darkNeutrals, ...darkBrand('base') });
  for (const t of themeNames) {
    if (t === 'base') continue;
    css += block(`:root[data-mode="dark"] [data-theme="${t}"], :root[data-mode="dark"][data-theme="${t}"]`, {
      ...darkBrand(t),
      'surface-inverse': darkNeutrals['surface-inverse'],
    });
  }
  css += ':root { color-scheme: light; }\n:root[data-mode="dark"] { color-scheme: dark; }\n';
  return css;
}
