/**
 * Web Push for the athlete web app (browsers, and the app added to an iPhone's home screen — iOS 16.4+
 * only gives push to installed home-screen apps). The service worker is `public/sw.js`; the API sends with
 * the VAPID key it reports at `/push/config/`. The subscription JSON is this browser's device token.
 */
import { Platform } from 'react-native';
import { http } from './http';

export type WebPushState =
  | 'unsupported' // not a browser, or no Push API
  | 'install-first' // iPhone Safari: push only works after Add to Home Screen
  | 'off' // the server has no Web Push key
  | 'denied' // the user blocked notifications for this site
  | 'ask' // can be turned on with a tap
  | 'on';

const nav = (): Navigator | null => (Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator : null);

export function isIOS(): boolean {
  const n = nav();
  if (!n) return false;
  return /iPad|iPhone|iPod/.test(n.userAgent) || (n.userAgent.includes('Macintosh') && n.maxTouchPoints > 1);
}

/** Running as an installed app (home screen), not in a browser tab. */
export function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (nav() as Navigator & { standalone?: boolean })?.standalone === true;
}

function supported(): boolean {
  return !!nav() && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
}

let key: string | null | undefined;
async function serverKey(): Promise<string | null> {
  if (key === undefined) key = (await http.get<{ webPushKey: string | null }>('/push/config/').catch(() => ({ webPushKey: null }))).webPushKey;
  return key;
}

function keyBytes(b64url: string): ArrayBuffer {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)).buffer as ArrayBuffer;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

let subscription: string | null = null;

export async function webPushState(): Promise<WebPushState> {
  if (!supported()) return isIOS() && !isStandalone() ? 'install-first' : 'unsupported';
  if (!(await serverKey())) return 'off';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) return 'on';
  }
  return 'ask';
}

async function subscribe(): Promise<boolean> {
  const k = await serverKey();
  if (!k) return false;
  const reg = await registration();
  // The browser asks its push service (Apple / Google) for an address; give up after 20 s.
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('push subscribe timed out')), 20_000));
  const sub = (await reg.pushManager.getSubscription()) || (await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(k) }), timeout]));
  subscription = JSON.stringify(sub.toJSON());
  await http.post('/devices/', { token: subscription, platform: 'web' });
  return true;
}

/** After sign-in: keep an existing permission's subscription registered (no prompt). */
export async function registerWebPush(): Promise<void> {
  if (!supported()) return;
  try {
    await registration();
    if (Notification.permission === 'granted') await subscribe();
  } catch (e) {
    console.warn('web push registration failed', e);
  }
}

/** The «فعال کردن اعلان‌ها» button: asks for permission (needs the tap) and subscribes. */
export async function enableWebPush(): Promise<WebPushState> {
  if (!supported()) return webPushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'ask';
  return (await subscribe()) ? 'on' : 'off';
}

/** Before sign-out: this browser stops receiving the account's notifications. */
export async function unregisterWebPush(): Promise<void> {
  if (!subscription) return;
  await http.del('/devices/', { token: subscription }).catch(() => {});
  subscription = null;
}
