import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { go, href } from '@/lib/nav';
import { Button, IconButton, RowActions, type MenuItem } from './actions';
import { EmptyState, ErrorState } from './feedback';
import { Checkbox } from './forms';
import { Icon, type IconName } from './Icon';
import { Avatar } from './identity';
import { TrendIndicator } from './metrics';
import { STATUS, statusOf, type Tone } from './status';
import { cx, fmt, num, type Numeric } from './utils';

type IconRef = IconName | (string & {});

export interface BadgeProps {
  tone?: Tone;
  icon?: IconRef | null;
  status?: string;
  size?: 'sm' | 'md';
  dot?: boolean;
  label?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Badge(p: BadgeProps) {
  const S = statusOf(p.status);
  const tone = p.tone || (S ? S.tone : 'neutral');
  const icon = p.icon || (S ? S.icon : null);
  const label = p.children != null ? p.children : p.label != null ? p.label : S ? S.label : '';
  return (
    <span className={cx('bl-badge', 'bl-badge-' + tone, p.size === 'sm' && 'bl-badge-sm', p.dot && 'bl-badge-dot', p.className)}>
      {icon && !p.dot ? <Icon name={icon} size={p.size === 'sm' ? 12 : 14} stroke={2} /> : p.dot ? <span className="bl-dot" aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

export function Tag(p: {
  variant?: 'default' | 'filter';
  selected?: boolean;
  icon?: IconRef;
  count?: ReactNode;
  removable?: boolean;
  label?: ReactNode;
  children?: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
}) {
  const sel = !!p.selected;
  const filt = p.variant === 'filter';
  const lbl = p.children != null ? p.children : p.label;
  const inner = (
    <>
      {sel && filt ? <Icon name="check" size={14} stroke={2} /> : p.icon ? <Icon name={p.icon} size={14} /> : null}
      <span>{lbl}</span>
      {p.count != null ? <span className="bl-tag-count">{p.count}</span> : null}
      {p.removable ? (
        <button type="button" className="bl-tag-x" aria-label={'حذف ' + (typeof lbl === 'string' ? lbl : '')} onClick={p.onRemove}>
          <Icon name="x" size={12} stroke={2} />
        </button>
      ) : null}
    </>
  );
  return filt ? (
    <button type="button" className={cx('bl-tag', 'bl-tag-filter', sel && 'is-on')} aria-pressed={sel} onClick={p.onClick}>
      {inner}
    </button>
  ) : (
    <span className={cx('bl-tag', sel && 'is-on')}>{inner}</span>
  );
}

export interface DescriptionItem {
  label: ReactNode;
  value?: ReactNode;
  empty?: ReactNode;
}

export function DescriptionList(p: { items?: DescriptionItem[]; columns?: Numeric }) {
  return (
    <dl className={cx('bl-dl', 'bl-dl-' + num(p.columns, 2))}>
      {(p.items || []).map((it, i) => {
        const empty = it.value == null || it.value === '';
        return (
          <div key={i} className="bl-dl-item">
            <dt>{it.label}</dt>
            <dd>{empty ? <span className="bl-nr">{it.empty || 'ارائه نشده'}</span> : it.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A labelled value. Missing data renders "ثبت نشده" — never a fabricated value. */
export function ValueDisplay(p: {
  label?: ReactNode;
  value?: ReactNode;
  unit?: ReactNode;
  icon?: IconRef;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'row' | 'column';
  notRecorded?: boolean;
  notRecordedLabel?: ReactNode;
  estimated?: boolean;
  addLabel?: ReactNode;
  onAdd?: () => void;
}) {
  const nr = p.notRecorded || p.value == null || p.value === '';
  return (
    <div className={cx('bl-vd', p.size && 'bl-vd-' + p.size, p.layout === 'row' && 'bl-vd-row')}>
      <span className="bl-vd-label">
        {p.icon ? <Icon name={p.icon} size={14} /> : null}
        {p.label}
      </span>
      {nr ? (
        <span className="bl-nr bl-vd-nr">
          {p.notRecordedLabel || 'ثبت نشده'}
          {p.addLabel ? (
            <button type="button" className="bl-link-btn" onClick={p.onAdd}>
              {p.addLabel}
            </button>
          ) : null}
        </span>
      ) : (
        <span className="bl-vd-val">
          {p.estimated ? (
            <span className="bl-vd-est" aria-hidden="true">
              {'≈'}
            </span>
          ) : null}
          {p.value}
          {p.unit ? <span className="bl-vd-unit">{p.unit}</span> : null}
          {p.estimated ? <span className="bl-vd-tag">تخمینی</span> : null}
        </span>
      )}
    </div>
  );
}

export function ListRow(p: {
  title?: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  icon?: IconRef;
  badge?: ReactNode;
  badgeTone?: Tone;
  badgeIcon?: IconRef;
  locked?: boolean;
  danger?: boolean;
  chevron?: boolean;
  to?: string;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}) {
  const clickable = !!(p.to || p.onClick);
  return (
    <div
      className={cx('bl-lrow', p.locked && 'is-locked', p.danger && 'is-danger')}
      style={clickable ? { cursor: 'pointer' } : undefined}
      onClick={
        clickable
          ? (e) => {
              p.onClick?.(e);
              if (p.to) go(p.to);
            }
          : undefined
      }
    >
      {p.icon ? (
        <span className="bl-lrow-ic">
          <Icon name={p.icon} size={18} />
        </span>
      ) : null}
      <div className="bl-grow bl-minw0">
        <div className="bl-lrow-title">{p.title}</div>
        {p.subtitle ? <div className="bl-lrow-sub">{p.subtitle}</div> : null}
      </div>
      {p.value ? <span className="bl-lrow-val">{p.value}</span> : null}
      {p.badge ? (
        <Badge size="sm" tone={p.badgeTone || 'neutral'} icon={p.badgeIcon}>
          {p.badge}
        </Badge>
      ) : null}
      {p.locked ? <Icon name="lock" size={16} label="قفل" /> : p.chevron === false ? null : <Icon name="chevron-right" size={18} className="bl-lrow-chev" />}
    </div>
  );
}

export interface Column {
  key: string;
  label?: ReactNode;
  type?: 'person' | 'status' | 'badge' | 'progress' | 'delta' | 'number' | 'tags' | 'actions' | 'link' | 'mono' | 'text';
  align?: 'left' | 'right';
  width?: Numeric;
  sortable?: boolean;
  unit?: string;
  goodDirection?: 'up' | 'down' | 'none';
  empty?: ReactNode;
  actions?: MenuItem[];
}

/** Rows are loosely typed: each column reads `row[col.key]` and renders by `col.type`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = { id?: string; to?: string; muted?: boolean; highlight?: boolean; lowerIsBetter?: boolean; actions?: MenuItem[]; [key: string]: any };

function Cell(col: Column, row: Row): ReactNode {
  const v = row[col.key];
  switch (col.type) {
    case 'person': {
      const name = v && v.name ? v.name : v;
      return (
        <div className="bl-td-person">
          <Avatar name={name} size="sm" />
          <div className="bl-minw0">
            <div className="bl-td-strong">{name}</div>
            {v && v.sub ? <div className="bl-td-sub">{v.sub}</div> : null}
          </div>
        </div>
      );
    }
    case 'status':
      return v ? <Badge status={v} size="sm" /> : null;
    case 'badge':
      return v ? (
        <Badge tone={v.tone} icon={v.icon} size="sm">
          {v.label}
        </Badge>
      ) : (
        <span className="bl-muted">{'—'}</span>
      );
    case 'progress':
      return v == null ? (
        <span className="bl-nr">بدون داده</span>
      ) : (
        <div className="bl-td-prog">
          <div className="bl-pbar-track bl-pbar-sm" aria-hidden="true">
            <div className="bl-pbar-fill" style={{ width: num(v, 0) + '%' }} />
          </div>
          <span className="bl-td-num">{'٪' + fmt(v)}</span>
        </div>
      );
    case 'delta':
      return v == null ? (
        <span className="bl-muted">{'—'}</span>
      ) : (
        <TrendIndicator value={v} unit={col.unit} goodDirection={row.lowerIsBetter ? 'down' : col.goodDirection || 'up'} size="sm" />
      );
    case 'number':
      return v == null || v === '' ? <span className="bl-nr">{col.empty || 'ثبت نشده'}</span> : <span className="bl-td-num">{fmt(v)}</span>;
    case 'tags':
      return (
        <div className="bl-td-tags">
          {(Array.isArray(v) ? v : []).map((t: ReactNode, i: number) => (
            <span key={i} className="bl-chip">
              {t}
            </span>
          ))}
        </div>
      );
    case 'actions':
      return <RowActions items={(row && row.actions) || col.actions || []} />;
    case 'link':
      return (
        <a href={row.to ? href(row.to) : '#'} className="bl-td-link">
          {v}
        </a>
      );
    case 'mono':
      return <span className="bl-mono">{v}</span>;
    default:
      if (v == null || v === '') return <span className="bl-muted">{'—'}</span>;
      if (typeof v === 'object' && !('$$typeof' in v))
        return (
          <div className="bl-minw0">
            <div className="bl-td-strong">{v.label}</div>
            {v.sub ? <div className="bl-td-sub">{v.sub}</div> : null}
          </div>
        );
      return v;
  }
}

export interface BulkAction {
  label: ReactNode;
  icon?: IconRef;
  destructive?: boolean;
}

export interface DataTableProps {
  columns?: Column[];
  rows?: Row[];
  selectable?: boolean;
  selected?: string[];
  onSelectChange?: (ids: string[]) => void;
  bulkActions?: BulkAction[];
  onBulkAction?: (a: BulkAction, ids: string[]) => void;
  sort?: { key?: string; dir?: 'asc' | 'desc' } | null;
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  pagination?: { label?: ReactNode; prevDisabled?: boolean; nextDisabled?: boolean; onPrev?: () => void; onNext?: () => void } | null;
  loading?: boolean;
  error?: boolean;
  errorTitle?: ReactNode;
  errorDescription?: ReactNode;
  onRetry?: () => void;
  emptyIcon?: IconRef;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  onEmptyAction?: () => void;
  onRowClick?: (r: Row) => void;
  dense?: boolean;
  bare?: boolean;
  caption?: ReactNode;
}

export function DataTable(p: DataTableProps) {
  const cols = p.columns || [];
  const rows = p.rows || [];
  const sel = !!p.selectable;
  const selIds = p.selected || [];
  const sort = p.sort || {};
  const pg = p.pagination;
  const span = cols.length + (sel ? 1 : 0);
  const head = (
    <thead>
      <tr>
        {sel ? (
          <th className="bl-td-check" scope="col">
            <Checkbox
              key={'all' + selIds.length}
              checked={rows.length > 0 && selIds.length === rows.length}
              indeterminate={selIds.length > 0 && selIds.length < rows.length}
              ariaLabel="انتخاب همه ردیف‌ها"
              onChange={() => p.onSelectChange?.(selIds.length === rows.length ? [] : rows.map((x, k) => x.id || String(k)))}
            />
          </th>
        ) : null}
        {cols.map((c) => {
          const on = sort.key === c.key;
          return (
            <th
              key={c.key}
              scope="col"
              className={cx(c.align === 'right' && 'is-right', c.type === 'actions' && 'bl-td-actions')}
              style={c.width ? ({ width: c.width } as CSSProperties) : undefined}
              aria-sort={on ? (sort.dir === 'desc' ? 'descending' : 'ascending') : undefined}
            >
              {c.sortable ? (
                <button
                  type="button"
                  className={cx('bl-th-sort', on && 'is-on')}
                  onClick={p.onSort ? () => p.onSort?.(c.key, on && sort.dir === 'asc' ? 'desc' : 'asc') : undefined}
                >
                  {c.label}
                  <Icon name={on ? (sort.dir === 'desc' ? 'arrow-down' : 'arrow-up') : 'sort'} size={14} />
                </button>
              ) : (
                c.label
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
  let body: ReactNode;
  if (p.loading)
    body = (
      <tbody aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <tr key={i}>
            {sel ? (
              <td className="bl-td-check">
                <span className="bl-skel" style={{ width: 18, height: 18 }} />
              </td>
            ) : null}
            {cols.map((c, j) => (
              <td key={c.key}>
                <span className="bl-skel bl-skel-text" style={{ width: 35 + ((i * 17 + j * 23) % 45) + '%' }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  else if (p.error)
    body = (
      <tbody>
        <tr>
          <td colSpan={span} className="bl-td-empty">
            <ErrorState
              title={p.errorTitle || 'فهرست بارگذاری نشد'}
              description={p.errorDescription || 'اتصال خود را بررسی و دوباره تلاش کنید. فیلترها حفظ شده‌اند.'}
              actionLabel="تلاش دوباره"
              onAction={p.onRetry}
              compact
            />
          </td>
        </tr>
      </tbody>
    );
  else if (!rows.length)
    body = (
      <tbody>
        <tr>
          <td colSpan={span} className="bl-td-empty">
            <EmptyState
              icon={p.emptyIcon || 'search'}
              title={p.emptyTitle || 'نتیجه‌ای یافت نشد'}
              description={p.emptyDescription}
              actionLabel={p.emptyAction}
              onAction={p.onEmptyAction}
              compact
            />
          </td>
        </tr>
      </tbody>
    );
  else
    body = (
      <tbody>
        {rows.map((r, i) => {
          const rid = r.id || String(i);
          const isSel = selIds.indexOf(rid) >= 0;
          const clickable = !!(r.to || p.onRowClick);
          return (
            <tr
              key={r.id || i}
              className={cx(isSel && 'is-selected', r.muted && 'is-muted', r.highlight && 'is-highlight')}
              aria-selected={sel ? isSel : undefined}
              style={clickable ? { cursor: 'pointer' } : undefined}
              onClick={
                clickable
                  ? (e) => {
                      if ((e.target as Element).closest('input,button,label,a')) return;
                      p.onRowClick?.(r);
                      if (r.to) go(r.to);
                    }
                  : undefined
              }
            >
              {sel ? (
                <td className="bl-td-check">
                  <Checkbox
                    key={'s' + isSel}
                    checked={isSel}
                    ariaLabel="انتخاب ردیف"
                    onChange={() => p.onSelectChange?.(isSel ? selIds.filter((x) => x !== rid) : selIds.concat([rid]))}
                  />
                </td>
              ) : null}
              {cols.map((c) => (
                <td key={c.key} className={cx(c.align === 'right' && 'is-right', c.type === 'actions' && 'bl-td-actions')}>
                  {Cell(c, r)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    );
  const bulk = p.bulkActions || [];
  return (
    <div className={cx('bl-dt', p.dense && 'is-dense', p.bare && 'is-bare')}>
      {sel && selIds.length && bulk.length ? (
        <div className="bl-dt-bulk" role="status">
          <span className="bl-dt-bulk-n">{fmt(selIds.length) + ' مورد انتخاب شد'}</span>
          {bulk.map((a, i) => (
            <Button
              key={i}
              variant={a.destructive ? 'ghost' : 'secondary'}
              size="sm"
              icon={a.icon}
              className={a.destructive ? 'bl-text-error' : undefined}
              onClick={() => p.onBulkAction?.(a, selIds)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="bl-dt-scroll">
        <table className="bl-table">
          {p.caption ? <caption className="bl-sr">{p.caption}</caption> : null}
          {head}
          {body}
        </table>
      </div>
      {pg ? (
        <div className="bl-dt-foot">
          <span>{pg.label}</span>
          <div className="bl-row-8">
            <IconButton icon="chevron-right" label="صفحه قبل" size="sm" variant="secondary" disabled={pg.prevDisabled} onClick={pg.onPrev} />
            <IconButton icon="chevron-left" label="صفحه بعد" size="sm" variant="secondary" disabled={pg.nextDisabled} onClick={pg.onNext} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Read-only table (no selection/pagination, bare by default). */
export function Table(p: DataTableProps) {
  return <DataTable {...p} selectable={false} pagination={null} bare={p.bare === undefined ? true : p.bare} />;
}

export function Calendar(p: {
  month?: string;
  startOffset?: Numeric;
  daysInMonth?: Numeric;
  statuses?: Record<number, string>;
  today?: Numeric;
  selected?: Numeric;
  size?: 'sm' | 'md';
  legend?: boolean;
}) {
  const start = num(p.startOffset, 1);
  const n = num(p.daysInMonth, 30);
  const st = p.statuses || {};
  const today = num(p.today);
  const sel = num(p.selected);
  const cells: Array<number | null> = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const month = p.month || 'September 2026';
  return (
    <div className={cx('bl-cal', p.size === 'sm' && 'bl-cal-sm')}>
      <div className="bl-cal-head">
        <IconButton icon="chevron-right" label="ماه قبل" size="sm" />
        <div className="bl-cal-title" aria-live="polite">
          {month}
        </div>
        <IconButton icon="chevron-left" label="ماه بعد" size="sm" />
      </div>
      <div className="bl-cal-grid" role="grid" aria-label={month}>
        {WD.map((w) => (
          <div key={w} className="bl-cal-wd" role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((day, k) => {
          if (!day) return <div key={'e' + k} className="bl-cal-cell is-empty" aria-hidden="true" />;
          const S = statusOf(st[day]);
          return (
            <button
              key={k}
              type="button"
              role="gridcell"
              className={cx('bl-cal-cell', day === today && 'is-today', day === sel && 'is-selected')}
              aria-label={day + ' ' + month + (S ? ', ' + S.label : '') + (day === today ? ', today' : '')}
              aria-selected={day === sel || undefined}
            >
              <span className="bl-cal-num">{day}</span>
              <span className={cx('bl-cal-mark', S && 'bl-tone-' + S.tone)}>{S ? <Icon name={S.icon} size={12} stroke={2.25} /> : null}</span>
            </button>
          );
        })}
      </div>
      {p.legend ? (
        <div className="bl-cal-legend">
          {(['completed', 'partial', 'missed', 'rest', 'planned'] as const).map((k) => (
            <span key={k} className="bl-cal-leg">
              <span className={'bl-tone-' + STATUS[k].tone}>
                <Icon name={STATUS[k].icon} size={12} stroke={2.25} />
              </span>
              {STATUS[k].label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
