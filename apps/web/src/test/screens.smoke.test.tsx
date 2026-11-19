import { cleanup, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi } from './fakeApi';
import { renderScreen } from './render';

/** Every screen must load its data from the (fake) API and render without an error state. The
 * account pages (`screens/auth`) need a signed-in session and are covered by the e2e walkthroughs. */
const modules = import.meta.glob<{ default?: ComponentType }>(['../screens/**/*.tsx', '!../screens/**/*.test.tsx', '!../screens/auth/**'], { eager: true });
const screens = Object.entries(modules).filter(([file, mod]) => !file.endsWith('/Screen.tsx') && mod.default);

/** URL each screen is opened at (ids match the recorded fixtures). */
const URL_OF: Record<string, string> = {
  'admin/AdminAccess': '/admin/access',
  'admin/AdminActivity': '/admin/activity',
  'admin/AdminActivateCoach': '/admin/coaches/activate?id=1',
  'admin/AdminAthletes': '/admin/athletes',
  'admin/AdminBranding': '/admin/branding?id=1',
  'admin/AdminCoachDetails': '/admin/coach?id=1',
  'admin/AdminCoaches': '/admin/coaches',
  'admin/AdminCreateCoach': '/admin/coaches/new',
  'admin/AdminDashboard': '/admin',
  'admin/AdminLogin': '/admin/login',
  'admin/AdminSettings': '/admin/settings',
  'coach/CoachAnalyticsOverview': '/coach/analytics?id=1',
  'coach/CoachAssignProgram': '/coach/assign?id=2',
  'coach/CoachAthleteProfile': '/coach/athlete?id=1',
  'coach/CoachAthletes': '/coach/athletes',
  'coach/CoachBodyComposition': '/coach/analytics/body?id=1',
  'coach/CoachChat': '/coach/chat',
  'coach/CoachTeam': '/coach/team',
  'coach/CoachCreateAthlete': '/coach/athletes/new',
  'coach/CoachCreateExercise': '/coach/library/new',
  'coach/CoachCreateProgram': '/coach/programs/new',
  'coach/CoachDashboard': '/coach',
  'coach/CoachEnduranceSpeed': '/coach/analytics/endurance?id=1',
  'coach/CoachExerciseDetails': '/coach/exercise?id=1',
  'coach/CoachExerciseLibrary': '/coach/library',
  'coach/CoachLogin': '/coach/login',
  'coach/CoachNutritionPlan': '/coach/nutrition?id=1',
  'coach/CoachPersonalRecords': '/coach/analytics/records?id=1',
  'coach/CoachProgramBuilder': '/coach/builder?id=2',
  'coach/CoachProgramCustomization': '/coach/customize?id=1',
  'coach/CoachProgramTemplate': '/coach/program?id=2',
  'coach/CoachPrograms': '/coach/programs',
  'coach/CoachRecoveryAnalytics': '/coach/analytics/recovery?id=1',
  'coach/CoachRecoveryPlan': '/coach/recovery?id=1',
  'coach/CoachSettings': '/coach/settings',
  'coach/CoachStrengthAnalytics': '/coach/analytics/strength?id=1',
  'coach/CoachTrainingHistory': '/coach/history?id=1',
};
/** Redirect-only route (opens the athlete's program copy in the builder). */
const REDIRECTS = new Set(['coach/CoachProgramCustomization']);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('screens render from the API', () => {
  it('knows the URL of every screen', () => {
    const keys = screens.map(([file]) => file.replace('../screens/', '').replace('.tsx', ''));
    expect(keys.sort()).toEqual(Object.keys(URL_OF).sort());
  });

  it.each(screens)('%s', async (file, mod) => {
    const key = file.replace('../screens/', '').replace('.tsx', '');
    const url = URL_OF[key];
    window.history.replaceState(null, '', url);
    installFakeApi(key.startsWith('admin/') ? 'admin' : 'coach');
    const Page = mod.default as ComponentType;
    const { container } = renderScreen(<Page />, url);
    if (REDIRECTS.has(key)) return;
    await waitFor(() => expect(container.querySelector('.bl-page-state')).toBeNull(), { timeout: 4000 });
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(container.querySelector('.bl-error')).toBeNull();
  });
});
