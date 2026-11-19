// Progress chart over time for the athlete app: dated points grouped by day / week / month (chips in the
// corner) and moved along the time axis with a horizontal swipe or the ‹ › buttons.
import { buckets, faNumber, groupPoints, WINDOW, type Agg, type DatedPoint, type Granularity } from '@baseline/core';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { fontFamily, useTheme } from '../theme';
import { Icon, Txt } from './primitives';

export interface TimeSeries {
  name: string;
  points: DatedPoint[];
  color: 'viz-1' | 'viz-2' | 'viz-3' | 'viz-4';
}

const GRAN: Array<[Granularity, string]> = [
  ['day', 'روز'],
  ['week', 'هفته'],
  ['month', 'ماه'],
];

function nice(min: number, max: number, count = 4) {
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

export function TimeChart({
  title,
  hint,
  series,
  from,
  to,
  kind = 'line',
  agg = 'avg',
  unit,
  initial = 'week',
  empty,
  height = 170,
  extra,
}: {
  title: string;
  hint?: string;
  series: TimeSeries[];
  from: string;
  to: string;
  kind?: 'line' | 'bar' | 'stacked';
  agg?: Agg;
  unit?: string;
  initial?: Granularity;
  empty?: string;
  height?: number;
  extra?: ReactNode;
}) {
  const { c } = useTheme();
  const [gran, setGran] = useState<Granularity>(initial);
  const bs = useMemo(() => buckets(from, to, gran), [from, to, gran]);
  const vals = useMemo(() => series.map((s) => groupPoints(s.points, bs, gran, agg)), [series, bs, gran, agg]);
  const win = Math.min(gran === 'day' ? 10 : WINDOW[gran] - 4, bs.length); // fewer columns on a phone
  const [end, setEnd] = useState(bs.length);
  useEffect(() => setEnd(bs.length), [bs.length]);
  const clamp = (e: number) => Math.max(win, Math.min(bs.length, e));
  const e = clamp(end);
  const s0 = e - win;
  const [W, setW] = useState(0);
  const hasData = series.some((s) => s.points.some((p) => p.value != null));

  // Swipe: one period per column width; right = older (time runs left → right).
  const state = useRef({ e, win, n: bs.length, W });
  state.current = { e, win, n: bs.length, W };
  const startEnd = useRef(e);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: () => (startEnd.current = state.current.e),
        onPanResponderMove: (_, g) => {
          const { win: w, n, W: width } = state.current;
          const band = Math.max(1, (width - 52) / Math.max(1, w));
          setEnd(Math.max(w, Math.min(n, startEnd.current - Math.round(g.dx / band))));
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  const m = { t: 14, r: 8, b: 24, l: 44 };
  const iw = Math.max(0, W - m.l - m.r);
  const ih = height - m.t - m.b;
  const band = win ? iw / win : 0;
  const shown = vals.map((v) => v.slice(s0, e));
  const totals = shown[0] ? shown[0].map((_, i) => shown.reduce((a, s) => a + (s[i] || 0), 0)) : [];
  const flat = kind === 'stacked' ? totals : shown.flat().filter((v): v is number => v != null);
  const sc = nice(kind === 'line' ? Math.min(...(flat.length ? flat : [0])) : 0, Math.max(...(flat.length ? flat : [1])));
  const Y = (v: number) => m.t + ih - ((v - sc.lo) / (sc.hi - sc.lo || 1)) * ih;
  const X = (i: number) => m.l + band * i + band / 2;
  const labels = bs.slice(s0, e).map((b) => b.label);
  const every = Math.max(1, Math.ceil(52 / Math.max(1, band)));
  const text = { fontFamily: fontFamily[400], fontSize: 10, fill: c['text-muted'] };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Txt size={12} lh={18} w={600} color="text-muted" style={{ flex: 1 }}>
          {title}
        </Txt>
        {GRAN.map(([g, label]) => (
          <Pressable
            key={g}
            accessibilityRole="radio"
            accessibilityState={{ checked: gran === g }}
            onPress={() => setGran(g)}
            style={{ paddingHorizontal: 8, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: gran === g ? c['brand-primary-subtle'] : c['surface-sunken'] }}
          >
            <Txt size={11} lh={14} w={gran === g ? 600 : 400} color={gran === g ? 'brand-primary-text' : 'text-secondary'}>
              {label}
            </Txt>
          </Pressable>
        ))}
      </View>
      {extra}
      {hasData ? (
        <View {...pan.panHandlers} onLayout={(ev) => setW(ev.nativeEvent.layout.width)} style={{ height, direction: 'ltr' }} accessibilityLabel={title}>
          {W > 0 ? (
            <Svg width={W} height={height}>
              {sc.ticks.map((t, i) => (
                <G key={'g' + i}>
                  <Line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke={i === 0 ? c['border-strong'] : c['viz-grid']} strokeWidth={1} />
                  <SvgText x={m.l - 6} y={Y(t) + 4} textAnchor="end" {...text}>
                    {faNumber(t, 1, Math.abs(t) >= 1000)}
                  </SvgText>
                </G>
              ))}
              {labels.map((l, i) =>
                (labels.length - 1 - i) % every === 0 ? (
                  <SvgText key={'x' + i} x={X(i)} y={height - 6} textAnchor="middle" {...text}>
                    {l}
                  </SvgText>
                ) : null,
              )}
              {kind === 'line'
                ? shown.map((v, si) => {
                    let d = '';
                    let pen = false;
                    v.forEach((x, i) => {
                      if (x == null) return (pen = false);
                      d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x).toFixed(1);
                      pen = true;
                    });
                    const col = c[series[si].color];
                    return (
                      <G key={'s' + si}>
                        <Path d={d} fill="none" stroke={col} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                        {v.map((x, i) => (x == null ? null : <Circle key={i} cx={X(i)} cy={Y(x)} r={2.5} fill={col} />))}
                      </G>
                    );
                  })
                : labels.map((_, i) => {
                    const bw = Math.max(2, Math.min(18, band * 0.6));
                    let acc = 0;
                    return (
                      <G key={'b' + i}>
                        {shown.map((v, si) => {
                          const x = v[i] || 0;
                          if (!x) return null;
                          const k = kind === 'stacked' ? si : 0;
                          const off = kind === 'stacked' ? 0 : (si - (shown.length - 1) / 2) * (bw / shown.length);
                          const y0 = Y(kind === 'stacked' ? acc : 0);
                          if (kind === 'stacked') acc += x;
                          const y1 = Y(kind === 'stacked' ? acc : x);
                          const w = kind === 'stacked' ? bw : bw / shown.length;
                          return (
                            <Rect
                              key={si + '-' + k}
                              x={X(i) - (kind === 'stacked' ? bw / 2 : w / 2) + off}
                              y={y1}
                              width={w}
                              height={Math.max(0, y0 - y1)}
                              rx={2}
                              fill={c[series[si].color]}
                            />
                          );
                        })}
                      </G>
                    );
                  })}
            </Svg>
          ) : null}
        </View>
      ) : (
        <Txt size={13} lh={22} color="text-secondary">
          {empty || 'در این بازه داده‌ای ثبت نشده.'}
        </Txt>
      )}
      {hasData ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {series.length > 1
            ? series.map((s) => (
                <View key={s.name} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c[s.color] }} />
                  <Txt size={11} lh={16} color="text-secondary">
                    {s.name}
                  </Txt>
                </View>
              ))
            : null}
          <View style={{ flex: 1 }} />
          {bs.length > win ? (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="جدیدتر" hitSlop={8} disabled={e >= bs.length} onPress={() => setEnd(clamp(e + win))}>
                <Icon name="chevron-right" size={18} color={e >= bs.length ? 'text-disabled' : 'text-secondary'} />
              </Pressable>
              <Txt size={11} lh={16} color="text-muted">
                {labels[0] + ' تا ' + labels[labels.length - 1]}
              </Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="قدیمی‌تر" hitSlop={8} disabled={s0 <= 0} onPress={() => setEnd(clamp(e - win))}>
                <Icon name="chevron-left" size={18} color={s0 <= 0 ? 'text-disabled' : 'text-secondary'} />
              </Pressable>
            </>
          ) : null}
          {unit ? (
            <Txt size={11} lh={16} color="text-muted">
              {unit}
            </Txt>
          ) : null}
        </View>
      ) : null}
      {hint ? (
        <Txt size={11} lh={17} color="text-muted">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}
