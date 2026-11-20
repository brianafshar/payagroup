/**
 * Shared by the analytics screens (C26–C30): the athlete picker, the section tabs and the data
 * container (`?id=` athlete, or the first one with an account).
 */
import type { JSX } from 'react';
import { NoAthletePage, pending } from '@/app/pending';
import { api, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import type { Athlete } from '@/data/types';
import { go, param } from '@/lib/nav';

export type Section = 'overview' | 'strength' | 'endurance' | 'body' | 'recovery' | 'performance' | 'trends';

const ROUTE: Record<string, string> = {
  overview: 'coach:analytics',
  strength: 'coach:strength',
  endurance: 'coach:endurance',
  body: 'coach:body',
  recovery: 'coach:recovery-analytics',
  records: 'coach:records',
};

export const ANALYTICS_TABS = [
  { id: 'overview', label: 'نمای کلی' },
  { id: 'strength', label: 'قدرت' },
  { id: 'endurance', label: 'استقامت و سرعت' },
  { id: 'body', label: 'ترکیب بدن' },
  { id: 'recovery', label: 'ریکاوری' },
  { id: 'records', label: 'رکوردها' },
];

/** Navigate to another analytics section for the same athlete. */
export function goSection(id: string, athleteId: string): void {
  if (ROUTE[id]) go(ROUTE[id] + '?id=' + athleteId);
}

/** Athlete picker: switching keeps the current section. */
export function athletePicker(athletes: Athlete[], section: string) {
  return {
    athOpts: athletes.map((a) => ({ value: a.id, label: a.name })),
    setAth: (id: string) => go(ROUTE[section] + '?id=' + id),
  };
}

export interface AnalyticsProps {
  athlete: Athlete;
  athletes: Athlete[];
  data: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Loads the athletes and one analytics section, then renders `render(props)` (or loading / empty states). */
export function useAnalyticsPage(section: Section, active: string, title: string, days?: number, extra?: { tests?: boolean }) {
  const athletes = useQuery('athletes', () => api.athletes.list());
  const list = athletes.data || [];
  const id = param('id') || list[0]?.id || '';
  const data = useQuery(`analytics:${section}:${id}:${days || ''}`, () => (id ? remote.analytics(id, section, days) : Promise.resolve(null)));
  const tests = useQuery('tests', () => (extra?.tests ? remote.tests() : Promise.resolve([])));
  const wait = pending(athletes, data, tests);
  const empty: JSX.Element | null = wait ?? (id ? null : <NoAthletePage active={active} title={title} />);
  const athlete = athletes.data?.find((a) => a.id === id);
  return { empty, props: athlete ? { athlete, athletes: list.some((a) => a.id === id) ? list : [athlete, ...list], data: data.data, tests: tests.data } : null };
}
