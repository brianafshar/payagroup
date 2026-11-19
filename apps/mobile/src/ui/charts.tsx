import { faNumber } from '@baseline/core';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fontFamily, useTheme } from '../theme';
import { TrendIndicator } from './display';
import { Txt } from './primitives';

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

/**
 * Line chart (design system `LineChart`): time runs left → right as in the web charts; the latest
 * point is highlighted with its value. Width follows the container.
 */
export function LineChart({ labels, values, unit, height = 160, summary }: { labels: string[]; values: number[]; unit?: string; height?: number; summary?: string }) {
  const { c } = useTheme();
  const [W, setW] = useState(0);
  const m = { t: 16, r: 24, b: 28, l: 44 };
  const sc = nice(Math.min(...values), Math.max(...values), 4);
  const n = Math.max(labels.length, values.length);
  const iw = W - m.l - m.r;
  const ih = height - m.t - m.b;
  const X = (i: number) => m.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const Y = (v: number) => m.t + ih - ((v - sc.lo) / (sc.hi - sc.lo)) * ih;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 64))));
  const d = values.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join('');
  const li = values.length - 1;
  const text = { fontFamily: fontFamily[400], fontSize: 12, fill: c['text-muted'] };
  return (
    // Charts are drawn left→right; `direction: 'ltr'` keeps SVG text anchors from flipping under RTL.
    <View accessibilityRole="image" accessibilityLabel={summary} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, direction: 'ltr' }}>
      {W > 0 ? (
        <Svg width={W} height={height}>
          {sc.ticks.map((t, i) => (
            <Line key={'g' + i} x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke={i === 0 ? c['border-strong'] : c['viz-grid']} strokeWidth={1} />
          ))}
          {sc.ticks.map((t, i) => (
            <SvgText key={'t' + i} x={m.l - 8} y={Y(t) + 4} textAnchor="end" {...text}>
              {faNumber(t, 1, false)}
            </SvgText>
          ))}
          {labels.map((l, i) =>
            i % every === 0 || i === n - 1 ? (
              <SvgText key={'x' + i} x={X(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} {...text}>
                {l}
              </SvgText>
            ) : null,
          )}
          <Path d={d} fill="none" stroke={c['viz-1']} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {li >= 0 ? (
            <>
              <Circle cx={X(li)} cy={Y(values[li])} r={4} fill={c['viz-1']} />
              <SvgText x={X(li) - 8} y={Y(values[li]) - 10} textAnchor="end" fontFamily={fontFamily[600]} fontSize={12} fill={c['text-primary']}>
                {faNumber(values[li], 1, false) + (unit ? ' ' + unit : '')}
              </SvgText>
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Bars per period, optionally stacked (e.g. aerobic + anaerobic minutes, #63). Labels thin out when
 * they don't fit; series colors follow the viz palette.
 */
export function BarChart({
  labels,
  series,
  height = 160,
  summary,
}: {
  labels: string[];
  series: Array<{ name: string; values: number[]; color?: 'viz-1' | 'viz-2' | 'viz-3' | 'viz-4' }>;
  height?: number;
  summary?: string;
}) {
  const { c } = useTheme();
  const [W, setW] = useState(0);
  const m = { t: 16, r: 12, b: 28, l: 40 };
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
  const sc = nice(0, Math.max(1, ...totals), 4);
  const iw = W - m.l - m.r;
  const ih = height - m.t - m.b;
  const band = n ? iw / n : 0;
  const bw = Math.max(2, Math.min(28, band * 0.6));
  const Y = (v: number) => m.t + ih - (v / (sc.hi || 1)) * ih;
  const longest = Math.max(1, ...labels.map((l) => l.length));
  const every = Math.max(1, Math.ceil((longest * 6 + 8) / Math.max(1, band)));
  const text = { fontFamily: fontFamily[400], fontSize: 11, fill: c['text-muted'] };
  return (
    <View accessibilityRole="image" accessibilityLabel={summary} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, direction: 'ltr' }}>
      {W > 0 ? (
        <Svg width={W} height={height}>
          {sc.ticks.map((t, i) => (
            <Line key={'g' + i} x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke={i === 0 ? c['border-strong'] : c['viz-grid']} strokeWidth={1} />
          ))}
          {sc.ticks.map((t, i) => (
            <SvgText key={'t' + i} x={m.l - 6} y={Y(t) + 4} textAnchor="end" {...text}>
              {faNumber(t, 1, false)}
            </SvgText>
          ))}
          {labels.map((l, i) => {
            let acc = 0;
            const x = m.l + band * i + (band - bw) / 2;
            return (
              <G key={'b' + i}>
                {series.map((s, si) => {
                  const v = s.values[i] || 0;
                  if (!v) return null;
                  const y0 = Y(acc);
                  acc += v;
                  return (
                    <Rect
                      key={si}
                      x={x}
                      y={Y(acc)}
                      width={bw}
                      height={Math.max(0, y0 - Y(acc))}
                      rx={2}
                      fill={c[s.color || (['viz-1', 'viz-2', 'viz-3', 'viz-4'] as const)[si % 4]]}
                    />
                  );
                })}
                {(n - 1 - i) % every === 0 ? (
                  <SvgText x={m.l + band * i + band / 2} y={height - 8} textAnchor="middle" {...text}>
                    {l}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

/** First vs current value with the % change (design system `ComparisonBar`). */
export function ComparisonBar({
  label,
  first,
  current,
  unit,
  firstDate,
  currentDate,
  lowerIsBetter,
}: {
  label: ReactNode;
  first: number;
  current: number;
  unit?: string;
  firstDate?: string;
  currentDate?: string;
  lowerIsBetter?: boolean;
}) {
  const { c } = useTheme();
  const mx = Math.max(first, current) * 1.06 || 1;
  const pct = first ? ((current - first) / first) * 100 : 0;
  const rows: Array<[string, number, string | undefined, string]> = [
    ['اولین', first, firstDate, c['viz-muted']],
    ['فعلی', current, currentDate, c['viz-1']],
  ];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt size={14} lh={20} w={600}>
          {label}
        </Txt>
        <TrendIndicator value={+pct.toFixed(1)} goodDirection={lowerIsBetter ? 'down' : 'up'} size="sm" />
      </View>
      {rows.map(([k, v, date, col]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Txt size={12} lh={16} color="text-muted" style={{ width: 40 }}>
            {k}
          </Txt>
          <View style={{ flex: 1, height: 10, borderRadius: 2, backgroundColor: c['surface-sunken'], flexDirection: 'row' }}>
            <View style={{ width: `${(v / mx) * 100}%`, height: '100%', borderRadius: 2, backgroundColor: col }} />
          </View>
          <Txt size={13} lh={16} w={600} style={{ width: 64 }} align="left">
            {faNumber(v, 2) + (unit ? ' ' + unit : '')}
          </Txt>
          {date ? (
            <Txt size={12} lh={16} color="text-muted" style={{ width: 56 }}>
              {date}
            </Txt>
          ) : null}
        </View>
      ))}
    </View>
  );
}
