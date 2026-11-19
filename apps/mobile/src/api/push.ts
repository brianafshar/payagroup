/**
 * Push notifications: after sign-in the app asks for permission, gets its push token and registers it at
 * `/api/devices/`; sign-out unregisters it. Two providers:
 * - Expo (default): the Expo push token. Needs an EAS project id (`extra.eas.projectId` in app.json).
 * - Pushe (`EXPO_PUBLIC_PUSH=pushe`, Android): the Pushe device id, for servers in Iran where Expo's
 *   service refuses requests. Needs a build with the Pushe manifest token (PUSHE_MANIFEST_TOKEN); the
 *   backend sends with PUSH_BACKEND=pushe. Tapping opens the screen through a baseline:// link.
 * Needs a development/store build on a physical device — elsewhere (Expo Go, simulators, the web build)
 * this quietly does nothing.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Pushe } from '../../modules/baseline-pushe';
import { http } from './http';
import { registerWebPush, unregisterWebPush } from './webpush';

const PROVIDER = process.env.EXPO_PUBLIC_PUSH === 'pushe' ? 'pushe' : 'expo';

type NotificationsModule = typeof import('expo-notifications');

/** Expo Go (`storeClient`) no longer supports remote push, and on Android even loading the module throws. */
export const PUSH_SUPPORTED = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let mod: NotificationsModule | null = null;
function notifications(): NotificationsModule | null {
  if (!PUSH_SUPPORTED) return null;
  if (!mod) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
    });
  }
  return mod;
}

let token: string | null = null;

export async function registerPush(): Promise<void> {
  if (Platform.OS === 'web') return registerWebPush();
  const Notifications = notifications();
  if (!Notifications || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'پیام‌ها و یادآوری‌ها', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    if (PROVIDER === 'pushe') {
      // Pushe registers itself on first launch; wait for it (up to 30 s) and send its device id.
      if (Platform.OS !== 'android' || !Pushe) return;
      token = await Pushe.getDeviceId(30_000);
      if (token) await http.post('/devices/', { token, platform: Platform.OS });
      return;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await http.post('/devices/', { token, platform: Platform.OS });
  } catch (e) {
    console.warn('push registration failed', e);
  }
}

export async function unregisterPush(): Promise<void> {
  if (Platform.OS === 'web') return unregisterWebPush();
  if (!token) return;
  await http.del('/devices/', { token }).catch(() => {});
  token = null;
}

/** Calls `open` with the notification's data when the user taps one (and for the one that launched the app). */
export function onNotificationTap(open: (data: Record<string, unknown>) => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => {};
  const last = Notifications.getLastNotificationResponse?.();
  if (last) open(last.notification.request.content.data ?? {});
  const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data ?? {}));
  return () => sub.remove();
}
