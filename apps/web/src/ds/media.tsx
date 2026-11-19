import { useEffect, useState, type ReactNode } from 'react';
import { Button, Spinner } from './actions';
import { Icon } from './Icon';
import { cx, fmt } from './utils';

export interface VideoPlayerProps {
  state?: 'idle' | 'playing' | 'loading' | 'error' | 'empty';
  title?: string;
  /** `m:ss` */
  duration?: string;
  caption?: ReactNode;
  captions?: boolean;
  emptyTitle?: ReactNode;
  emptyAction?: ReactNode;
  onEmptyAction?: () => void;
}

/** Exercise video with simulated playback (the real file is a coach upload). */
export function VideoPlayer(p: VideoPlayerProps) {
  const st = p.state || 'idle';
  const toSec = (s?: string) => {
    const m = String(s || '0:45').split(':');
    return +m[0] * 60 + (+m[1] || 0);
  };
  const fmtT = (t: number) => {
    t = Math.round(t);
    return fmt(Math.floor(t / 60)) + ':' + (t % 60 < 10 ? '۰' : '') + fmt(t % 60);
  };
  const total = toSec(p.duration);
  const [playing, setPlaying] = useState(st === 'playing');
  const [pos, setPos] = useState(0);
  const [cc, setCc] = useState(!!p.captions);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setPos((x) => {
        if (x + 0.25 >= total) {
          setPlaying(false);
          return total;
        }
        return x + 0.25;
      });
    }, 250);
    return () => clearInterval(t);
  }, [playing, total]);
  const toggle = () => {
    if (!playing && pos >= total) setPos(0);
    setPlaying(!playing);
  };
  if (st === 'empty')
    return (
      <div className="bl-video is-empty">
        <Icon name="video" size={28} />
        <div className="bl-video-empty-t">{p.emptyTitle || 'هنوز ویدیویی نیست'}</div>
        {p.emptyAction ? (
          <Button variant="secondary" size="sm" icon="upload" onClick={p.onEmptyAction}>
            {p.emptyAction}
          </Button>
        ) : null}
      </div>
    );
  const pct = total ? (pos / total) * 100 : 0;
  return (
    <div className={cx('bl-video', st === 'error' && 'is-error')} role="region" aria-label={'ویدیو: ' + (p.title || 'نمایش حرکت')}>
      <div className="bl-video-stage" onClick={st === 'idle' || st === 'playing' ? toggle : undefined} style={{ cursor: 'pointer' }}>
        {st === 'error' ? (
          <div className="bl-video-msg">
            <Icon name="alert-circle" size={24} />
            <span>این ویدیو در حال حاضر قابل پخش نیست.</span>
            <Button variant="secondary" size="sm" icon="refresh">
              تلاش دوباره
            </Button>
          </div>
        ) : st === 'loading' ? (
          <Spinner size="lg" label="در حال بارگذاری ویدیو" />
        ) : !playing ? (
          <button type="button" className="bl-video-play" aria-label={'پخش ' + (p.title || 'ویدیو')}>
            <Icon name="play" size={26} />
          </button>
        ) : null}
        {p.title && !playing ? <div className="bl-video-title">{p.title}</div> : null}
        {cc && playing ? (
          <div style={{ position: 'absolute', bottom: 12, insetInline: 0, textAlign: 'center' }}>
            <span style={{ background: 'rgba(0,0,0,.7)', color: '#fff', padding: '4px 10px', borderRadius: 4, fontSize: 14 }}>
              {p.caption || 'میله را کنترل‌شده تا پایین سینه پایین بیاورید.'}
            </span>
          </div>
        ) : null}
      </div>
      {st !== 'error' ? (
        <div className="bl-video-bar">
          <button type="button" className="bl-video-ctl" aria-label={playing ? 'توقف' : 'پخش'} onClick={toggle}>
            <Icon name={playing ? 'pause' : 'play'} size={16} />
          </button>
          <span className="bl-video-time" dir="ltr">
            {fmtT(pos) + ' / ' + fmtT(total)}
          </span>
          <div
            className="bl-video-track"
            role="slider"
            aria-label="جابه‌جایی"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
              const f = rtl ? (r.right - e.clientX) / r.width : (e.clientX - r.left) / r.width;
              setPos(Math.max(0, Math.min(1, f)) * total);
            }}
          >
            <div className="bl-video-prog" style={{ width: pct + '%' }} />
          </div>
          <button
            type="button"
            className="bl-video-ctl"
            aria-label="زیرنویس"
            aria-pressed={cc}
            onClick={() => setCc(!cc)}
            style={cc ? { color: 'var(--brand-primary)' } : undefined}
          >
            <span className="bl-video-cc">CC</span>
          </button>
          <button
            type="button"
            className="bl-video-ctl"
            aria-label="تمام صفحه"
            onClick={(e) => {
              const el = e.currentTarget.closest('.bl-video');
              if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
            }}
          >
            <Icon name="maximize" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
