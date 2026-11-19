import { faDate } from '@baseline/core';

export const EMAIL = /^\S+@\S+\.\S+$/;

/** `سه‌شنبه ۱ مهر` for today. */
export function todayLabel(d = new Date()): string {
  return faDate(d, { weekday: true, year: false });
}

/** Persian greeting by time of day. */
export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 12 ? 'صبح بخیر' : h < 16 ? 'ظهر بخیر' : h < 20 ? 'عصر بخیر' : 'شب بخیر';
}
