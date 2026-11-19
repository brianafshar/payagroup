import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Button, IconButton } from './actions';
import { Badge } from './data';
import { Icon, type IconName } from './Icon';
import { TONE_ICON, type Tone } from './status';
import { cx, num, useUid, type Numeric } from './utils';

type IconRef = IconName | (string & {});

export interface CardAction {
  label: ReactNode;
  icon?: IconRef;
  iconRight?: IconRef;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  icon?: IconRef;
  badge?: ReactNode;
  badgeTone?: Tone;
  badgeIcon?: IconRef;
  action?: CardAction | null;
  actionLabel?: ReactNode;
  actionTo?: string;
  onAction?: (e: MouseEvent<HTMLButtonElement>) => void;
  footer?: ReactNode;
  padding?: 'none' | 'sm' | 'md';
  interactive?: boolean;
  selected?: boolean;
  demoState?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Card(p: CardProps) {
  const act = p.action || (p.actionLabel ? { label: p.actionLabel, iconRight: 'arrow-left' as IconRef } : null);
  return (
    <section
      className={cx(
        'bl-card',
        p.interactive && 'is-interactive',
        p.selected && 'is-selected',
        p.padding === 'none' && 'bl-card-flush',
        p.padding === 'sm' && 'bl-card-sm',
        p.demoState && 'is-' + p.demoState,
      )}
      style={p.style}
    >
      {p.title || p.eyebrow ? (
        <header className="bl-card-head">
          <div className="bl-grow bl-minw0">
            {p.eyebrow ? <div className="bl-card-eyebrow">{p.eyebrow}</div> : null}
            {p.title ? (
              <h3 className="bl-card-title">
                {p.icon ? <Icon name={p.icon} size={18} /> : null}
                {p.title}
                {p.badge ? (
                  <Badge size="sm" tone={p.badgeTone || 'neutral'} icon={p.badgeIcon}>
                    {p.badge}
                  </Badge>
                ) : null}
              </h3>
            ) : null}
            {p.subtitle ? <p className="bl-card-sub">{p.subtitle}</p> : null}
          </div>
          {act ? (
            <Button variant="ghost" size="sm" icon={act.icon} iconRight={act.iconRight} to={p.actionTo} onClick={act.onClick || p.onAction}>
              {act.label}
            </Button>
          ) : null}
        </header>
      ) : null}
      <div className="bl-card-body">{p.children}</div>
      {p.footer ? <footer className="bl-card-foot">{p.footer}</footer> : null}
    </section>
  );
}

export interface AccordionItem {
  title: ReactNode;
  content?: ReactNode;
  icon?: IconRef;
  meta?: ReactNode;
  open?: boolean;
}

export function Accordion({ items }: { items?: AccordionItem[] }) {
  const list = items || [];
  const [open, setOpen] = useState<boolean[]>(list.map((it) => !!it.open));
  return (
    <div className="bl-acc">
      {list.map((it, i) => {
        const id = 'acc' + i + String(typeof it.title === 'string' ? it.title : '').replace(/\W/g, '');
        return (
          <div key={i} className={cx('bl-acc-item', open[i] && 'is-open')}>
            <h3 className="bl-acc-h">
              <button
                type="button"
                className="bl-acc-btn"
                aria-expanded={!!open[i]}
                aria-controls={id}
                onClick={() => {
                  const n = open.slice();
                  n[i] = !n[i];
                  setOpen(n);
                }}
              >
                {it.icon ? <Icon name={it.icon} size={18} /> : null}
                <span className="bl-grow">{it.title}</span>
                {it.meta ? <span className="bl-acc-meta">{it.meta}</span> : null}
                <Icon name="chevron-down" size={18} className="bl-acc-chev" />
              </button>
            </h3>
            {open[i] ? (
              <div className="bl-acc-panel" id={id} role="region">
                {it.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function Tooltip(p: { label?: ReactNode; placement?: 'top' | 'bottom' | 'start' | 'end'; open?: boolean; children?: ReactNode }) {
  return (
    <span className="bl-tip-wrap">
      {p.children}
      {p.open || p.open === undefined ? (
        <span role="tooltip" className={'bl-tip bl-tip-' + (p.placement || 'top')}>
          {p.label}
        </span>
      ) : null}
    </span>
  );
}

/** Esc closes the top-most overlay. */
function useEscape(active: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!active || !onClose) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [active, onClose]);
}

export interface ModalProps {
  open?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'destructive';
  primaryLabel?: ReactNode;
  secondaryLabel?: ReactNode;
  primaryDisabled?: boolean;
  loading?: boolean;
  footNote?: ReactNode;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onClose?: () => void;
  children?: ReactNode;
}

/** Dialog. Esc or a click on the overlay closes it; the primary action stays disabled until valid. */
export function Modal(p: ModalProps) {
  const id = useUid('dlg');
  const visible = p.open === undefined || !!p.open;
  useEscape(visible, p.onClose);
  if (!visible) return null;
  const destr = p.tone === 'destructive';
  return (
    <div className="bl-layer">
      <div className="bl-scrim" aria-hidden="true" onClick={p.onClose} />
      <div
        className={cx('bl-modal', 'bl-modal-' + (p.size || 'md'))}
        role={destr ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={id + 't'}
        aria-describedby={p.description ? id + 'd' : undefined}
      >
        <div className="bl-modal-head">
          {destr ? (
            <span className="bl-modal-ic">
              <Icon name="alert-triangle" size={20} />
            </span>
          ) : null}
          <div className="bl-grow">
            <h2 className="bl-modal-title" id={id + 't'}>
              {p.title}
            </h2>
            {p.description ? (
              <p className="bl-modal-desc" id={id + 'd'}>
                {p.description}
              </p>
            ) : null}
          </div>
          <IconButton icon="x" label="بستن" size="sm" onClick={p.onClose} />
        </div>
        {p.children ? <div className="bl-modal-body">{p.children}</div> : null}
        <div className="bl-modal-foot">
          {p.footNote ? <span className="bl-modal-note">{p.footNote}</span> : null}
          {p.secondaryLabel ? (
            <Button variant="secondary" onClick={p.onSecondary || p.onClose}>
              {p.secondaryLabel}
            </Button>
          ) : null}
          {p.primaryLabel ? (
            <Button variant={destr ? 'destructive' : 'primary'} disabled={p.primaryDisabled} loading={p.loading} onClick={p.onPrimary}>
              {p.primaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Drawer(p: {
  open?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  width?: Numeric;
  scrim?: boolean;
  primaryLabel?: ReactNode;
  secondaryLabel?: ReactNode;
  loading?: boolean;
  footNote?: ReactNode;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const id = useUid('dr');
  const visible = p.open === undefined || !!p.open;
  useEscape(visible, p.onClose);
  if (!visible) return null;
  return (
    <div className="bl-layer bl-layer-end">
      {p.scrim === false ? null : <div className="bl-scrim" aria-hidden="true" onClick={p.onClose} />}
      <aside className="bl-drawer" role="dialog" aria-modal="true" aria-labelledby={id + 't'} style={p.width ? { width: num(p.width, 480) } : undefined}>
        <div className="bl-drawer-head">
          <div className="bl-grow">
            <h2 className="bl-modal-title" id={id + 't'}>
              {p.title}
            </h2>
            {p.subtitle ? <p className="bl-modal-desc">{p.subtitle}</p> : null}
          </div>
          <IconButton icon="x" label="بستن" size="sm" onClick={p.onClose} />
        </div>
        <div className="bl-drawer-body">{p.children}</div>
        {p.primaryLabel || p.secondaryLabel ? (
          <div className="bl-modal-foot">
            {p.footNote ? <span className="bl-modal-note">{p.footNote}</span> : null}
            {p.secondaryLabel ? (
              <Button variant="secondary" onClick={p.onSecondary || p.onClose}>
                {p.secondaryLabel}
              </Button>
            ) : null}
            {p.primaryLabel ? (
              <Button variant="primary" loading={p.loading} onClick={p.onPrimary}>
                {p.primaryLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function Toast(p: { tone?: Tone; icon?: IconRef; title?: ReactNode; description?: ReactNode; actionLabel?: ReactNode; onAction?: () => void; onDismiss?: () => void }) {
  const tone = p.tone || 'success';
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="bl-toast" role={tone === 'error' ? 'alert' : 'status'}>
      <span className={'bl-tone-' + tone + ' bl-toast-ic'}>
        <Icon name={p.icon || TONE_ICON[tone]} size={20} stroke={2} />
      </span>
      <div className="bl-grow bl-minw0">
        <div className="bl-toast-title">{p.title}</div>
        {p.description ? <div className="bl-toast-desc">{p.description}</div> : null}
      </div>
      {p.actionLabel ? (
        <button type="button" className="bl-link-btn" onClick={p.onAction}>
          {p.actionLabel}
        </button>
      ) : null}
      <IconButton icon="x" label="نادیده گرفتن" size="sm" onClick={() => (p.onDismiss ? p.onDismiss() : setHidden(true))} />
    </div>
  );
}

export interface BannerProps {
  tone?: Tone;
  icon?: IconRef;
  title?: ReactNode;
  description?: ReactNode;
  actionLabel?: ReactNode;
  actionTo?: string;
  onAction?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
  children?: ReactNode;
}

export function Banner(p: BannerProps) {
  const tone = p.tone || 'info';
  return (
    <div className={cx('bl-banner', 'bl-banner-' + tone)} role={tone === 'error' ? 'alert' : 'status'}>
      <span className={'bl-tone-' + tone}>
        <Icon name={p.icon || TONE_ICON[tone]} size={18} stroke={2} />
      </span>
      <div className="bl-grow bl-minw0">
        {p.title ? <div className="bl-banner-title">{p.title}</div> : null}
        {p.description ? <div className="bl-banner-desc">{p.description}</div> : null}
        {p.children || null}
      </div>
      {p.actionLabel ? (
        <Button variant="secondary" size="sm" onClick={p.onAction} to={p.actionTo}>
          {p.actionLabel}
        </Button>
      ) : null}
      {p.dismissible ? <IconButton icon="x" label="نادیده گرفتن" size="sm" onClick={p.onDismiss} /> : null}
    </div>
  );
}
