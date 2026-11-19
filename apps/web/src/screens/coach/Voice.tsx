// Voice messages in the coach chat: recording in the composer (MediaRecorder; up to 5 minutes) and a
// small player in the bubble. Recording needs a secure page (https or localhost) and microphone access.
import { useEffect, useRef, useState } from 'react';
import { Button, Icon, IconButton } from '@/ds';
import { toast } from '@/lib/toast';

export const MAX_VOICE_SEC = 300;
const fa = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
export const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return fa(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
};

/** Browser formats in order of preference, with the file extension the server expects. */
const FORMATS: Array<[string, string]> = [
  ['audio/webm;codecs=opus', 'webm'],
  ['audio/webm', 'webm'],
  ['audio/mp4', 'm4a'],
  ['audio/ogg;codecs=opus', 'ogg'],
];

export interface Recording {
  blob: Blob;
  sec: number;
  ext: string;
}

export const canRecord = () => typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;

/** The composer while recording: red dot, timer, cancel and send. Recording starts on mount. */
export function VoiceRecorder({ onSend, onCancel }: { onSend: (r: Recording) => void; onCancel: () => void }) {
  const [sec, setSec] = useState(0);
  const [ready, setReady] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const sendOnStop = useRef(false);
  const ext = useRef('webm');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const fmt = FORMATS.find(([m]) => MediaRecorder.isTypeSupported?.(m));
        ext.current = fmt?.[1] || 'webm';
        const r = new MediaRecorder(s, fmt ? { mimeType: fmt[0] } : undefined);
        r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        r.onstop = () => {
          stream?.getTracks().forEach((t) => t.stop());
          const length = (Date.now() - started.current) / 1000;
          if (sendOnStop.current && chunks.current.length && length >= 0.5) {
            onSend({ blob: new Blob(chunks.current, { type: r.mimeType || fmt?.[0] || 'audio/webm' }), sec: Math.min(MAX_VOICE_SEC, length), ext: ext.current });
          } else if (sendOnStop.current) {
            toast('خیلی کوتاه بود', 'برای پیام صوتی کمی بیشتر صحبت کنید.', 'error');
            onCancel();
          }
        };
        rec.current = r;
        started.current = Date.now();
        r.start(250);
        setReady(true);
        timer = setInterval(() => {
          const t = (Date.now() - started.current) / 1000;
          setSec(t);
          if (t >= MAX_VOICE_SEC) stop(true);
        }, 200);
      })
      .catch((e: Error) => {
        toast(
          'میکروفون در دسترس نیست',
          e?.name === 'NotAllowedError' ? 'اجازه دسترسی به میکروفون را در مرورگر بدهید.' : 'میکروفونی پیدا نشد یا صفحه روی https باز نشده است.',
          'error',
        );
        onCancel();
      });
    return () => {
      alive = false;
      clearInterval(timer);
      if (rec.current?.state === 'recording') {
        sendOnStop.current = false;
        rec.current.stop();
      }
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop(send: boolean) {
    sendOnStop.current = send;
    if (rec.current?.state === 'recording') rec.current.stop();
    if (!send) onCancel();
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 40, flex: 1 }} aria-live="polite">
      <IconButton icon="trash" label="لغو ضبط" variant="secondary" onClick={() => stop(false)} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-sunken)',
        }}
      >
        <span className="bl-rec-dot" style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--error)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{clock(sec)}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ready ? 'در حال ضبط… حداکثر ' + clock(MAX_VOICE_SEC) : 'در انتظار میکروفون…'}
        </span>
      </div>
      <Button variant="primary" icon="send" disabled={!ready} onClick={() => stop(true)}>
        ارسال
      </Button>
    </div>
  );
}

/** Play / pause, a seekable bar and the time, inside a chat bubble. */
export function VoicePlayer({ src, sec }: { src: string; sec: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [len, setLen] = useState(sec);
  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      // One voice message at a time.
      document.querySelectorAll<HTMLAudioElement>('audio.bl-voice').forEach((x) => x !== a && x.pause());
      void a.play().catch(() => toast('پخش نشد', 'فایل صوتی در این مرورگر پخش نمی‌شود.', 'error'));
    } else a.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audio.current;
    if (!a || !len) return;
    const r = e.currentTarget.getBoundingClientRect();
    // The bar fills right → left (RTL).
    const f = Math.min(1, Math.max(0, (r.right - e.clientX) / r.width));
    a.currentTime = f * len;
    setPos(a.currentTime);
  };
  const pct = len ? Math.min(100, (pos / len) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
      <audio
        ref={audio}
        className="bl-voice"
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLen(e.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'توقف' : 'پخش پیام صوتی'}
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 18,
          border: 0,
          cursor: 'pointer',
          background: 'var(--brand-primary)',
          color: 'var(--on-brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={16} />
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          role="slider"
          aria-label="جابه‌جایی در پیام صوتی"
          aria-valuemin={0}
          aria-valuemax={Math.round(len)}
          aria-valuenow={Math.round(pos)}
          onClick={seek}
          style={{ height: 16, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', width: '100%', height: 4, borderRadius: 2, background: 'var(--border)' }}>
            <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: pct + '%', borderRadius: 2, background: 'var(--brand-primary)' }} />
          </div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, lineHeight: '14px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          <Icon name="mic" size={12} />
          {playing || pos ? clock(pos) + ' / ' + clock(len) : clock(len)}
        </span>
      </div>
    </div>
  );
}
