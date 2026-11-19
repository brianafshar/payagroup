import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { branding } from '../api/auth';
import { LIVE } from '../api/config';
import { onNotificationTap } from '../api/push';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { session } from '../data/athlete';
import { startActivityTracking, touched, trackScreen } from '../data/activity';
import { ChatScreen } from '../screens/ChatScreen';
import { GroupScreen } from '../screens/GroupScreen';
import { CompleteScreen } from '../screens/CompleteScreen';
import { ExerciseScreen } from '../screens/ExerciseScreen';
import { HealthScreen } from '../screens/HealthScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InviteScreen } from '../screens/InviteScreen';
import { LogScreen } from '../screens/LogScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MeasureScreen } from '../screens/MeasureScreen';
import { NutritionScreen } from '../screens/NutritionScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { PasswordScreen } from '../screens/PasswordScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { SessionScreen } from '../screens/SessionScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { RecordsScreen } from '../screens/RecordsScreen';
import { RecoveryScreen } from '../screens/RecoveryScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { useTheme } from '../theme';
import { BottomTabBar } from '../ui';
import type { RootStackParamList, TabParamList } from './types';

export const navRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/** Deep links (`baseline://invite`, …) — also the URLs of the web build. */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['baseline://'],
  config: {
    screens: {
      Login: 'login',
      Invite: 'invite/:token?',
      Tabs: { screens: { Home: 'home', Workout: 'workout', Nutrition: 'nutrition', Recovery: 'recovery', Progress: 'progress', Profile: 'profile' } },
      Exercise: 'exercise/:e',
      Log: 'log/:e?',
      Complete: 'complete',
      Measure: 'measure/:tab?',
      Records: 'records',
      Health: 'health',
      Chat: 'chat',
      Group: 'group/:id',
      Notifications: 'notifications',
      Session: 'session/:id',
      Plan: 'plan',
      Password: 'password',
      Devices: 'devices',
    },
  },
};

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <BottomTabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Workout" component={WorkoutScreen} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
      <Tab.Screen name="Recovery" component={RecoveryScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** Signed out: login & invite. Signed in: tabs + detail screens (M34–M48). */
export function RootNavigator() {
  const { c, mode } = useTheme();
  const { signedIn, restoring, mustChangePassword } = session.use();
  const { appName } = branding.use();
  useEffect(() => {
    if (!LIVE || !signedIn) return;
    // A tapped chat notification opens the chat (once navigation is ready).
    return onNotificationTap((data) => {
      const open = () => {
        if (data.type === 'message') navRef.navigate('Chat');
        else if (data.type === 'group' && data.groupId) navRef.navigate('Group', { id: Number(data.groupId) });
        else if (data.type === 'feedback' && data.workoutId) navRef.navigate('Session', { id: Number(data.workoutId) });
      };
      if (data.type !== 'message' && data.type !== 'feedback' && data.type !== 'group') return;
      const go = () => (navRef.isReady() ? open() : setTimeout(go, 100));
      go();
    });
  }, [signedIn]);
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: c.background, card: c.surface, text: c['text-primary'], border: c.border, primary: c['brand-primary'] } };
  if (restoring)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c['brand-primary']} accessibilityLabel="در حال بارگذاری" />
      </View>
    );
  return (
    <View style={{ flex: 1 }} onTouchStart={touched}>
      <NavigationContainer
        ref={navRef}
        theme={navTheme}
        linking={linking}
        documentTitle={{ formatter: () => appName }}
        onReady={() => {
          startActivityTracking();
          trackScreen(navRef.getCurrentRoute()?.name);
        }}
        onStateChange={() => trackScreen(navRef.getCurrentRoute()?.name)}
      >
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_left' }}>
          {signedIn && mustChangePassword ? (
            <Stack.Screen name="Password" component={PasswordScreen} options={{ gestureEnabled: false }} />
          ) : signedIn ? (
            <>
              <Stack.Screen name="Tabs" component={Tabs} />
              <Stack.Screen name="Exercise" component={ExerciseScreen} />
              <Stack.Screen name="Log" component={LogScreen} />
              <Stack.Screen name="Complete" component={CompleteScreen} options={{ gestureEnabled: false }} />
              <Stack.Screen name="Measure" component={MeasureScreen} />
              <Stack.Screen name="Records" component={RecordsScreen} />
              <Stack.Screen name="Health" component={HealthScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Group" component={GroupScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="Session" component={SessionScreen} />
              <Stack.Screen name="Plan" component={PlanScreen} />
              <Stack.Screen name="Password" component={PasswordScreen} />
              <Stack.Screen name="Devices" component={DevicesScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Invite" component={InviteScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
