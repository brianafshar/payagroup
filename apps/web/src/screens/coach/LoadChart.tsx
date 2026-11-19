// Weekly training load against the athlete's own normal (#76) — replaces the Fitness & Freshness lines.
// Each bar is one week's session-RPE load; the shaded band behind it is that week's normal range
// (0.8–1.3 × the 4 weeks before, the acute:chronic «sweet spot»), and the bar's color says which zone
// the week landed in. Zones always come with a text label, never color alone.
import { useCallback, useRef, useState } from 'react';
import { faDayMonth, faDigits } from '@/lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;
const fa = (n: number | string) => faDigits(String(n)).replace('.', '٫');

export const ZONE: Record<string, { label: string; color: string; advice: string }> = {
  low: { label: 'کمتر از معمول', color: 'var(--viz-muted, var(--text-muted))', advice: 'بار کمتر از حد معمول اوست؛ اگر هفته استراحت نیست، آمادگی کم می‌شود.' },
  optimal: { label: 'محدوده مطلوب', color: 'var(--success)', advice: 'بار تمرین در محدوده‌ای است که آمادگی بالا می‌رود و ریسک آسیب کم است.' },
  high: { label: 'بالا', color: 'var(--warning)', advice: 'افزایش بار سریع است؛ مراقب خستگی و کیفیت جلسات باشید.' },
  danger: { label: 'جهش خطرناک', color: 'var(--error)', advice: 'بار خیلی سریع‌تر از معمول بالا رفته؛ ریسک آسیب بالاست، هفته بعد سبک‌تر کنید.' },
};

/** Rows for the chart's table view (screen readers, «نمایش به‌صورت جدول»). */
export function loadTable(weeks: Json[]) {
  return {
    columns: [
      { key: 'w', label: 'هفته' },
      { key: 'l', label: 'بار' },
      { key: 's', label: 'جلسات' },
      { key: 'r', label: 'محدوده معمول' },
      { key: 'z', label: 'وضعیت' },
    ],
    rows: weeks.map((w) => ({
      w: faDayMonth(new Date(w.start + 'T12:00:00')) + (w.current ? ' (در جریان)' : ''),
      l: fa(w.load),
      s: fa(w.sessions),
      r: w.average ? fa(Math.round(w.average * 0.8)) + '–' + fa(Math.round(w.average * 1.3)) : '—',
      z: w.zone ? ZONE[w.zone].label + ' · ' + fa(w.ratio) : '—',
    })),
  };
}

export function LoadChart({ weeks }: { weeks: Json[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at its real width so the labels stay readable on a phone.
  const [box, setBox] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const fit = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect();
    if (!el || typeof ResizeObserver === 'undefined') return;
    ro.current = new ResizeObserver(([e]) => setBox(Math.round(e.contentRect.width)));
    ro.current.observe(el);
  }, []);
  const W = box > 0 ? Math.max(280, box) : 1100,
    H = W < 600 ? 180 : 220,
    m = { t: 12, r: 8, b: 28, l: 48 };
  const top = Math.max(1, ...weeks.map((w) => Math.max(w.load, (w.average || 0) * 1.3)));
  const step = Math.pow(10, Math.floor(Math.log10(top))) / 2;
  const hi = Math.ceil(top / step) * step;
  const ih = H - m.t - m.b,
    band = (W - m.l - m.r) / weeks.length,
    bar = Math.min(band * 0.56, 44);
  const Y = (v: number) => m.t + ih - (v / hi) * ih;
  const ticks = [0, hi / 2, hi];
  const h = hover != null ? weeks[hover] : null;
  return (
    <div ref={fit} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="بار تمرین هفتگی" style={{ display: 'block', direction: 'ltr' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke="var(--border-subtle, var(--border))" strokeWidth={1} />
            <text x={m.l - 8} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {fa(Math.round(t))}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = m.l + band * i + (band - bar) / 2;
          const z = w.zone ? ZONE[w.zone] : null;
          return (
            <g key={w.start} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={m.l + band * i} y={m.t} width={band} height={ih} fill="transparent" />
              {w.average ? (
                <rect x={x - 4} width={bar + 8} y={Y(w.average * 1.3)} height={Y(w.average * 0.8) - Y(w.average * 1.3)} rx={3} fill="var(--success)" opacity={0.12} />
              ) : null}
              {w.load ? (
                <path
                  d={`M${x},${Y(0)} V${Y(w.load) + 4} q0,-4 4,-4 h${bar - 8} q4,0 4,4 V${Y(0)} Z`}
                  fill={w.current ? 'var(--viz-muted, var(--text-muted))' : z ? z.color : 'var(--brand-primary)'}
                  opacity={w.current ? 0.55 : hover == null || hover === i ? 1 : 0.6}
                />
              ) : null}
              <text x={x + bar / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                {(weeks.length - 1 - i) % (W < 600 ? 4 : 2) === 0 ? faDayMonth(new Date(w.start + 'T12:00:00')) : ''}
              </text>
            </g>
          );
        })}
      </svg>
      {h ? (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: 0,
            left: `${((m.l + band * hover! + band / 2) / W) * 100}%`,
            transform: 'translateX(-50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            lineHeight: '18px',
            boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,.12))',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <div style={{ fontWeight: 600 }}>{'هفته ' + faDayMonth(new Date(h.start + 'T12:00:00')) + (h.current ? ' (در جریان)' : '')}</div>
          <div>{'بار: ' + fa(h.load) + ' · ' + fa(h.sessions) + ' جلسه'}</div>
          {h.average ? <div style={{ color: 'var(--text-secondary)' }}>{'محدوده معمول: ' + fa(Math.round(h.average * 0.8)) + '–' + fa(Math.round(h.average * 1.3))}</div> : null}
          {h.zone ? <div style={{ fontWeight: 600 }}>{ZONE[h.zone].label + ' · نسبت ' + fa(h.ratio)}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
