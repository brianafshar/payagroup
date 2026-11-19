/**
 * indow icon set: 24px grid, 1.75 stroke. Shared by the web design system (SVG in the DOM)
 * and the mobile app (react-native-svg). Each icon is `|`-separated primitives:
 * `c` circle, `f` filled circle, `r` rect, `p` filled path, otherwise a stroked path.
 */
export const ICONS = {
  home: 'M3 11 12 4l9 7|M5 10v10h5v-6h4v6h5V10',
  dashboard: 'r3.5 3.5 7 8.5 1.5|r13.5 3.5 7 5 1.5|r13.5 11.5 7 9 1.5|r3.5 15 7 5.5 1.5',
  users: 'c9 8 3.5|M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6|M16 4.6a3.5 3.5 0 0 1 0 6.8|M18 14.2c2.1.7 3.5 2.8 3.5 5.8',
  user: 'c12 8 4|M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
  dumbbell: 'M3 9.5v5|M6 6.5v11|M18 6.5v11|M21 9.5v5|M6 12h12',
  clipboard: 'r5 4.5 14 16.5 2|M9 3h6v3H9z|M9 11h6|M9 15h4',
  library: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z|M5 17a3 3 0 0 1 3-3h11',
  utensils: 'M6 3v6a2 2 0 0 0 4 0V3|M8 11v10|M18 21V3c-2.2 0-4 2.6-4 6.5 0 2.2 1.1 3.5 4 3.5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  sun: 'c12 12 4|M12 2.5v2|M12 19.5v2|M2.5 12h2|M19.5 12h2|M5.3 5.3l1.4 1.4|M17.3 17.3l1.4 1.4|M5.3 18.7l1.4-1.4|M17.3 6.7l1.4-1.4',
  progress: 'M4 4v16h16|M8 15l3.5-4 3 2.5L20 7',
  settings: 'M4 6h9|M17 6h3|M4 12h3|M11 12h9|M4 18h11|M19 18h1|c15 6 2|c9 12 2|c17 18 2',
  chat: 'M4 5h16v11H9l-5 4V5Z|M8 9.5h8|M8 12.5h5',
  lock: 'r5 10.5 14 10 2|M8 10.5V7a4 4 0 0 1 8 0v3.5',
  search: 'c11 11 6.5|M20 20l-4.3-4.3',
  plus: 'M12 5v14|M5 12h14',
  minus: 'M5 12h14',
  'chevron-right': 'M9 5l7 7-7 7',
  'chevron-left': 'M15 5l-7 7 7 7',
  'chevron-down': 'M5 9l7 7 7-7',
  'chevron-up': 'M5 15l7-7 7 7',
  check: 'M4.5 12.5l5 5L20 7',
  x: 'M6 6l12 12|M18 6 6 18',
  'alert-triangle': 'M12 3.5 2.5 20h19L12 3.5Z|M12 10v4.5|M12 17.4v.1',
  'alert-circle': 'c12 12 9|M12 7.5V13|M12 16.4v.1',
  info: 'c12 12 9|M12 11v5.5|M12 7.6v.1',
  'check-circle': 'c12 12 9|M8 12.5l3 3 5-6',
  'x-circle': 'c12 12 9|M9 9l6 6|M15 9l-6 6',
  'minus-circle': 'c12 12 9|M8 12h8',
  circle: 'c12 12 8.5',
  'circle-half': 'c12 12 9|pM12 3a9 9 0 0 1 0 18Z',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4Z|M7 6H4v1a3 3 0 0 0 3 3|M17 6h3v1a3 3 0 0 1-3 3|M12 14v3.5|M8.5 21h7|M9.5 17.5h5V21h-5z',
  calendar: 'r3.5 5 17 15.5 2|M3.5 10h17|M8 3v4|M16 3v4',
  clock: 'c12 12 9|M12 7v5l3 2',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6|M3.5 4v4h4|M12 8v4.5l3 2',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  activity: 'M3 12h4l2.5-6 5 12 2.5-6H21',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4-3-6-4.5-9.5-1 2.3-2.2 3.4-3.5 3.9C9.5 8 9 6.5 9.5 5 7 7 6 9.8 6 12.5V15a6 6 0 0 0 6 6Z',
  ruler: 'M3 17 17 3l4 4L7 21l-4-4Z|M7 13l2 2|M10 10l2 2|M13 7l2 2',
  scale: 'r4 4 16 16 3|M8.5 9.5a5 5 0 0 1 7 0|M12 9.5l1.5-2',
  droplet: 'M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  bed: 'M3 19V6|M3 15h18v4|M21 15v-3a3 3 0 0 0-3-3h-7v6|c7 12 1.6',
  zap: 'M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z',
  gauge: 'M4 17a8 8 0 1 1 16 0|M12 17l4-5.5',
  filter: 'M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z',
  more: 'f6 12 1.4|f12 12 1.4|f18 12 1.4',
  'more-vertical': 'f12 6 1.4|f12 12 1.4|f12 18 1.4',
  grip: 'f9 6 1.3|f15 6 1.3|f9 12 1.3|f15 12 1.3|f9 18 1.3|f15 18 1.3',
  copy: 'r8 8 12 12 2|M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8',
  trash: 'M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z|M13.5 6.5l4 4',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z|c12 12 3',
  'eye-off': 'M3 3l18 18|M10.6 6.1c.5-.1.9-.1 1.4-.1 6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6|M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.6-1.2',
  upload: 'M12 16V4|M7 9l5-5 5 5|M4 16v4h16v-4',
  download: 'M12 4v12|M7 11l5 5 5-5|M4 20h16',
  image: 'r3.5 4.5 17 15 2|c9 10 1.8|M20.5 16l-5-5-9 8.5',
  video: 'r3 6 13 12 2|M16 10.5l5-3v9l-5-3',
  play: 'pM8 5.5v13l10.5-6.5L8 5.5Z',
  pause: 'M8.5 5.5v13|M15.5 5.5v13',
  mic: 'r9 3 6 11.5 3|M5.5 11a6.5 6.5 0 0 0 13 0|M12 17.5V21|M9 21h6',
  stop: 'pM7 7h10v10H7Z',
  maximize: 'M4 9V4h5|M20 9V4h-5|M4 15v5h5|M20 15v5h-5',
  'trend-up': 'M3 17l6-6 4 4 8-8|M15 7h6v6',
  'trend-down': 'M3 7l6 6 4-4 8 8|M15 17h6v-6',
  'arrow-right': 'M5 12h14|M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5|M11 6l-6 6 6 6',
  'arrow-up': 'M12 19V5|M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14|M6 13l6 6 6-6',
  'arrow-up-right': 'M7 17 17 7|M8 7h9v9',
  'arrow-down-right': 'M7 7l10 10|M17 8v9H8',
  shield: 'M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z|M8.8 12l2.3 2.3 4.2-4.6',
  'log-out': 'M14 4h5v16h-5|M10 8l-4 4 4 4|M6 12h10',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z|M10 20.5a2 2 0 0 0 4 0',
  external: 'M14 4h6v6|M20 4l-9 9|M18 14v6H4V6h6',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6|M20 4v5h-5',
  building: 'M4 21V5l8-2v18|M12 7h8v14|M3 21h18|M7.5 8h1|M7.5 12h1|M7.5 16h1|M15.5 11h1|M15.5 15h1',
  palette: 'M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.8 0-1.2-1-1.6-1-2.7 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z|f7.5 11 1.2|f10 7 1.2|f14.5 7 1.2',
  key: 'c8 15 4|M11 12l9-9|M16 7l3 3',
  layers: 'M12 3 3 8l9 5 9-5-9-5Z|M3 13l9 5 9-5',
  'git-branch': 'c6 5 2|c6 19 2|c18 7 2|M6 7v10|M18 9v1a4 4 0 0 1-4 4H9a3 3 0 0 0-3 3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  stopwatch: 'c12 13 8|M12 9v4l2.5 1.5|M9.5 2.5h5|M18.5 6.5 20 5',
  route: 'c6 18 2.5|c18 6 2.5|M8.5 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5',
  'file-text': 'M6 3h8l5 5v13H6V3Z|M14 3v5h5|M9 13h7|M9 17h5',
  list: 'M9 6h11|M9 12h11|M9 18h11|f4.5 6 1.2|f4.5 12 1.2|f4.5 18 1.2',
  grid: 'r4 4 7 7 1.5|r13 4 7 7 1.5|r4 13 7 7 1.5|r13 13 7 7 1.5',
  sort: 'M8 5v14|M5 16l3 3 3-3|M16 19V5|M13 8l3-3 3 3',
  send: 'M21 3 10 14|M21 3l-7 18-4-7-7-4 18-7Z',
  target: 'c12 12 9|c12 12 5|f12 12 1.2',
  mail: 'r3 5 18 14 2|M3.5 6.5l8.5 6 8.5-6',
  undo: 'M9 14 4 9l5-5|M4 9h10a6 6 0 0 1 0 12h-3',
  'wifi-off': 'M3 3l18 18|M8.5 16.5a5 5 0 0 1 6.2-.6|M5 12.6a10 10 0 0 1 4.2-2.4|M15.8 10.4a10 10 0 0 1 3.2 2.2|M2 8.8a15 15 0 0 1 4.4-2.7|M10.3 5.1A15 15 0 0 1 22 8.8|f12 20 1.1',
  save: 'M5 4h11l3 3v13H5V4Z|M8 4v5h7V4|M8 20v-6h8v6',
  help: 'c12 12 9|M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6|M12 17v.1',
  sparkline: 'M3 16l4-5 4 3 4-7 6 5',
} as const;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export type IconPrimitive =
  | { t: 'circle'; cx: number; cy: number; r: number; filled: boolean }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { t: 'path'; d: string; filled: boolean };

/** Parses an icon into drawable primitives; unknown names fall back to a circle. */
export function iconPrimitives(name: string): IconPrimitive[] {
  const d: string = (ICONS as Record<string, string>)[name] ?? ICONS.circle;
  return d.split('|').map((seg) => {
    const t = seg.charAt(0);
    const a = seg
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (t === 'c' || t === 'f') return { t: 'circle', cx: a[0], cy: a[1], r: a[2], filled: t === 'f' };
    if (t === 'r') return { t: 'rect', x: a[0], y: a[1], w: a[2], h: a[3], rx: a[4] || 0 };
    if (t === 'p') return { t: 'path', d: seg.slice(1), filled: true };
    return { t: 'path', d: seg, filled: false };
  });
}
