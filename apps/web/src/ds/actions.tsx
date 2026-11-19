import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { go } from '@/lib/nav';
import { Icon, type IconName } from './Icon';
import { cx } from './utils';

type IconRef = IconName | (string & {});

export function Spinner({ size, label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <span className={cx('bl-spinner', size === 'sm' && 'bl-spinner-sm', size === 'lg' && 'bl-spinner-lg')} role={label ? 'status' : undefined} aria-label={label || undefined} />
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | (string & {});

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconRef;
  iconRight?: IconRef;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Route key to navigate to after `onClick`. */
  to?: string;
  type?: 'button' | 'submit' | 'reset';
  label?: ReactNode;
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  demoState?: string;
  className?: string;
  style?: CSSProperties;
  ariaHaspopup?: 'menu' | 'listbox' | 'dialog' | boolean;
  ariaExpanded?: boolean;
}

export function Button(p: ButtonProps) {
  const v = p.variant || 'primary';
  const s = p.size || 'md';
  const loading = !!p.loading;
  const label = p.children != null ? p.children : p.label;
  const is = s === 'sm' ? 16 : s === 'lg' ? 20 : 18;
  const onClick = p.to
    ? (e: MouseEvent<HTMLButtonElement>) => {
        p.onClick?.(e);
        go(p.to as string);
      }
    : p.onClick;
  return (
    <button
      type={p.type || 'button'}
      className={cx('bl-btn', 'bl-btn-' + v, 'bl-btn-' + s, p.fullWidth && 'bl-btn-block', p.demoState && 'is-' + p.demoState, loading && 'is-loading', p.className)}
      disabled={p.disabled || undefined}
      aria-busy={loading || undefined}
      aria-haspopup={p.ariaHaspopup}
      aria-expanded={p.ariaExpanded}
      onClick={onClick}
      style={p.style}
    >
      {loading ? <Spinner size="sm" /> : p.icon ? <Icon name={p.icon} size={is} /> : null}
      {label != null ? <span className="bl-btn-label">{label}</span> : null}
      {p.iconRight && !loading ? <Icon name={p.iconRight} size={is} /> : null}
    </button>
  );
}

export interface IconButtonProps {
  icon: IconRef;
  /** Accessible name (also the tooltip). */
  label: string;
  variant?: 'ghost' | 'secondary' | 'primary' | (string & {});
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  badge?: boolean;
  demoState?: string;
  className?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function IconButton(p: IconButtonProps) {
  const s = p.size || 'md';
  return (
    <button
      type="button"
      className={cx('bl-iconbtn', 'bl-iconbtn-' + (p.variant || 'ghost'), 'bl-iconbtn-' + s, p.demoState && 'is-' + p.demoState, p.className)}
      aria-label={p.label}
      title={p.label}
      disabled={p.disabled || undefined}
      onClick={p.onClick}
    >
      <Icon name={p.icon} size={s === 'sm' ? 16 : s === 'lg' ? 22 : 18} />
      {p.badge ? <span className="bl-iconbtn-dot" aria-hidden="true" /> : null}
    </button>
  );
}

export interface MenuItem {
  label?: ReactNode;
  description?: ReactNode;
  icon?: IconRef;
  shortcut?: string;
  badge?: ReactNode;
  checked?: boolean;
  destructive?: boolean;
  active?: boolean;
  disabled?: boolean;
  divider?: boolean;
  section?: ReactNode;
  to?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function Menu({ items, label, style, onSelect }: { items?: MenuItem[]; label?: string; style?: CSSProperties; onSelect?: (it: MenuItem, i: number) => void }) {
  return (
    <div className="bl-menu" role="menu" aria-label={label} style={style}>
      {(items || []).map((it, i) => {
        if (it.divider) return <div key={i} className="bl-menu-sep" role="separator" />;
        if (it.section)
          return (
            <div key={i} className="bl-menu-section">
              {it.section}
            </div>
          );
        const chk = it.checked !== undefined;
        return (
          <button
            key={i}
            type="button"
            role={chk ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={chk ? !!it.checked : undefined}
            className={cx('bl-menu-item', it.destructive && 'is-destructive', it.active && 'is-active')}
            disabled={it.disabled || undefined}
            onClick={(e) => {
              it.onClick?.(e);
              if (it.to) go(it.to);
              onSelect?.(it, i);
            }}
          >
            {it.icon ? <Icon name={it.icon} size={16} /> : chk ? <span className="bl-menu-check">{it.checked ? <Icon name="check" size={16} /> : null}</span> : null}
            <span className="bl-menu-label">
              {it.label}
              {it.description ? <span className="bl-menu-desc">{it.description}</span> : null}
            </span>
            {it.shortcut ? <kbd className="bl-kbd">{it.shortcut}</kbd> : null}
            {it.badge ? <span className="bl-menu-badge">{it.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Row ⋯ menu for tables; the menu is `position: fixed` so it escapes scroll containers. */
export function RowActions({ items }: { items?: MenuItem[] }) {
  const [pos, setPos] = useState<{ top: number; left: number; above: number; placed?: boolean } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Open below the button, or above it when there isn't room (rows near the bottom of the page, #49).
  useLayoutEffect(() => {
    if (!pos || pos.placed || !menuRef.current) return;
    const h = menuRef.current.offsetHeight;
    const w = menuRef.current.offsetWidth;
    const below = pos.top + h <= window.innerHeight - 8;
    const top = below ? pos.top : Math.max(8, pos.above - h);
    const left = Math.min(Math.max(8, pos.left), window.innerWidth - w - 8);
    setPos({ ...pos, top, left, placed: true });
  }, [pos]);
  useEffect(() => {
    if (!pos) return;
    const close = (e: globalThis.MouseEvent) => {
      if (ref.current && ref.current.contains(e.target as Node)) return;
      setPos(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPos(null);
    };
    const onScroll = () => setPos(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', onScroll, { once: true, capture: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [pos]);
  const list = items || [];
  return (
    <span ref={ref} style={{ display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <IconButton
        icon="more"
        label="اقدامات"
        size="sm"
        onClick={(e) => {
          if (pos) return setPos(null);
          const b = e.currentTarget.getBoundingClientRect();
          setPos({ top: b.bottom + 4, left: b.left, above: b.top - 4 });
        }}
      />
      {pos && list.length ? (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 'var(--z-dropdown)' as unknown as number, visibility: pos.placed ? 'visible' : 'hidden' }}
        >
          <Menu items={list} label="اقدامات" onSelect={() => setPos(null)} style={{ position: 'static', minWidth: 180, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }} />
        </div>
      ) : null}
    </span>
  );
}

export function Dropdown(p: { label?: string; items?: MenuItem[]; variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; icon?: IconRef; align?: 'start' | 'end'; open?: boolean }) {
  const [open, setOpen] = useState(!!p.open);
  return (
    <div className="bl-dropdown">
      <Button variant={p.variant || 'secondary'} size={p.size} icon={p.icon} iconRight="chevron-down" ariaHaspopup="menu" ariaExpanded={open} onClick={() => setOpen(!open)}>
        {p.label}
      </Button>
      {open ? <Menu items={p.items} label={p.label} onSelect={() => setOpen(false)} style={p.align === 'end' ? { right: 0 } : { left: 0 }} /> : null}
    </div>
  );
}
