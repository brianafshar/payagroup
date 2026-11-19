import { useState, type ReactNode } from 'react';
import { Button, Spinner } from './actions';
import { Badge } from './data';
import { Icon, type IconName } from './Icon';
import { cx, num, useUid, type Numeric } from './utils';

type IconRef = IconName | (string & {});

export function EmptyState(p: {
  icon?: IconRef;
  title?: ReactNode;
  description?: ReactNode;
  actionLabel?: ReactNode;
  actionTo?: string;
  actionIcon?: IconRef;
  onAction?: () => void;
  secondaryLabel?: ReactNode;
  onSecondary?: () => void;
  compact?: boolean;
}) {
  const compact = !!p.compact;
  return (
    <div className={cx('bl-empty', compact && 'is-compact')}>
      <span className="bl-empty-ic">
        <Icon name={p.icon || 'info'} size={compact ? 20 : 24} />
      </span>
      <h3 className="bl-empty-title">{p.title}</h3>
      {p.description ? <p className="bl-empty-desc">{p.description}</p> : null}
      {p.actionLabel || p.secondaryLabel ? (
        <div className="bl-row-8">
          {p.secondaryLabel ? (
            <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={p.onSecondary}>
              {p.secondaryLabel}
            </Button>
          ) : null}
          {p.actionLabel ? (
            <Button to={p.actionTo} onClick={p.onAction} variant="primary" icon={p.actionIcon} size={compact ? 'sm' : 'md'}>
              {p.actionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LoadingState(p: { label?: ReactNode; description?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('bl-loading', p.compact && 'is-compact')} role="status" aria-live="polite">
      <Spinner size={p.compact ? 'md' : 'lg'} />
      <span>{p.label || 'در حال بارگذاری…'}</span>
      {p.description ? <span className="bl-muted bl-small">{p.description}</span> : null}
    </div>
  );
}

export function ErrorState(p: { icon?: IconRef; title?: ReactNode; description?: ReactNode; actionLabel?: ReactNode; onAction?: () => void; code?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('bl-empty', 'bl-error', p.compact && 'is-compact')} role="alert">
      <span className="bl-empty-ic">
        <Icon name={p.icon || 'alert-circle'} size={24} />
      </span>
      <h3 className="bl-empty-title">{p.title || 'مشکلی پیش آمد'}</h3>
      {p.description ? <p className="bl-empty-desc">{p.description}</p> : null}
      {p.actionLabel ? (
        <Button variant="secondary" icon="refresh" size={p.compact ? 'sm' : 'md'} onClick={p.onAction}>
          {p.actionLabel}
        </Button>
      ) : null}
      {p.code ? <span className="bl-mono bl-muted bl-small">{p.code}</span> : null}
    </div>
  );
}

export function Skeleton(p: { variant?: 'text' | 'circle' | 'rect' | 'chart' | 'card' | 'list'; lines?: Numeric; size?: Numeric; width?: string | number; height?: Numeric }) {
  const v = p.variant || 'text';
  const lines = num(p.lines, 3);
  if (v === 'circle') return <span className="bl-skel bl-skel-circle" style={{ width: num(p.size, 40), height: num(p.size, 40) }} aria-hidden="true" />;
  if (v === 'rect') return <span className="bl-skel" style={{ display: 'block', width: p.width || '100%', height: num(p.height, 80) }} aria-hidden="true" />;
  if (v === 'chart')
    return (
      <div className="bl-skel-chart" style={{ height: num(p.height, 200) }} aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="bl-skel" style={{ height: 30 + ((i * 37) % 60) + '%' }} />
        ))}
      </div>
    );
  if (v === 'card')
    return (
      <div className="bl-skel-card" aria-hidden="true">
        <span className="bl-skel bl-skel-text" style={{ width: '40%' }} />
        <span className="bl-skel" style={{ height: 32, width: '60%' }} />
        <span className="bl-skel bl-skel-text" style={{ width: '80%' }} />
      </div>
    );
  if (v === 'list')
    return (
      <div aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="bl-skel-row">
            <span className="bl-skel bl-skel-circle" style={{ width: 36, height: 36 }} />
            <div className="bl-grow">
              <span className="bl-skel bl-skel-text" style={{ width: 50 + ((i * 13) % 30) + '%' }} />
              <span className="bl-skel bl-skel-text" style={{ width: 30 + ((i * 7) % 20) + '%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  return (
    <div className="bl-skel-lines" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="bl-skel bl-skel-text" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  );
}

export function LockedFeature(p: {
  icon?: IconRef;
  badge?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  points?: ReactNode[];
  note?: ReactNode;
  variant?: 'default' | 'compact';
}) {
  const points = p.points || [];
  return (
    <div className={cx('bl-locked', p.variant === 'compact' && 'is-compact')}>
      <span className="bl-locked-ic">
        <Icon name={p.icon || 'chat'} size={24} />
      </span>
      <Badge tone="neutral" icon="lock" size="sm">
        {p.badge || 'به‌زودی'}
      </Badge>
      <h3 className="bl-locked-title">{p.title || 'گفتگو به‌زودی فعال می‌شود'}</h3>
      {p.description ? <p className="bl-locked-desc">{p.description}</p> : null}
      {points.length ? (
        <ul className="bl-locked-list">
          {points.map((t, i) => (
            <li key={i}>
              <Icon name="check" size={16} stroke={2} />
              {t}
            </li>
          ))}
        </ul>
      ) : null}
      {p.note ? (
        <p className="bl-locked-note">
          <Icon name="info" size={14} />
          {p.note}
        </p>
      ) : null}
    </div>
  );
}

/** Health data block: restricted badge, access note, optional hide/reveal (audited). Never shown to admin roles. */
export function SensitiveSection(p: {
  title?: ReactNode;
  accessNote?: ReactNode;
  badge?: ReactNode;
  hidden?: boolean;
  hiddenTitle?: ReactNode;
  hiddenNote?: ReactNode;
  footer?: ReactNode;
  onReveal?: () => void;
  children?: ReactNode;
}) {
  const [hidden, setHidden] = useState(!!p.hidden);
  const id = useUid('sens');
  return (
    <section className="bl-sens" aria-labelledby={id}>
      <header className="bl-sens-head">
        <span className="bl-sens-ic">
          <Icon name="shield" size={18} />
        </span>
        <div className="bl-grow bl-minw0">
          <h3 className="bl-card-title" id={id}>
            {p.title || 'اطلاعات سلامت'}
          </h3>
          <p className="bl-sens-note">{p.accessNote || 'فقط برای ورزشکار و مربی‌اش قابل مشاهده است. هر مشاهده و ویرایش ثبت می‌شود.'}</p>
        </div>
        <Badge tone="neutral" icon="lock" size="sm">
          {p.badge || 'محدود'}
        </Badge>
      </header>
      {hidden ? (
        <div className="bl-sens-hidden">
          <Icon name="eye-off" size={18} />
          <div className="bl-grow">
            <div className="bl-sens-ht">{p.hiddenTitle || 'جزئیات روی صفحه پنهان است'}</div>
            <div className="bl-muted bl-small">{p.hiddenNote || 'برای مشاهده، نمایش دهید. این دسترسی در گزارش ثبت می‌شود.'}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon="eye"
            onClick={() => {
              setHidden(false);
              p.onReveal?.();
            }}
          >
            نمایش
          </Button>
        </div>
      ) : (
        <div className="bl-sens-body">
          {p.children}
          {p.hidden !== undefined ? (
            <div style={{ marginTop: 12 }}>
              <Button variant="ghost" size="sm" icon="eye-off" onClick={() => setHidden(true)}>
                پنهان کردن
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {p.footer ? (
        <footer className="bl-sens-foot">
          <Icon name="history" size={14} />
          {p.footer}
        </footer>
      ) : null}
    </section>
  );
}
