/**
 * Live events from the backend WebSocket (`/ws/`): new chat messages, read receipts, typing and group posts.
 * One shared socket per tab, opened on first subscription, authenticated with the access token in
 * the first frame, and reconnected with backoff. `status` lets the UI fall back to polling while
 * the socket is down.
 */
import { API_URL, freshAccessToken } from './http';

export type RealtimeEvent =
  | { type: 'message'; message: Record<string, unknown> & { id: number; athleteId: number; sender: 'coach' | 'athlete' } }
  | { type: 'update'; message: Record<string, unknown> & { id: number; athleteId: number; sender: 'coach' | 'athlete' } }
  | { type: 'read'; athleteId: number; reader: 'coach' | 'athlete'; at: string }
  | { type: 'typing'; athleteId: number; sender: 'coach' | 'athlete' }
  /** A broadcast group changed (#81): a new or edited post (`message`), or its name / members. */
  | { type: 'group'; groupId: number; message?: Record<string, unknown> & { id: number; groupId: number }; update?: boolean };

type Listener = (e: RealtimeEvent) => void;
type Status = 'idle' | 'connecting' | 'open' | 'closed';

const listeners = new Set<Listener>();
const statusListeners = new Set<(s: Status) => void>();
let ws: WebSocket | null = null;
let status: Status = 'idle';
let retry = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let ping: ReturnType<typeof setInterval> | null = null;

export function wsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  const base = /^https?:\/\//.test(API_URL) ? new URL(API_URL).origin : window.location.origin;
  return base.replace(/^http/, 'ws') + '/ws/';
}

function setStatus(s: Status) {
  status = s;
  statusListeners.forEach((l) => l(s));
}

async function open() {
  if (ws || !listeners.size) return;
  setStatus('connecting');
  const token = await freshAccessToken();
  if (!token) return setStatus('closed');
  const sock = new WebSocket(wsUrl());
  ws = sock;
  sock.onopen = () => sock.send(JSON.stringify({ type: 'auth', token }));
  sock.onmessage = (m) => {
    let data: { type: string } & Record<string, unknown>;
    try {
      data = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (data.type === 'ready') {
      retry = 0;
      setStatus('open');
      ping = setInterval(() => sock.readyState === WebSocket.OPEN && sock.send('{"type":"ping"}'), 25_000);
      return;
    }
    if (data.type === 'message' || data.type === 'update' || data.type === 'read' || data.type === 'typing' || data.type === 'group')
      listeners.forEach((l) => l(data as RealtimeEvent));
  };
  sock.onclose = () => {
    if (ping) clearInterval(ping);
    ping = null;
    ws = null;
    setStatus('closed');
    if (listeners.size) {
      const delay = Math.min(30_000, 1000 * 2 ** retry++);
      timer = setTimeout(open, delay);
    }
  };
}

/** Receive live events; returns the unsubscribe function. The socket closes with the last listener. */
export function subscribeRealtime(l: Listener): () => void {
  listeners.add(l);
  void open();
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      if (timer) clearTimeout(timer);
      ws?.close();
      ws = null;
    }
  };
}

export function onRealtimeStatus(l: (s: Status) => void): () => void {
  statusListeners.add(l);
  l(status);
  return () => {
    statusListeners.delete(l);
  };
}

export function sendTyping(athleteId: number): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'typing', athleteId }));
}
