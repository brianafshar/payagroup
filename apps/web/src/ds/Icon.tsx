import { iconPrimitives, type IconName } from '@baseline/core';
import { cx, num, type Numeric } from './utils';

export { ICON_NAMES, type IconName } from '@baseline/core';

export interface IconProps {
  /** Unknown names fall back to a circle, as in the design prototype. */
  name: IconName | (string & {});
  size?: Numeric;
  stroke?: Numeric;
  /** Accessible label; without it the icon is decorative (aria-hidden). */
  label?: string;
  /** Token name, e.g. `success` → `color: var(--success)`. */
  color?: string;
  className?: string;
}

/** Icon from the shared Baseline set (`@baseline/core`), rendered as inline SVG. */
export function Icon({ name, size, stroke, label, color, className }: IconProps) {
  const s = num(size, 20);
  const kids = iconPrimitives(name).map((p, i) => {
    if (p.t === 'circle') return p.filled ? <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="currentColor" stroke="none" /> : <circle key={i} cx={p.cx} cy={p.cy} r={p.r} />;
    if (p.t === 'rect') return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} />;
    return p.filled ? <path key={i} d={p.d} fill="currentColor" /> : <path key={i} d={p.d} />;
  });
  return (
    <svg
      className={cx('bl-icon', className)}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={num(stroke, 1.75)}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={color ? { color: `var(--${color})` } : undefined}
    >
      {kids}
    </svg>
  );
}
