// A progress chart over time: dated points grouped by day / week / month (box in the corner), with the
// X axis movable by dragging (mouse or finger), the mouse wheel or the ‹ › buttons.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buckets, groupPoints, WINDOW, type Agg, type DatedPoint, type Granularity } from '@baseline/core';
import { BarChart, ChartContainer, ChartLegend, IconButton, LineChart } from '@/ds';
import { faDigits } from '@/lib/format';

export interface TimeSeries {
  name: string;
  points: DatedPoint[];
  color: string;
}

const GRAN: Array<[Granularity, string]> = [
  ['day', 'روزانه'],
  ['week', 'هفتگی'],
  ['month', 'ماهانه'],
];

export function TimeChart({
  title,
  summary,
  footnote,
  series,
  from,
  to,
  kind = 'line',
  agg = 'avg',
  unit,
  initial = 'week',
  empty,
  height = 200,
}: {
  title: string;
  summary?: ReactNode;
  footnote?: ReactNode;
  series: TimeSeries[];
  /** Range of the axis (ISO dates). */
  from: string;
  to: string;
  kind?: 'line' | 'bar' | 'stacked';
  agg?: Agg;
  unit?: string;
  initial?: Granularity;
  empty?: string;
  height?: number;
}) {
  const [gran, setGran] = useState<Granularity>(initial);
  const bs = useMemo(() => buckets(from, to, gran), [from, to, gran]);
  const values = useMemo(() => series.map((s) => groupPoints(s.points, bs, gran, agg)), [series, bs, gran, agg]);
  const win = Math.min(WINDOW[gran], bs.length);
  const [end, setEnd] = useState(bs.length); // exclusive; the latest periods by default
  useEffect(() => setEnd(bs.length), [bs.length]);
  const clamp = (e: number) => Math.max(win, Math.min(bs.length, e));
  const e = clamp(end);
  const s0 = e - win;
  const hasData = series.some((s) => s.points.some((p) => p.value != null));

  // Drag / swipe / wheel: one period per band width moved.
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; end: number } | null>(null);
  const band = () => (box.current ? box.current.clientWidth / Math.max(1, win) : 40);
  const onDown = (ev: React.PointerEvent) => {
    if (bs.length <= win) return;
    drag.current = { x: ev.clientX, end: e };
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  };
  const onMove = (ev: React.PointerEvent) => {
    if (!drag.current) return;
    // The chart runs left (old) → right (new): dragging right shows older periods.
    setEnd(clamp(drag.current.end - Math.round((ev.clientX - drag.current.x) / band())));
  };
  const onUp = () => (drag.current = null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (bs.length <= win) return;
      ev.preventDefault();
      const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
      setEnd((x) => clamp(clamp(x) + (d > 0 ? 1 : -1)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const labels = bs.slice(s0, e).map((b) => b.label);
  const shown = series.map((s, i) => ({ name: s.name, color: s.color, values: values[i].slice(s0, e) }));
  const range = labels.length ? labels[0] + ' تا ' + labels[labels.length - 1] : '';
  return (
    <ChartContainer title={title} summary={summary} footnote={footnote}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div role="radiogroup" aria-label="بازه هر ستون" className="bl-seg bl-seg-sm">
          {GRAN.map(([g, label]) => (
            <button key={g} type="button" role="radio" aria-checked={gran === g} className={'bl-seg-opt' + (gran === g ? ' is-on' : '')} onClick={() => setGran(g)}>
              {label}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {bs.length > win ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{range}</span>
            <IconButton icon="chevron-right" label="جدیدتر" size="sm" variant="ghost" disabled={e >= bs.length} onClick={() => setEnd(clamp(e + win))} />
            <IconButton icon="chevron-left" label="قدیمی‌تر" size="sm" variant="ghost" disabled={s0 <= 0} onClick={() => setEnd(clamp(e - win))} />
          </>
        ) : null}
      </div>
      {hasData ? (
        <div
          ref={box}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          title={bs.length > win ? 'برای جابه‌جایی محور زمان بکشید یا اسکرول کنید' : undefined}
          style={{ cursor: bs.length > win ? 'grab' : undefined, touchAction: 'pan-y', userSelect: 'none' }}
        >
          {kind === 'line' ? (
            <LineChart labels={labels} series={shown} unit={unit} height={height} width={560} />
          ) : (
            <BarChart labels={labels} series={shown} stacked={kind === 'stacked'} unit={unit} height={height} width={560} maxBar={gran === 'day' ? 16 : 24} />
          )}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{empty || 'در این بازه داده‌ای ثبت نشده.'}</p>
      )}
      {hasData && series.length > 1 ? <ChartLegend items={series.map((s) => ({ label: s.name, color: s.color, shape: kind === 'line' ? 'line' : 'bar' }))} /> : null}
    </ChartContainer>
  );
}

export const faN = (n: number | null | undefined, d = 1) => (n == null ? '—' : faDigits(String(+n.toFixed(d))).replace('.', '٫'));
