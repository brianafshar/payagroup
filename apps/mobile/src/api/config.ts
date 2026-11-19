/**
 * Live mode: the app talks to the Django API at `EXPO_PUBLIC_API_URL` (e.g. `http://192.168.1.20:8000/api`
 * for a phone on the same Wi-Fi). Without it (tests, design review) the app runs on its built-in data.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export const LIVE = Boolean(API_URL);

/** WebSocket endpoint for live chat, derived from the API URL unless `EXPO_PUBLIC_WS_URL` is set. */
export function wsUrl(): string {
  if (process.env.EXPO_PUBLIC_WS_URL) return process.env.EXPO_PUBLIC_WS_URL;
  const origin = API_URL.match(/^https?:\/\/[^/]+/)?.[0] || (typeof window !== 'undefined' ? window.location.origin : '');
  return origin.replace(/^http/, 'ws') + '/ws/';
}

/** The panel's website (help and privacy pages live there, #79). */
export const SITE_URL = API_URL.replace(/\/api$/, '');
