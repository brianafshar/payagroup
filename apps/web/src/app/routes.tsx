import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { ROUTES, type RouteKey } from '@/lib/routes';

type Page = LazyExoticComponent<ComponentType>;

/** Route key → screen. Screens are code-split; each one is a port of a design file (A01–C33). */
export const SCREENS: Partial<Record<RouteKey, Page>> = {
  login: lazy(() => import('@/screens/admin/AdminLogin')),
  'admin:dashboard': lazy(() => import('@/screens/admin/AdminDashboard')),
  'admin:coaches': lazy(() => import('@/screens/admin/AdminCoaches')),
  'admin:create-coach': lazy(() => import('@/screens/admin/AdminCreateCoach')),
  'admin:activate-coach': lazy(() => import('@/screens/admin/AdminActivateCoach')),
  'admin:coach': lazy(() => import('@/screens/admin/AdminCoachDetails')),
  'admin:athletes': lazy(() => import('@/screens/admin/AdminAthletes')),
  'admin:branding': lazy(() => import('@/screens/admin/AdminBranding')),
  'admin:access': lazy(() => import('@/screens/admin/AdminAccess')),
  'admin:settings': lazy(() => import('@/screens/admin/AdminSettings')),
  'admin:activity': lazy(() => import('@/screens/admin/AdminActivity')),
  'coach:login': lazy(() => import('@/screens/coach/CoachLogin')),
  'coach:dashboard': lazy(() => import('@/screens/coach/CoachDashboard')),
  'coach:athletes': lazy(() => import('@/screens/coach/CoachAthletes')),
  'coach:athlete': lazy(() => import('@/screens/coach/CoachAthleteProfile')),
  'coach:create-athlete': lazy(() => import('@/screens/coach/CoachCreateAthlete')),
  'coach:library': lazy(() => import('@/screens/coach/CoachExerciseLibrary')),
  'coach:create-exercise': lazy(() => import('@/screens/coach/CoachCreateExercise')),
  'coach:exercise': lazy(() => import('@/screens/coach/CoachExerciseDetails')),
  'coach:programs': lazy(() => import('@/screens/coach/CoachPrograms')),
  'coach:create-program': lazy(() => import('@/screens/coach/CoachCreateProgram')),
  'coach:program-builder': lazy(() => import('@/screens/coach/CoachProgramBuilder')),
  'coach:program': lazy(() => import('@/screens/coach/CoachProgramTemplate')),
  'coach:assign': lazy(() => import('@/screens/coach/CoachAssignProgram')),
  'coach:customize': lazy(() => import('@/screens/coach/CoachProgramCustomization')),
  'coach:history': lazy(() => import('@/screens/coach/CoachTrainingHistory')),
  'coach:nutrition': lazy(() => import('@/screens/coach/CoachNutritionPlan')),
  'coach:recovery': lazy(() => import('@/screens/coach/CoachRecoveryPlan')),
  'coach:analytics': lazy(() => import('@/screens/coach/CoachAnalyticsOverview')),
  'coach:strength': lazy(() => import('@/screens/coach/CoachStrengthAnalytics')),
  'coach:endurance': lazy(() => import('@/screens/coach/CoachEnduranceSpeed')),
  'coach:body': lazy(() => import('@/screens/coach/CoachBodyComposition')),
  'coach:recovery-analytics': lazy(() => import('@/screens/coach/CoachRecoveryAnalytics')),
  'coach:records': lazy(() => import('@/screens/coach/CoachPersonalRecords')),
  'coach:settings': lazy(() => import('@/screens/coach/CoachSettings')),
  'coach:chat': lazy(() => import('@/screens/coach/CoachChat')),
};

/** Unique path → screen pairs (a key whose path another key already serves is skipped). */
export function screenRoutes(): Array<{ path: string; Page: Page }> {
  const seen = new Set<string>();
  const out: Array<{ path: string; Page: Page }> = [];
  (Object.keys(SCREENS) as RouteKey[]).forEach((k) => {
    const path = ROUTES[k];
    const Page = SCREENS[k];
    if (!Page || seen.has(path)) return;
    seen.add(path);
    out.push({ path, Page });
  });
  return out;
}
