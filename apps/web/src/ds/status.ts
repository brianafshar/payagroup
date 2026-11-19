import type { IconName } from './Icon';

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'record' | 'neutral' | 'brand';

export const STATUS = {
  completed: { tone: 'success', icon: 'check-circle', label: 'انجام‌شده' },
  partial: { tone: 'warning', icon: 'circle-half', label: 'ناقص' },
  missed: { tone: 'error', icon: 'x-circle', label: 'ازدست‌رفته' },
  planned: { tone: 'neutral', icon: 'circle', label: 'برنامه‌ریزی‌شده' },
  'not-started': { tone: 'neutral', icon: 'circle', label: 'شروع‌نشده' },
  'in-progress': { tone: 'brand', icon: 'circle-half', label: 'در حال انجام' },
  rest: { tone: 'success', icon: 'moon', label: 'استراحت' },
  active: { tone: 'success', icon: 'check-circle', label: 'فعال' },
  inactive: { tone: 'neutral', icon: 'minus-circle', label: 'غیرفعال' },
  paused: { tone: 'warning', icon: 'pause', label: 'متوقف' },
  invited: { tone: 'info', icon: 'mail', label: 'دعوت‌شده' },
  draft: { tone: 'neutral', icon: 'edit', label: 'پیش‌نویس' },
  pr: { tone: 'record', icon: 'trophy', label: 'رکورد شخصی' },
} as const satisfies Record<string, { tone: Tone; icon: IconName; label: string }>;

export type StatusKey = keyof typeof STATUS;

export function statusOf(s: string | null | undefined): (typeof STATUS)[StatusKey] | null {
  return s && s in STATUS ? STATUS[s as StatusKey] : null;
}

export const TONE_ICON: Record<string, IconName> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
  record: 'trophy',
  neutral: 'info',
  brand: 'info',
};
