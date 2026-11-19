import { cx } from './utils';

export interface BrandMarkProps {
  name?: string;
  initials?: string;
  sub?: string;
  /** Optional uploaded logo; defaults to initials on the primary color. */
  src?: string;
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg';
  /** Light text for dark backgrounds (login screens). */
  inverse?: boolean;
}

export function BrandMark(p: BrandMarkProps) {
  const s = p.size || 'md';
  const mark = p.variant === 'mark';
  return (
    <div className={cx('bl-brand', 'bl-brand-' + s)}>
      <span
        className="bl-brand-tile"
        aria-hidden={mark ? undefined : true}
        role={mark ? 'img' : undefined}
        aria-label={mark ? p.name || 'Logo' : undefined}
        style={p.src ? { background: 'var(--surface)', overflow: 'hidden', padding: 0 } : undefined}
      >
        {p.src ? <img src={p.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : <span>{p.initials || 'i'}</span>}
        {p.src ? null : <span className="bl-brand-bar" />}
      </span>
      {!mark ? (
        <span className="bl-brand-text">
          <span className="bl-brand-name" style={p.inverse ? { color: '#fff' } : undefined}>
            {p.name || 'indow'}
          </span>
          {p.sub ? (
            <span className="bl-brand-sub" style={p.inverse ? { color: '#bdbdbd' } : undefined}>
              {p.sub}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The indow logo (brand package in `/brand`, web copies in `public/brand`). `kind`: primary (stripes +
 * wordmark), symbol (the «i» alone) or wordmark. `tone`: auto follows light/dark mode (ink letters on
 * light, white on dark); color / reversed force one. Platform pages only — a coach's own panel and app
 * keep their white-label brand.
 */
export function IndowLogo({
  kind = 'primary',
  tone = 'auto',
  height = 32,
  className,
}: {
  kind?: 'primary' | 'symbol' | 'wordmark';
  tone?: 'auto' | 'color' | 'reversed';
  height?: number;
  className?: string;
}) {
  const src = (t: string) => `/brand/paya-${kind}-${t}.svg`;
  const img = (t: string, cls?: string) => <img className={cls} src={src(t)} alt="PAYA Group" style={{ height, width: 'auto', display: 'block' }} />;
  if (tone !== 'auto') return <span className={cx('bl-indow', className)}>{img(tone)}</span>;
  return (
    <span className={cx('bl-indow', className)}>
      {img('color', 'bl-indow-light')}
      {img('reversed', 'bl-indow-dark')}
    </span>
  );
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

export function Avatar(p: { name?: string; src?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; current?: boolean }) {
  const name = p.name || '';
  return (
    <span className={cx('bl-avatar', 'bl-avatar-' + (p.size || 'md'), p.current && 'is-current')} role="img" aria-label={name} title={name}>
      {p.src ? <img src={p.src} alt="" /> : initialsOf(name)}
    </span>
  );
}
