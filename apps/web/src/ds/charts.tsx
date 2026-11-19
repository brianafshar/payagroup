import { Children, isValidElement, useCallback, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ErrorState, Skeleton } from './feedback';
import { SegmentedControl, type Option } from './forms';
import { Icon, type IconName } from './Icon';
import { Table, type Column, type Row } from './data';
import { TrendIndicator } from './metrics';
import { cx, fmt, num, type Numeric } from './utils';

type IconRef = IconName | (string & {});
type Val = Numeric | null | undefined;

export interface Series {
  name?: string;
  values?: Val[];
  /** Token name, e.g. `viz-2`; defaults to the series index. */
  color?: string;
  dashed?: boolean;
  width?: number;
  points?: boolean;
}

function nice(min: number, max: number, count: number) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nrm = raw / mag;
  const step = (nrm <= 1 ? 1 : nrm <= 2 ? 2 : nrm <= 2.5 ? 2.5 : nrm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}

function ChartEmpty(p: { height?: Numeric; icon?: IconRef; title?: ReactNode; description?: ReactNode }) {
  return (
    <div className="bl-chart-empty" style={{ height: num(p.height, 200) }}>
      <Icon name={p.icon || 'sparkline'} size={22} />
      <div className="bl-chart-empty-t">{p.title || 'در این بازه داده‌ای نیست'}</div>
      {p.description ? <div className="bl-muted bl-small">{p.description}</div> : null}
    </div>
  );
}

export interface LineChartProps {
  series?: Series[];
  labels?: ReactNode[];
  width?: Numeric;
  height?: Numeric;
  padRight?: Numeric;
  target?: { value: Numeric; label?: string } | null;
  annotations?: Array<{ index: number; label?: string }>;
  yMin?: Numeric;
  yMax?: Numeric;
  ticks?: Numeric;
  unit?: string;
  area?: boolean;
  points?: boolean;
  hideLast?: boolean;
  summary?: string;
  ariaLabel?: string;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  xLabel?: string;
}

/**
 * Width of the chart's box. Charts draw in their design width (`width`), but in a narrower box (a phone)
 * they draw at the box's width instead of shrinking the whole picture, so text keeps its size.
 */
function useFitWidth(design: number): [(el: HTMLDivElement | null) => void, number] {
  const [box, setBox] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect();
    if (!el || typeof ResizeObserver === 'undefined') return;
    ro.current = new ResizeObserver(([e]) => setBox(Math.round(e.contentRect.width)));
    ro.current.observe(el);
  }, []);
  return [ref, box > 0 && box < design ? Math.max(box, 240) : design];
}

export function LineChart(p: LineChartProps) {
  const series = p.series || [];
  const labels = p.labels || [];
  const [fit, W0] = useFitWidth(num(p.width, 640));
  const H0 = num(p.height, 220);
  const m = { t: 16, r: num(p.padRight, 24), b: 28, l: 44 };
  const tgt = p.target;
  const ann = p.annotations || [];
  const all: number[] = [];
  series.forEach((s) => (s.values || []).forEach((v) => v != null && all.push(Number(v))));
  if (tgt) all.push(Number(tgt.value));
  if (!all.length) return <ChartEmpty height={H0} title={p.emptyTitle} description={p.emptyDescription} />;
  const sc = nice(p.yMin != null ? num(p.yMin, 0) : Math.min(...all), p.yMax != null ? num(p.yMax, 0) : Math.max(...all), num(p.ticks, 4));
  m.l = tickRoom(sc.ticks);
  const n = Math.max(labels.length, Math.max(...series.map((s) => (s.values || []).length)));
  const iw = W0 - m.l - m.r;
  const ih = H0 - m.t - m.b;
  const X = (i: number) => m.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const Y = (v: number) => m.t + ih - ((v - sc.lo) / (sc.hi - sc.lo)) * ih;
  // Room per label from the longest one; labels are counted from the latest so it always shows.
  const longest = Math.max(1, ...labels.map((l) => (typeof l === 'string' || typeof l === 'number' ? String(l).length : 6)));
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / Math.max(56, longest * 7 + 14)))));
  const unit = p.unit ? ' ' + p.unit : '';
  const g: ReactNode[] = [];
  sc.ticks.forEach((t, i) => {
    g.push(<line key={'g' + i} x1={m.l} x2={W0 - m.r} y1={Y(t)} y2={Y(t)} className={i === 0 ? 'bl-ax-base' : 'bl-ax-grid'} />);
    g.push(
      <text key={'gt' + i} x={m.l - 8} y={Y(t) + 4} className="bl-ax-t" textAnchor="end">
        {fmt(t, 1)}
      </text>,
    );
  });
  labels.forEach((l, i) => {
    if ((n - 1 - i) % every === 0)
      g.push(
        <text key={'x' + i} x={X(i)} y={H0 - 8} className="bl-ax-t" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
          {l}
        </text>,
      );
  });
  if (tgt) {
    g.push(<line key="tg" x1={m.l} x2={W0 - m.r} y1={Y(Number(tgt.value))} y2={Y(Number(tgt.value))} className="bl-ax-target" />);
    g.push(
      <text key="tgt" x={W0 - m.r} y={Y(Number(tgt.value)) - 6} className="bl-ax-t bl-ax-tl" textAnchor="end">
        {tgt.label || 'هدف'}
      </text>,
    );
  }
  series.forEach((s, si) => {
    const vals = (s.values || []).map((v) => (v == null ? null : Number(v)));
    const col = 'var(--' + (s.color || 'viz-' + (si + 1)) + ')';
    const segs: string[] = [];
    const gaps: Array<[number, number]> = [];
    let cur = '';
    vals.forEach((v, i) => {
      if (v == null) {
        if (cur) segs.push(cur);
        cur = '';
        return;
      }
      cur += (cur ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
    });
    if (cur) segs.push(cur);
    let prev = -1;
    vals.forEach((v, i) => {
      if (v != null) {
        if (prev >= 0 && i - prev > 1) gaps.push([prev, i]);
        prev = i;
      }
    });
    if (p.area && si === 0) {
      const fi = vals.findIndex((v) => v != null);
      let la = vals.length - 1;
      while (la >= 0 && vals[la] == null) la--;
      let ad = '';
      vals.forEach((v, i) => {
        if (v != null) ad += (ad ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
      });
      g.push(<path key={'a' + si} d={ad + 'L' + X(la).toFixed(1) + ' ' + Y(sc.lo) + 'L' + X(fi).toFixed(1) + ' ' + Y(sc.lo) + 'Z'} fill="var(--viz-area)" stroke="none" />);
    }
    gaps.forEach((gp, gi) =>
      g.push(
        <line key={'gap' + si + '-' + gi} x1={X(gp[0])} y1={Y(vals[gp[0]] as number)} x2={X(gp[1])} y2={Y(vals[gp[1]] as number)} className="bl-ax-gap" style={{ stroke: col }} />,
      ),
    );
    segs.forEach((d, k) =>
      g.push(
        <path
          key={'s' + si + '-' + k}
          d={d}
          fill="none"
          style={{ stroke: col }}
          strokeWidth={s.width || 2}
          strokeDasharray={s.dashed ? '5 4' : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
        />,
      ),
    );
    vals.forEach((v, i) => {
      if (v != null && (p.points || s.points))
        g.push(<circle key={'p' + si + '-' + i} cx={X(i)} cy={Y(v)} r={3} style={{ fill: 'var(--surface)', stroke: col }} strokeWidth={2} />);
    });
    let li = vals.length - 1;
    while (li >= 0 && vals[li] == null) li--;
    if (li >= 0 && si === 0 && !p.hideLast) {
      const lv = vals[li] as number;
      g.push(<circle key={'last' + si} cx={X(li)} cy={Y(lv)} r={4} style={{ fill: col }} />);
      g.push(
        <text key={'lastt' + si} x={X(li) - 8} y={Y(lv) - 10} className="bl-ax-val" textAnchor="end">
          {fmt(lv, 1) + unit}
        </text>,
      );
    }
  });
  ann.forEach((a, k) => {
    const s0 = (series[0] && series[0].values) || [];
    const v = s0[a.index];
    if (v == null) return;
    const vy = Y(Number(v));
    g.push(
      <g key={'an' + k}>
        <rect x={X(a.index) - 5} y={vy - 5} width={10} height={10} transform={'rotate(45 ' + X(a.index) + ' ' + vy + ')'} className="bl-ax-pr" />
        {a.label ? (
          <text x={X(a.index)} y={vy + 20} className="bl-ax-t bl-ax-prl" textAnchor="middle">
            {a.label}
          </text>
        ) : null}
      </g>,
    );
  });
  return (
    <div className="bl-chart" ref={fit}>
      <svg width="100%" height={H0} viewBox={'0 0 ' + W0 + ' ' + H0} preserveAspectRatio="xMinYMin meet" role="img" aria-label={p.summary || p.ariaLabel || 'Line chart'}>
        {g}
      </svg>
    </div>
  );
}

export interface BarChartProps {
  labels?: ReactNode[];
  series?: Series[];
  width?: Numeric;
  height?: Numeric;
  stacked?: boolean;
  target?: { value: Numeric; label?: string } | null;
  yMax?: Numeric;
  ticks?: Numeric;
  maxBar?: Numeric;
  unit?: string;
  tickSuffix?: string;
  valueLabels?: boolean;
  summary?: string;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  xLabel?: string;
}

/** Left margin wide enough for the longest Y tick label (e.g. «۱۲٬۰۰۰»). */
function tickRoom(ticks: number[], suffix = ''): number {
  const longest = Math.max(...ticks.map((t) => String(fmt(t, 1)).length + suffix.length));
  return Math.max(44, longest * 7 + 14);
}

export function BarChart(p: BarChartProps) {
  const labels = p.labels || [];
  const series = p.series || [];
  const [fit, W0] = useFitWidth(num(p.width, 640));
  const H0 = num(p.height, 220);
  const stacked = !!p.stacked;
  const m = { t: 16, r: 16, b: 28, l: 44 };
  const tgt = p.target;
  const n = labels.length;
  const unit = p.unit ? ' ' + p.unit : '';
  const totals = labels.map((_, i) => {
    let s = 0;
    let mx = 0;
    series.forEach((se) => {
      const v = (se.values || [])[i];
      if (v != null) {
        s += Number(v);
        mx = Math.max(mx, Number(v));
      }
    });
    return stacked ? s : mx;
  });
  const top = Math.max(...totals.concat(tgt ? [Number(tgt.value)] : [0]));
  if (!n || (top === 0 && !series.some((se) => (se.values || []).some((v) => v != null)))) return <ChartEmpty height={H0} title={p.emptyTitle} description={p.emptyDescription} />;
  const sc = nice(0, p.yMax != null ? num(p.yMax, 0) : top, num(p.ticks, 4));
  m.l = tickRoom(sc.ticks, p.tickSuffix);
  const iw = W0 - m.l - m.r;
  const ih = H0 - m.t - m.b;
  const band = iw / n;
  const inner = Math.min(band * 0.64, num(p.maxBar, 40));
  const Y = (v: number) => m.t + ih - (v / sc.hi) * ih;
  const g: ReactNode[] = [];
  sc.ticks.forEach((t, i) => {
    g.push(<line key={'g' + i} x1={m.l} x2={W0 - m.r} y1={Y(t)} y2={Y(t)} className={i === 0 ? 'bl-ax-base' : 'bl-ax-grid'} />);
    g.push(
      <text key={'gt' + i} x={m.l - 8} y={Y(t) + 4} className="bl-ax-t" textAnchor="end">
        {fmt(t, 1) + (p.tickSuffix || '')}
      </text>,
    );
  });
  // Labels that don't fit side by side are thinned (every k-th, always keeping the latest), #58.
  const longest = Math.max(1, ...labels.map((l) => (typeof l === 'string' || typeof l === 'number' ? String(l).length : 6)));
  const every = Math.max(1, Math.ceil((longest * 7 + 12) / band));
  labels.forEach((l, i) => {
    const cx0 = m.l + band * i + band / 2;
    const x0 = cx0 - inner / 2;
    let acc = 0;
    let anyVal = false;
    if ((n - 1 - i) % every === 0)
      g.push(
        <text key={'x' + i} x={cx0} y={H0 - 8} className="bl-ax-t" textAnchor="middle">
          {l}
        </text>,
      );
    series.forEach((se, si) => {
      const raw = (se.values || [])[i];
      const col = 'var(--' + (se.color || 'viz-' + (si + 1)) + ')';
      if (raw == null) return;
      anyVal = true;
      const v = Number(raw);
      const bw = stacked ? inner : (inner - (series.length - 1) * 2) / series.length;
      const bx = stacked ? x0 : x0 + si * (bw + 2);
      if (v === 0) {
        if (!stacked) {
          g.push(<rect key={'b' + i + '-' + si} x={bx} y={Y(0) - 2} width={bw} height={2} style={{ fill: col }} />);
          if (p.valueLabels)
            g.push(
              <text key={'v' + i + '-' + si} x={bx + bw / 2} y={Y(0) - 8} className="bl-ax-val" textAnchor="middle">
                0
              </text>,
            );
        }
        return;
      }
      const y1 = stacked ? Y(acc + v) : Y(v);
      const y0 = stacked ? Y(acc) : Y(0);
      g.push(
        <rect
          key={'b' + i + '-' + si}
          x={bx}
          y={y1 + (stacked && acc ? 1 : 0)}
          width={bw}
          height={Math.max(1, y0 - y1 - (stacked && acc ? 1 : 0))}
          rx={stacked ? 0 : 2}
          style={{ fill: col }}
        >
          <title>{(se.name ? se.name + ', ' : '') + (typeof l === 'string' ? l : '') + ': ' + fmt(v, 1) + unit}</title>
        </rect>,
      );
      if (p.valueLabels && !stacked)
        g.push(
          <text key={'v' + i + '-' + si} x={bx + bw / 2} y={y1 - 6} className="bl-ax-val" textAnchor="middle">
            {fmt(v, 1)}
          </text>,
        );
      acc += v;
    });
    if (!anyVal)
      g.push(
        <text key={'nd' + i} x={cx0} y={Y(0) - 8} className="bl-ax-t bl-ax-nd" textAnchor="middle">
          {'–'}
        </text>,
      );
  });
  if (tgt) {
    g.push(<line key="tg" x1={m.l} x2={W0 - m.r} y1={Y(Number(tgt.value))} y2={Y(Number(tgt.value))} className="bl-ax-target" />);
    g.push(
      <text key="tgt" x={W0 - m.r} y={Y(Number(tgt.value)) - 6} className="bl-ax-t bl-ax-tl" textAnchor="end">
        {tgt.label || 'هدف'}
      </text>,
    );
  }
  return (
    <div className="bl-chart" ref={fit}>
      <svg width="100%" height={H0} viewBox={'0 0 ' + W0 + ' ' + H0} preserveAspectRatio="xMinYMin meet" role="img" aria-label={p.summary || 'Bar chart'}>
        {g}
      </svg>
    </div>
  );
}

export interface LegendItem {
  label: ReactNode;
  color?: string;
  dashed?: boolean;
  shape?: 'line' | 'bar' | 'diamond';
}

export function ChartLegend({ items }: { items?: LegendItem[] }) {
  return (
    <ul className="bl-legend">
      {(items || []).map((it, i) => (
        <li key={i}>
          <span
            className={cx('bl-legend-sw', it.dashed && 'is-dashed', it.shape === 'bar' && 'is-bar', it.shape === 'diamond' && 'is-diamond')}
            style={{ color: 'var(--' + (it.color || 'viz-' + (i + 1)) + ')' }}
            aria-hidden="true"
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

type TableData = { columns: Column[]; rows: Row[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

/** Builds the accessible table view from the chart(s) passed as children. */
function chartTableFrom(p: { table?: TableData | null; children?: ReactNode }): TableData | null {
  if (p.table && p.table.columns) return p.table;
  const found: Array<{ k: 'series' | 'cmp'; q: AnyProps }> = [];
  const walk = (kids: ReactNode) => {
    Children.forEach(kids, (c) => {
      if (!isValidElement(c)) return;
      const q = (c as ReactElement<AnyProps>).props;
      if (q.series && q.labels) found.push({ k: 'series', q });
      else if (q.first != null && q.current != null) found.push({ k: 'cmp', q });
      if (q.children) walk(q.children);
    });
  };
  walk(p.children);
  if (!found.length) return null;
  const fmtV = (v: Val, u?: string) => (v == null || v === '' ? '—' : fmt(Number(v), 2) + (u ? ' ' + u : ''));
  if (found[0].k === 'cmp')
    return {
      columns: [
        { key: 'l', label: 'شاخص' },
        { key: 'a', label: 'اولین' },
        { key: 'b', label: 'فعلی' },
        { key: 'd', label: 'تغییر' },
      ],
      rows: found
        .filter((f) => f.k === 'cmp')
        .map((f, i) => {
          const q = f.q;
          const a = num(q.first, 0);
          const b = num(q.current, 0);
          return {
            id: String(i),
            l: q.label,
            a: fmtV(a, q.unit) + (q.firstDate ? ' · ' + q.firstDate : ''),
            b: fmtV(b, q.unit) + (q.currentDate ? ' · ' + q.currentDate : ''),
            d: a ? (b >= a ? '+' : '') + fmt(((b - a) / a) * 100, 1) + '٪' : '—',
          };
        }),
    };
  const q = found[0].q;
  const S: Series[] = q.series || [];
  const L: ReactNode[] = q.labels || [];
  const cols: Column[] = [{ key: 'x', label: q.xLabel || (L.some((l) => !l) ? 'دوره' : 'مورد') }].concat(S.map((s, i) => ({ key: 's' + i, label: s.name || 'سری ' + (i + 1) })));
  const rows: Row[] = L.map((lab, j) => {
    const r: Row = { id: String(j), x: lab || (L[j - 1] ? String(L[j - 1]) + ' (۲)' : '—') };
    S.forEach((s, i) => (r['s' + i] = fmtV((s.values || [])[j], q.unit)));
    return r;
  });
  return { columns: cols, rows };
}

export interface ChartContainerProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  summary?: ReactNode;
  legend?: LegendItem[];
  ranges?: Array<Option | string>;
  range?: string;
  onRange?: (v: string) => void;
  footnote?: ReactNode;
  tableToggle?: boolean;
  tableLabel?: ReactNode;
  table?: TableData | null;
  onTable?: (showing: boolean) => void;
  loading?: boolean;
  error?: boolean;
  errorTitle?: ReactNode;
  errorDescription?: ReactNode;
  onRetry?: () => void;
  empty?: boolean;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  height?: Numeric;
  flat?: boolean;
  children?: ReactNode;
}

/** Chart frame: title, range switch, summary, legend, and a chart ↔ table toggle for accessibility. */
export function ChartContainer(p: ChartContainerProps) {
  const ranges = p.ranges || [];
  const [showT, setShowT] = useState(false);
  const tbl = showT ? chartTableFrom(p) : null;
  const toggleOn = p.tableToggle !== false;
  return (
    <section className={cx('bl-chartbox', p.flat && 'is-flat')}>
      <header className="bl-chartbox-head">
        <div className="bl-grow bl-minw0">
          <h3 className="bl-card-title">{p.title}</h3>
          {p.subtitle ? <p className="bl-card-sub">{p.subtitle}</p> : null}
        </div>
        {ranges.length ? <SegmentedControl options={ranges} value={p.range} size="sm" label="بازه زمانی" onChange={p.onRange} /> : null}
      </header>
      {p.summary ? <div className="bl-chartbox-summary">{p.summary}</div> : null}
      {(p.legend || []).length ? <ChartLegend items={p.legend} /> : null}
      <div className="bl-chartbox-body">
        {p.loading ? (
          <Skeleton variant="chart" height={num(p.height, 200)} />
        ) : p.error ? (
          <ErrorState
            title={p.errorTitle || 'نمودار بارگذاری نشد'}
            description={p.errorDescription || 'داده‌ها محفوظ است. کمی بعد دوباره تلاش کنید.'}
            actionLabel="تلاش دوباره"
            onAction={p.onRetry}
            compact
          />
        ) : p.empty ? (
          <ChartEmpty title={p.emptyTitle} description={p.emptyDescription} height={num(p.height, 200)} />
        ) : showT ? (
          tbl ? (
            <Table columns={tbl.columns} rows={tbl.rows} dense />
          ) : (
            <p className="bl-muted">داده‌ای برای نمایش جدولی نیست.</p>
          )
        ) : (
          p.children
        )}
      </div>
      {p.footnote || toggleOn ? (
        <footer className="bl-chartbox-foot">
          {p.footnote ? <span>{p.footnote}</span> : <span />}
          {toggleOn ? (
            <button
              type="button"
              className="bl-link-btn"
              aria-pressed={showT}
              onClick={() => {
                setShowT(!showT);
                p.onTable?.(!showT);
              }}
            >
              <Icon name={showT ? 'bar-chart' : 'list'} size={14} />
              {showT ? 'نمایش به‌صورت نمودار' : p.tableLabel || 'نمایش به‌صورت جدول'}
            </button>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}

export function ComparisonBar(p: {
  label?: ReactNode;
  first?: Numeric;
  current?: Numeric;
  firstDate?: ReactNode;
  currentDate?: ReactNode;
  unit?: string;
  lowerIsBetter?: boolean;
}) {
  const a = num(p.first, 0);
  const b = num(p.current, 0);
  const mx = Math.max(a, b) * 1.06 || 1;
  const pct = a ? ((b - a) / a) * 100 : 0;
  const u = p.unit ? ' ' + p.unit : '';
  const rows: Array<[string, number, ReactNode, string]> = [
    ['اولین', a, p.firstDate, 'is-first'],
    ['فعلی', b, p.currentDate, 'is-cur'],
  ];
  return (
    <div className="bl-cmp">
      <div className="bl-cmp-head">
        <span className="bl-cmp-label">{p.label}</span>
        <TrendIndicator value={+pct.toFixed(1)} goodDirection={p.lowerIsBetter ? 'down' : 'up'} size="sm" />
      </div>
      {rows.map((r) => (
        <div key={r[0]} className="bl-cmp-row">
          <span className="bl-cmp-k">{r[0]}</span>
          <div className="bl-cmp-track" aria-hidden="true">
            <div className={'bl-cmp-bar ' + r[3]} style={{ width: (r[1] / mx) * 100 + '%' }} />
          </div>
          <span className="bl-cmp-v">{fmt(r[1], 2) + u}</span>
          {r[2] ? <span className="bl-cmp-d">{r[2]}</span> : null}
        </div>
      ))}
    </div>
  );
}
