import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { STATUS, statusOf } from './status';
import { cx, fmt, num, type Numeric } from './utils';

type IconRef = IconName | (string & {});

export interface TrendProps {
  value?: Numeric;
  /** Default `%`; empty string for a bare number. */
  unit?: string | null;
  goodDirection?: 'up' | 'down' | 'none';
  decimals?: Numeric;
  label?: ReactNode;
  size?: 'sm' | 'md';
}

/** Signed change with a semantic tone (green when moving in the good direction). */
export function TrendIndicator(p: TrendProps) {
  const v = num(p.value, 0);
  const u = p.unit == null ? '%' : p.unit;
  const g = p.goodDirection || 'up';
  const dir = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  const tone = dir === 'flat' || g === 'none' ? 'neutral' : dir === g ? 'success' : 'error';
  const txt = (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v), num(p.decimals, 1)) + (u === '%' ? '٪' : u ? ' ' + u : '');
  return (
    <span className={cx('bl-trend', 'bl-trend-' + tone, p.size === 'sm' && 'bl-trend-sm')}>
      <Icon name={dir === 'up' ? 'arrow-up-right' : dir === 'down' ? 'arrow-down-right' : 'arrow-right'} size={p.size === 'sm' ? 12 : 14} stroke={2.25} />
      <span className="bl-sr">{dir === 'up' ? 'افزایش ' : dir === 'down' ? 'کاهش ' : 'بدون تغییر '}</span>
      <span>{txt}</span>
      {p.label ? <span className="bl-trend-label">{p.label}</span> : null}
    </span>
  );
}

export function Sparkline(p: { values?: Array<Numeric | null>; width?: Numeric; height?: Numeric; color?: string }) {
  const vals = (p.values || []).map((v) => (v == null ? null : Number(v)));
  const w = num(p.width, 96);
  const ht = num(p.height, 28);
  const pad = 3;
  const nums = vals.filter((v): v is number => v != null);
  if (nums.length < 2)
    return (
      <svg width={w} height={ht} className="bl-spark" aria-hidden="true">
        <line x1={0} x2={w} y1={ht / 2} y2={ht / 2} className="bl-spark-empty" />
      </svg>
    );
  const mn = Math.min(...nums);
  const mx = Math.max(...nums);
  const rng = mx - mn || 1;
  const X = (i: number) => pad + (i * (w - 2 * pad)) / (vals.length - 1);
  const Y = (v: number) => ht - pad - ((v - mn) / rng) * (ht - 2 * pad);
  let d = '';
  let pen = false;
  vals.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
    pen = true;
  });
  let li = vals.length - 1;
  while (li >= 0 && vals[li] == null) li--;
  return (
    <svg width={w} height={ht} viewBox={'0 0 ' + w + ' ' + ht} className="bl-spark" aria-hidden="true" style={{ color: 'var(--' + (p.color || 'viz-1') + ')' }}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      {li >= 0 ? <circle cx={X(li)} cy={Y(vals[li] as number)} r={2.5} fill="currentColor" /> : null}
    </svg>
  );
}

export interface MetricCardProps {
  label?: ReactNode;
  value?: ReactNode;
  unit?: ReactNode;
  icon?: IconRef;
  delta?: Numeric | null;
  deltaUnit?: string;
  goodDirection?: 'up' | 'down' | 'none';
  caption?: ReactNode;
  spark?: Array<Numeric | null>;
  sparkColor?: string;
  notRecorded?: boolean;
  emptyLabel?: ReactNode;
  emptyHint?: ReactNode;
  flat?: boolean;
  size?: 'sm' | 'md';
}

export function MetricCard(p: MetricCardProps) {
  const empty = p.notRecorded || p.value == null || p.value === '';
  return (
    <div className={cx('bl-metric', p.flat && 'is-flat', p.size === 'sm' && 'bl-metric-sm')}>
      <div className="bl-metric-label">
        {p.icon ? <Icon name={p.icon} size={16} /> : null}
        <span>{p.label}</span>
      </div>
      <div className="bl-metric-row">
        {empty ? (
          <span className="bl-nr bl-metric-empty">{p.emptyLabel || 'هنوز داده‌ای نیست'}</span>
        ) : (
          <span className="bl-metric-value">
            {p.value}
            {p.unit ? <span className="bl-metric-unit">{p.unit}</span> : null}
          </span>
        )}
        {(p.spark || []).length && !empty ? <Sparkline values={p.spark} width={80} height={32} color={p.sparkColor} /> : null}
      </div>
      {!empty && (p.delta != null || p.caption) ? (
        <div className="bl-metric-foot">
          {p.delta != null ? <TrendIndicator value={p.delta} unit={p.deltaUnit} goodDirection={p.goodDirection} size="sm" /> : null}
          {p.caption ? <span className="bl-metric-cap">{p.caption}</span> : null}
        </div>
      ) : empty && p.emptyHint ? (
        <div className="bl-metric-foot">
          <span className="bl-metric-cap">{p.emptyHint}</span>
        </div>
      ) : null}
    </div>
  );
}

export function StatCard(p: {
  label?: ReactNode;
  current?: ReactNode;
  unit?: string;
  date?: ReactNode;
  previous?: ReactNode;
  previousDate?: ReactNode;
  change?: Numeric | null;
  changeUnit?: string;
  goodDirection?: 'up' | 'down' | 'none';
  spark?: Array<Numeric | null>;
  sparkWidth?: Numeric;
  notRecorded?: boolean;
  selected?: boolean;
}) {
  const nr = p.notRecorded || p.current == null || p.current === '';
  const u = p.unit ? (p.unit === '%' ? '%' : ' ' + p.unit) : '';
  return (
    <div className={cx('bl-stat', p.selected && 'is-selected')}>
      <div className="bl-stat-head">
        <span className="bl-stat-label">{p.label}</span>
        {p.date && !nr ? <span className="bl-stat-date">{p.date}</span> : null}
      </div>
      {nr ? (
        <div className="bl-stat-value bl-nr">ثبت نشده</div>
      ) : (
        <div className="bl-stat-value">
          {p.current}
          {p.unit ? <span className="bl-metric-unit">{p.unit}</span> : null}
        </div>
      )}
      <dl className="bl-stat-dl">
        <div>
          <dt>{nr ? 'آخرین ثبت' : 'قبلی'}</dt>
          <dd>
            <bdi style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>
              {p.previous != null ? (
                <>
                  {p.previous}
                  {u}
                </>
              ) : (
                '—'
              )}
            </bdi>
            {p.previousDate ? (
              <span className="bl-muted" style={{ display: 'block', whiteSpace: 'nowrap' }}>
                {p.previousDate}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>تغییر</dt>
          <dd>
            {!nr && p.change != null ? (
              <TrendIndicator value={p.change} unit={p.changeUnit != null ? p.changeUnit : p.unit} goodDirection={p.goodDirection || 'none'} size="sm" />
            ) : (
              <span className="bl-muted">{'—'}</span>
            )}
          </dd>
        </div>
      </dl>
      {(p.spark || []).length ? (
        <div className="bl-stat-spark" style={{ width: '100%', overflow: 'hidden' }}>
          <Sparkline values={p.spark} width={num(p.sparkWidth, 200)} height={28} color="viz-1" />
        </div>
      ) : null}
    </div>
  );
}

export function ProgressBar(p: {
  value?: Numeric;
  max?: Numeric;
  target?: Numeric;
  label?: ReactNode;
  valueLabel?: ReactNode;
  ariaLabel?: string;
  hint?: ReactNode;
  tone?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const max = num(p.max, 100);
  const v = Math.max(0, Math.min(num(p.value, 0), max));
  const pct = max ? (v / max) * 100 : 0;
  const t = num(p.target);
  return (
    <div className={cx('bl-pbar', p.size && 'bl-pbar-' + p.size)}>
      {p.label || p.valueLabel ? (
        <div className="bl-pbar-head">
          <span className="bl-pbar-label">{p.label}</span>
          <span className="bl-pbar-val">{p.valueLabel != null ? p.valueLabel : Math.round(pct) + '%'}</span>
        </div>
      ) : null}
      <div
        className="bl-pbar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={v}
        aria-label={typeof p.label === 'string' ? p.label : p.ariaLabel}
        aria-valuetext={typeof p.valueLabel === 'string' ? p.valueLabel : undefined}
      >
        <div className={cx('bl-pbar-fill', p.tone && 'bl-bg-' + p.tone)} style={{ width: pct + '%' }} />
        {t !== undefined ? <div className="bl-pbar-target" style={{ insetInlineStart: (t / max) * 100 + '%' }} title="هدف" /> : null}
      </div>
      {p.hint ? <div className="bl-pbar-hint">{p.hint}</div> : null}
    </div>
  );
}

export function ProgressRing(p: { value?: Numeric; size?: Numeric; stroke?: Numeric; label?: ReactNode; valueLabel?: ReactNode; ariaLabel?: string; tone?: string }) {
  const size = num(p.size, 96);
  const sw = num(p.stroke, size >= 88 ? 8 : 6);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(num(p.value, 0), 100));
  return (
    <div
      className="bl-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={p.ariaLabel || (typeof p.label === 'string' ? p.label : 'پیشرفت') + ' ' + (typeof p.valueLabel === 'string' ? p.valueLabel : v + '%')}
    >
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="bl-ring-track" strokeWidth={sw} fill="none" />
        {v > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            className={cx('bl-ring-fill', p.tone && 'bl-stroke-' + p.tone)}
            strokeWidth={sw}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)}
            transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div className="bl-ring-center" aria-hidden="true">
        <span className={size >= 88 ? 'bl-ring-val' : 'bl-ring-val-sm'}>{p.valueLabel != null ? p.valueLabel : v + '%'}</span>
        {p.label && size >= 72 ? <span className="bl-ring-label">{p.label}</span> : null}
      </div>
    </div>
  );
}

export function StatusBreakdown(p: { items?: Array<{ status: string; value: Numeric; label?: ReactNode }> }) {
  const items = p.items || [];
  const S = (s: string) => statusOf(s) || STATUS.planned;
  return (
    <div className="bl-sbd">
      <div className="bl-sbd-bar" role="img" aria-label={items.map((i) => i.value + ' ' + (typeof i.label === 'string' ? i.label : S(i.status).label)).join(', ')}>
        {items.map((it, k) => {
          const s = S(it.status);
          return num(it.value, 0) ? <span key={k} className={'bl-sbd-seg bl-bg-' + (s.tone === 'neutral' ? 'muted' : s.tone)} style={{ flexGrow: num(it.value, 0) }} /> : null;
        })}
      </div>
      <ul className="bl-sbd-list">
        {items.map((it, k) => {
          const s = S(it.status);
          return (
            <li key={k}>
              <span className={'bl-tone-' + s.tone}>
                <Icon name={s.icon} size={16} stroke={2} />
              </span>
              <span className="bl-sbd-label">{it.label || s.label}</span>
              <span className="bl-sbd-val">{fmt(it.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
