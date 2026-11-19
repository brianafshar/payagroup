/**
 * Route map. Screens and design-system components navigate by *route key* (the same keys the
 * prototype used in `ds/routes.js`), so URLs can change here without touching any screen.
 */
export const ROUTES = {
  index: '/',
  login: '/admin/login',
  'admin:dashboard': '/admin',
  'admin:coaches': '/admin/coaches',
  'admin:create-coach': '/admin/coaches/new',
  'admin:activate-coach': '/admin/coaches/activate',
  'admin:coach': '/admin/coach',
  'admin:athletes': '/admin/athletes',
  'admin:branding': '/admin/branding',
  'admin:access': '/admin/access',
  'admin:settings': '/admin/settings',
  'admin:activity': '/admin/activity',
  'coach:login': '/coach/login',
  'coach:dashboard': '/coach',
  'coach:athletes': '/coach/athletes',
  'coach:athlete': '/coach/athlete',
  'coach:create-athlete': '/coach/athletes/new',
  'coach:library': '/coach/library',
  'coach:create-exercise': '/coach/library/new',
  'coach:exercise': '/coach/exercise',
  'coach:programs': '/coach/programs',
  'coach:create-program': '/coach/programs/new',
  'coach:program-builder': '/coach/builder',
  'coach:program': '/coach/program',
  'coach:assign': '/coach/assign',
  'coach:customize': '/coach/customize',
  'coach:history': '/coach/history',
  'coach:nutrition': '/coach/nutrition',
  'coach:recovery': '/coach/recovery',
  'coach:analytics': '/coach/analytics',
  'coach:strength': '/coach/analytics/strength',
  'coach:endurance': '/coach/analytics/endurance',
  'coach:body': '/coach/analytics/body',
  'coach:recovery-analytics': '/coach/analytics/recovery',
  'coach:records': '/coach/analytics/records',
  'coach:settings': '/coach/settings',
  'coach:chat': '/coach/chat',
  account: '/account',
} as const;

export type RouteKey = keyof typeof ROUTES;

/**
 * Screens of the athlete mobile app (M34–M48) and the responsive/state reference boards.
 * They are not part of the web panels; links to them explain where they live instead.
 */
export const ELSEWHERE: Record<string, string> = {
  'm:login': 'ورود ورزشکار',
  'm:home': 'خانه ورزشکار',
  'm:workout': 'تمرین امروز',
  'm:exercise': 'جزئیات حرکت',
  'm:log': 'ثبت ست',
  'm:complete': 'پایان تمرین',
  'm:nutrition': 'تغذیه ورزشکار',
  'm:recovery': 'ریکاوری ورزشکار',
  'm:measure': 'اندازه‌گیری بدن',
  'm:progress': 'پیشرفت',
  'm:records': 'رکوردهای ورزشکار',
  'm:profile': 'پروفایل ورزشکار',
  'm:health': 'پروفایل سلامت',
  'm:chat': 'گفتگوی ورزشکار',
  'm:invite': 'دعوت‌نامه ورزشکار',
};

export function splitKey(key: string): { base: string; query: string } {
  const i = key.indexOf('?');
  return i < 0 ? { base: key, query: '' } : { base: key.slice(0, i), query: key.slice(i) };
}

/** Resolves a route key (optionally with `?query`) to a URL path, or null when unknown. */
export function pathFor(key: string | null | undefined): string | null {
  if (!key) return null;
  const { base, query } = splitKey(key);
  const p = (ROUTES as Record<string, string>)[base];
  return p ? p + query : null;
}
