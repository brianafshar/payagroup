/**
 * Live chat over the backend WebSocket (`/ws/`, protocol in backend/messaging/consumers.py): new
 * messages, read receipts, the coach typing and posts in the coach's groups. Authenticated with the access token in the first
 * frame; reconnects with backoff and catches up on missed messages by reloading the thread.
 * Close code 4003 means the account's sessions were ended (password change, admin) → sign out.
 */
import { AppState } from 'react-native';
import { wsUrl } from './config';
import { session } from '../data/athlete';
import * as live from '../data/live';
import { freshAccessToken } from './http';
import { saveTokens } from './tokens';

let ws: WebSocket | null = null;
let wanted = false;
let retry = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let ping: ReturnType<typeof setInterval> | null = null;
AppState.addEventListener?.('change', (s) => {
  // Phones suspend sockets in the background: reconnect (and catch up) when the app comes back.
  if (s === 'active' && wanted && !ws) void open();
  if (s === 'active' && wanted) void live.loadInbox().catch(() => {});
  if (s === 'active' && wanted) void live.loadGroups().catch(() => {});
  if (s === 'active' && wanted) void live.refreshTraining();
});

async function open() {
  if (ws || !wanted) return;
  const token = await freshAccessToken();
  if (!token || !wanted) return;
  const sock = new WebSocket(wsUrl());
  ws = sock;
  sock.onopen = () => sock.send(JSON.stringify({ type: 'auth', token }));
  sock.onmessage = (m) => {
    let data: { type: string } & Record<string, never>;
    try {
      data = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (data.type === 'ready') {
      if (retry) void live.loadChat().catch(() => {});
      retry = 0;
      ping = setInterval(() => sock.readyState === WebSocket.OPEN && sock.send('{"type":"ping"}'), 25_000);
    } else if (data.type === 'message') {
      live.receiveMessage(data.message);
      void live.loadInbox().catch(() => {});
    } else if (data.type === 'update') live.receiveUpdate(data.message);
    else if (data.type === 'read') live.receiveRead(data.reader, data.at);
    else if (data.type === 'typing' && data.sender === 'coach') live.receiveTyping();
    else if (data.type === 'group') live.receiveGroupEvent(data.groupId, data.message);
    else if (data.type === 'program') {
      // The coach assigned, edited or stopped one of our programs (#74).
      void live.refreshTraining(true);
      void live.loadInbox().catch(() => {});
    }
  };
  sock.onclose = (e) => {
    if (ping) clearInterval(ping);
    ping = null;
    if (ws === sock) ws = null;
    if (e.code === 4003) {
      wanted = false;
      void saveTokens(null).then(() => session.set({ signedIn: false }));
      return;
    }
    if (wanted) timer = setTimeout(open, Math.min(30_000, 1000 * 2 ** retry++));
  };
}

export function connectRealtime(): void {
  wanted = true;
  void open();
}

export function disconnectRealtime(): void {
  wanted = false;
  if (timer) clearTimeout(timer);
  ws?.close();
  ws = null;
}

let lastTyping = 0;
/** Tell the coach we're typing (at most every 3 s). */
export function sendTyping(): void {
  if (Date.now() - lastTyping < 3000 || ws?.readyState !== WebSocket.OPEN) return;
  lastTyping = Date.now();
  ws.send('{"type":"typing"}');
}
