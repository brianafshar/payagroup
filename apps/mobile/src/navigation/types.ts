import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Workout: undefined;
  Nutrition: undefined;
  Recovery: undefined;
  Progress: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  /** `token` from the invite link (`baseline://invite/<token>`); `step` previews a state of the design. */
  Invite: { token?: string; step?: 'mail' | 'accept' | 'expired' } | undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Exercise: { e: number };
  Log: { e?: number } | undefined;
  Complete: undefined;
  Measure: { tab?: 'new' | 'hist' } | undefined;
  Records: undefined;
  Health: undefined;
  Chat: undefined;
  /** A coach's broadcast group (#81), read only. */
  Group: { id: number };
  Notifications: undefined;
  /** A logged session with the coach's feedback. */
  Session: { id: number };
  /** The program week by week (what's tomorrow, next week). */
  Plan: undefined;
  /** Change password (from the profile, or forced after signing in with an emailed temporary password). */
  Password: undefined;
  /** Devices signed in to the account; sign one out. */
  Devices: undefined;
};

export type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Typed navigation for any screen (tabs are reached with `nav.navigate('Tabs', { screen })`). */
export function useNav(): Nav {
  return useNavigation<Nav>();
}
