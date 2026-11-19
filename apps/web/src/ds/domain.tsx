import { useState, type MouseEvent, type ReactNode } from 'react';
import { go } from '@/lib/nav';
import { Button, IconButton } from './actions';
import { Badge } from './data';
import { SegmentedControl } from './forms';
import { Icon, type IconName } from './Icon';
import { Avatar } from './identity';
import { ProgressBar, TrendIndicator } from './metrics';
import type { Tone } from './status';
import { cx, fmt, num, type Numeric } from './utils';

type IconRef = IconName | (string & {});

const LEVELS: Record<string, number> = { مبتدی: 1, متوسط: 2, پیشرفته: 3, beginner: 1, intermediate: 2, advanced: 3 };

function Difficulty({ level }: { level?: string }) {
  const lv = LEVELS[(level || '').toLowerCase()] || 1;
  return (
    <span className="bl-diff-lv">
      <span className="bl-diff-bars" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= lv ? 'is-on' : ''} />
        ))}
      </span>
      {level}
    </span>
  );
}

export interface ExerciseCardProps {
  name?: ReactNode;
  category?: string;
  equipment?: string;
  sport?: ReactNode;
  /** Small label on the picture, e.g. «کش» for a band exercise shown with its cable/dumbbell picture. */
  badge?: ReactNode;
  difficulty?: string;
  metrics?: string[];
  hasVideo?: boolean;
  /** Cover image (library photo or the coach's own). */
  imageSrc?: string | null;
  duration?: ReactNode;
  usage?: ReactNode;
  variant?: 'grid' | 'row';
  selected?: boolean;
  draggable?: boolean;
  dragging?: boolean;
  actionIcon?: IconRef | 'none';
  onAction?: () => void;
  to?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  demoState?: string;
}

export function ExerciseCard(p: ExerciseCardProps) {
  const metrics = p.metrics || [];
  const meta = [p.category, p.equipment].filter(Boolean).join(' · ');
  if (p.variant === 'row')
    return (
      <div className={cx('bl-exrow', p.selected && 'is-selected', p.dragging && 'is-dragging')}>
        {p.draggable ? (
          <span className="bl-grip" aria-hidden="true">
            <Icon name="grip" size={16} />
          </span>
        ) : null}
        <span className="bl-exrow-thumb" aria-hidden="true">
          {p.imageSrc ? <img src={p.imageSrc} alt="" loading="lazy" /> : <Icon name={p.hasVideo ? 'play' : 'image'} size={14} />}
        </span>
        <div className="bl-grow bl-minw0">
          <div className="bl-exrow-name">{p.name}</div>
          <div className="bl-exrow-meta">{meta}</div>
        </div>
        {p.actionIcon === 'none' ? null : (
          <IconButton icon={p.actionIcon || 'plus'} label={'افزودن ' + (typeof p.name === 'string' ? p.name : '')} size="sm" variant="secondary" onClick={p.onAction} />
        )}
      </div>
    );
  const clickable = !!(p.to || p.onClick);
  return (
    <article
      className={cx('bl-excard', p.selected && 'is-selected', p.demoState && 'is-' + p.demoState)}
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
      <div className="bl-excard-media">
        {p.imageSrc ? <img className="bl-excard-img" src={p.imageSrc} alt="" loading="lazy" /> : null}
        {p.hasVideo ? (
          <span className="bl-excard-play">
            <Icon name="play" size={14} />
            {p.duration || 'ویدیو'}
          </span>
        ) : p.imageSrc ? null : (
          <span className="bl-excard-nomedia">
            <Icon name="image" size={16} />
            بدون رسانه
          </span>
        )}
        {p.sport ? <span className="bl-excard-sport">{p.sport}</span> : null}
        {p.badge ? <span className="bl-excard-badge">{p.badge}</span> : null}
      </div>
      <div className="bl-excard-body">
        <h3 className="bl-excard-name">{p.name}</h3>
        <div className="bl-excard-meta">{meta}</div>
        {p.difficulty ? <Difficulty level={p.difficulty} /> : null}
        {metrics.length ? (
          <div className="bl-excard-metrics" aria-label="شاخص‌های پایش‌شده">
            {metrics.map((m) => (
              <span key={m} className="bl-chip">
                {m}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {p.usage != null ? (
        <footer className="bl-excard-foot">
          <Icon name="layers" size={14} />
          {p.usage}
        </footer>
      ) : null}
    </article>
  );
}

export function WorkoutCard(p: {
  status?: string;
  variant?: 'default' | 'hero' | 'compact';
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: string;
  exercises?: number;
  duration?: string;
  setsDone?: Numeric;
  setsTotal?: Numeric;
  ctaLabel?: ReactNode;
  ctaTo?: string;
  onCta?: () => void;
}) {
  const st = p.status || 'planned';
  const v = p.variant || 'default';
  const done = num(p.setsDone, 0);
  const total = num(p.setsTotal);
  if (st === 'rest')
    return (
      <article className={cx('bl-wcard', 'is-rest', v === 'hero' && 'is-hero')}>
        {p.eyebrow ? <div className="bl-wcard-eyebrow">{p.eyebrow}</div> : null}
        <h3 className="bl-wcard-title">
          <Icon name="moon" size={20} />
          {p.title || 'روز استراحت'}
        </h3>
        {p.subtitle ? <p className="bl-wcard-meta">{p.subtitle}</p> : null}
      </article>
    );
  return (
    <article className={cx('bl-wcard', v === 'hero' && 'is-hero', v === 'compact' && 'is-compact')}>
      <div className="bl-wcard-top">
        <div className="bl-grow bl-minw0">
          {p.eyebrow ? <div className="bl-wcard-eyebrow">{p.eyebrow}</div> : null}
          <h3 className="bl-wcard-title">{p.title}</h3>
          <div className="bl-wcard-meta">{[p.subtitle, p.exercises != null ? fmt(p.exercises) + ' حرکت' : null, p.duration].filter(Boolean).join(' · ')}</div>
        </div>
        <Badge status={st} size="sm" />
      </div>
      {total !== undefined && v !== 'compact' ? (
        <ProgressBar
          value={done}
          max={total}
          label="پیشرفت"
          valueLabel={fmt(done) + ' از ' + fmt(total) + ' ست · ٪' + fmt(Math.round((done / total) * 100))}
          size={v === 'hero' ? 'lg' : undefined}
        />
      ) : null}
      {p.ctaLabel ? (
        <Button variant="primary" size={v === 'hero' ? 'lg' : 'md'} fullWidth={v === 'hero'} iconRight="arrow-left" to={p.ctaTo} onClick={p.onCta}>
          {p.ctaLabel}
        </Button>
      ) : null}
    </article>
  );
}

const KIND = {
  template: { icon: 'layers', label: 'قالب', tone: 'neutral' },
  copy: { icon: 'link', label: 'نسخه ورزشکار', tone: 'info' },
  customized: { icon: 'git-branch', label: 'شخصی‌سازی‌شده', tone: 'brand' },
} as const;

export interface ProgramCardAction {
  label: ReactNode;
  icon?: IconRef;
  destructive?: boolean;
  to?: string;
  onClick?: () => void;
}

export function ProgramCard(p: {
  kind?: keyof typeof KIND;
  name?: ReactNode;
  version?: ReactNode;
  goal?: ReactNode;
  weeks?: ReactNode;
  frequency?: ReactNode;
  sport?: ReactNode;
  assigned?: ReactNode;
  updated?: ReactNode;
  actions?: ProgramCardAction[];
  selected?: boolean;
  to?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}) {
  const K = KIND[p.kind || 'template'];
  const acts = p.actions || [];
  const [open, setOpen] = useState(false);
  const clickable = !!(p.to || p.onClick);
  const name = typeof p.name === 'string' ? p.name : '';
  return (
    <article
      className={cx('bl-pcard', p.selected && 'is-selected')}
      style={{ position: 'relative', ...(clickable ? { cursor: 'pointer' } : {}) }}
      onClick={
        clickable
          ? (e) => {
              if ((e.target as Element).closest('button,[role=menu]')) return;
              p.onClick?.(e);
              if (p.to) go(p.to);
            }
          : undefined
      }
    >
      <div className="bl-pcard-top">
        <Badge tone={K.tone as Tone} icon={K.icon} size="sm">
          {K.label}
        </Badge>
        {p.version ? <span className="bl-pcard-ver">{p.version}</span> : null}
        <span className="bl-grow" />
        <div
          style={{ position: 'relative' }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <IconButton icon="more" label={'اقدامات ' + name} size="sm" onClick={() => setOpen(!open)} />
          {open && acts.length ? (
            <div className="bl-menu" role="menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', insetInlineEnd: 0, zIndex: 30, minWidth: 180 }}>
              {acts.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  className={cx('bl-menu-item', a.destructive && 'bl-text-error')}
                  style={{ width: '100%', cursor: 'pointer', textAlign: 'start' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setOpen(false);
                    a.onClick?.();
                    if (a.to) go(a.to);
                  }}
                >
                  {a.icon ? <Icon name={a.icon} size={16} /> : null}
                  <span className="bl-menu-label">{a.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <h3 className="bl-pcard-name">{p.name}</h3>
      {p.goal ? <p className="bl-pcard-goal">{p.goal}</p> : null}
      <dl className="bl-pcard-dl">
        {(
          [
            ['مدت', p.weeks],
            ['تکرار', p.frequency],
            ['رشته', p.sport],
          ] as const
        )
          .filter((r) => r[1])
          .map((r) => (
            <div key={r[0]}>
              <dt>{r[0]}</dt>
              <dd>{r[1]}</dd>
            </div>
          ))}
      </dl>
      <footer className="bl-pcard-foot">
        {p.assigned != null ? (
          <span className="bl-pcard-assigned">
            <Icon name="users" size={14} />
            {p.assigned}
          </span>
        ) : null}
        {p.updated ? <span className="bl-muted">{p.updated}</span> : null}
      </footer>
    </article>
  );
}

export interface Flag {
  label: ReactNode;
  tone?: Tone;
  icon?: IconRef;
}

export function AthleteCard(p: {
  name?: string;
  goal?: string;
  sport?: string;
  status?: string;
  program?: ReactNode;
  week?: ReactNode;
  workouts?: ReactNode;
  nutrition?: ReactNode;
  recovery?: ReactNode;
  flags?: Flag[];
  lastActive?: ReactNode;
}) {
  const flags = p.flags || [];
  const stats: Array<[string, ReactNode]> = [
    ['تمرین‌ها', p.workouts],
    ['تغذیه', p.nutrition],
    ['ریکاوری', p.recovery],
  ];
  return (
    <article className="bl-acard">
      <div className="bl-acard-top">
        <Avatar name={p.name} size="lg" />
        <div className="bl-grow bl-minw0">
          <h3 className="bl-acard-name">{p.name}</h3>
          <div className="bl-acard-meta">{[p.goal, p.sport].filter(Boolean).join(' · ')}</div>
        </div>
        <Badge status={p.status || 'active'} size="sm" />
      </div>
      {p.program ? (
        <div className="bl-acard-prog">
          <Icon name="clipboard" size={14} />
          <span className="bl-grow bl-minw0 bl-ellipsis">{p.program}</span>
          {p.week ? <span className="bl-muted">{p.week}</span> : null}
        </div>
      ) : (
        <div className="bl-acard-prog bl-muted">
          <Icon name="clipboard" size={14} />
          برنامه‌ای اختصاص نیافته
        </div>
      )}
      <div className="bl-acard-stats">
        {stats.map((r) => (
          <div key={r[0]}>
            <span className="bl-acard-k">{r[0]}</span>
            <span className="bl-acard-v">{r[1] != null ? r[1] : <span className="bl-nr">بدون داده</span>}</span>
          </div>
        ))}
      </div>
      {flags.length ? (
        <div className="bl-acard-flags">
          {flags.map((f, i) => (
            <Badge key={i} tone={f.tone} icon={f.icon} size="sm">
              {f.label}
            </Badge>
          ))}
        </div>
      ) : null}
      {p.lastActive ? (
        <div className="bl-acard-foot">
          {'Last active '}
          {p.lastActive}
        </div>
      ) : null}
    </article>
  );
}

export function PRCard(p: {
  exercise?: ReactNode;
  type?: string;
  date?: string;
  value?: ReactNode;
  unit?: ReactNode;
  previous?: ReactNode;
  delta?: Numeric | null;
  deltaUnit?: string;
  lowerIsBetter?: boolean;
  isNew?: boolean;
  icon?: IconRef;
  size?: 'sm' | 'md';
}) {
  const isNew = !!p.isNew;
  return (
    <article className={cx('bl-prcard', isNew && 'is-new', p.size === 'sm' && 'is-sm')}>
      <span className="bl-prcard-ic" aria-hidden="true">
        <Icon name={p.icon || 'trophy'} size={p.size === 'sm' ? 18 : 20} />
      </span>
      <div className="bl-grow bl-minw0">
        <div className="bl-prcard-top">
          <h3 className="bl-prcard-ex">{p.exercise}</h3>
          {isNew ? (
            <Badge tone="record" size="sm">
              رکورد جدید
            </Badge>
          ) : null}
        </div>
        <div className="bl-prcard-type">{[p.type, p.date].filter(Boolean).join(' · ')}</div>
        <div className="bl-prcard-val">
          {p.value}
          {p.unit ? <span className="bl-metric-unit">{p.unit}</span> : null}
        </div>
        {p.previous ? (
          <div className="bl-prcard-prev">
            <span>
              {'قبلی '}
              {p.previous}
            </span>
            {p.delta != null ? <TrendIndicator value={p.delta} unit={p.deltaUnit} goodDirection={p.lowerIsBetter ? 'down' : 'up'} size="sm" /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export interface ProgramExercise {
  name: ReactNode;
  code?: string;
  sets?: ReactNode;
  setsFrom?: ReactNode;
  load?: ReactNode;
  loadFrom?: ReactNode;
  rest?: ReactNode;
  restFrom?: ReactNode;
  rpe?: ReactNode;
  rpeFrom?: ReactNode;
  note?: ReactNode;
  selected?: boolean;
  dragging?: boolean;
  changed?: boolean;
  ghost?: boolean;
  dropBefore?: boolean;
}

function renderRx(e: ProgramExercise) {
  const out: ReactNode[] = [];
  const add = (k: string, v: ReactNode, from: ReactNode) => {
    if (!v) return;
    if (out.length)
      out.push(
        <span key={k + 's'} className="bl-sep" aria-hidden="true">
          {'·'}
        </span>,
      );
    out.push(
      from ? (
        <span key={k} className="bl-diff">
          <del>{from}</del>
          <ins>{v}</ins>
        </span>
      ) : (
        <span key={k}>{v}</span>
      ),
    );
  };
  add('s', e.sets, e.setsFrom);
  add('l', e.load, e.loadFrom);
  add('r', e.rest, e.restFrom);
  add('p', e.rpe, e.rpeFrom);
  return out;
}

export function ProgramDay(p: {
  day?: string;
  focus?: string;
  rest?: boolean;
  exercises?: ProgramExercise[];
  summary?: ReactNode;
  selected?: boolean;
  dropTarget?: boolean;
  compact?: boolean;
  readOnly?: boolean;
  onMore?: () => void;
}) {
  const ex = p.exercises || [];
  const rest = !!p.rest;
  return (
    <section
      className={cx('bl-pday', p.selected && 'is-selected', rest && 'is-rest', p.dropTarget && 'is-drop', p.compact && 'is-compact')}
      aria-label={p.day + (rest ? '، روز استراحت' : '، ' + (p.focus || ''))}
    >
      <header className="bl-pday-head">
        <div className="bl-grow bl-minw0">
          <div className="bl-pday-day">{p.day}</div>
          <div className="bl-pday-focus">{rest ? 'استراحت' : p.focus || 'روز بدون عنوان'}</div>
        </div>
        {p.readOnly ? null : <IconButton icon="more" label={'اقدامات ' + p.day} size="sm" onClick={p.onMore} />}
      </header>
      {rest ? (
        <div className="bl-pday-rest">
          <Icon name="moon" size={18} />
          <span>روز استراحت</span>
          {p.readOnly ? null : <span className="bl-muted bl-small">یک حرکت اینجا رها کنید تا روز تمرین شود</span>}
        </div>
      ) : (
        <ol className="bl-pday-list">
          {ex.map((e, i) => (
            <li key={i} className={cx('bl-pex', e.selected && 'is-selected', e.dragging && 'is-dragging', e.changed && 'is-changed', e.ghost && 'is-ghost')}>
              {e.dropBefore ? <span className="bl-drop-line" aria-hidden="true" /> : null}
              {p.readOnly ? null : (
                <span className="bl-grip" aria-hidden="true">
                  <Icon name="grip" size={14} />
                </span>
              )}
              <div className="bl-grow bl-minw0">
                <div className="bl-pex-name">
                  <span className="bl-pex-idx">{e.code || String.fromCharCode(65 + i)}</span>
                  <span className="bl-ellipsis">{e.name}</span>
                </div>
                <div className="bl-pex-rx">{renderRx(e)}</div>
                {e.note ? (
                  <div className="bl-pex-note">
                    <Icon name="file-text" size={12} />
                    {e.note}
                  </div>
                ) : null}
                {e.changed ? (
                  <div className="bl-pex-chg">
                    <Icon name="git-branch" size={12} />
                    فقط برای این ورزشکار تغییر کرده
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {!rest && !p.readOnly ? (
        <button type="button" className="bl-pday-add">
          <Icon name="plus" size={14} />
          افزودن حرکت
        </button>
      ) : null}
      {p.summary ? <footer className="bl-pday-foot">{p.summary}</footer> : null}
    </section>
  );
}

export function SetRow(p: {
  header?: boolean;
  index?: ReactNode;
  state?: 'pending' | 'active' | 'done' | 'skipped';
  unit?: string;
  previous?: ReactNode;
  weight?: string;
  weightPlaceholder?: string;
  reps?: string;
  repsPlaceholder?: string;
  isPR?: boolean;
  onWeight?: (v: string) => void;
  onReps?: (v: string) => void;
  onToggle?: () => void;
}) {
  if (p.header)
    return (
      <div className="bl-setrow is-header" aria-hidden="true">
        <span>ست</span>
        <span>قبلی</span>
        <span>{p.unit || 'kg'}</span>
        <span>تکرار</span>
        <span>انجام شد</span>
      </div>
    );
  const st = p.state || 'pending';
  const unit = p.unit || 'kg';
  const dis = st === 'skipped';
  return (
    <div className={cx('bl-setrow', 'is-' + st)} role="group" aria-label={'Set ' + p.index + (st === 'done' ? ', completed' : st === 'skipped' ? ', skipped' : '')}>
      <span className="bl-setrow-n">{p.index}</span>
      <span className="bl-setrow-prev">{p.previous || '—'}</span>
      <div className="bl-setrow-in">
        <input
          className="bl-setrow-input"
          inputMode="decimal"
          aria-label={'Weight in ' + unit}
          defaultValue={p.weight}
          placeholder={p.weightPlaceholder}
          disabled={dis || undefined}
          onChange={p.onWeight ? (e) => p.onWeight?.(e.target.value) : undefined}
        />
      </div>
      <div className="bl-setrow-in">
        <input
          className="bl-setrow-input"
          inputMode="numeric"
          aria-label="تکرار"
          defaultValue={p.reps}
          placeholder={p.repsPlaceholder}
          disabled={dis || undefined}
          onChange={p.onReps ? (e) => p.onReps?.(e.target.value) : undefined}
        />
      </div>
      <button
        type="button"
        className={cx('bl-setrow-done', st === 'done' && 'is-on')}
        aria-pressed={st === 'done'}
        aria-label={st === 'done' ? 'انجام شد، برای بازگردانی بزنید' : 'ثبت ست ' + p.index}
        disabled={dis || undefined}
        onClick={p.onToggle}
      >
        <Icon name={dis ? 'minus' : 'check'} size={20} stroke={2.25} />
      </button>
      {p.isPR ? (
        <span className="bl-setrow-pr">
          <Icon name="trophy" size={12} stroke={2} />
          رکورد
        </span>
      ) : null}
    </div>
  );
}

const ATTN = {
  missed: { tone: 'error', icon: 'x-circle' },
  down: { tone: 'warning', icon: 'trend-down' },
  pr: { tone: 'record', icon: 'trophy' },
  soreness: { tone: 'warning', icon: 'activity' },
  nutrition: { tone: 'warning', icon: 'utensils' },
  info: { tone: 'info', icon: 'info' },
} as const;

export function AttentionItem(p: {
  kind?: keyof typeof ATTN | (string & {});
  name?: string;
  reason?: ReactNode;
  detail?: ReactNode;
  time?: ReactNode;
  actionLabel?: ReactNode;
  to?: string;
  onAction?: () => void;
}) {
  const K = ATTN[(p.kind || 'info') as keyof typeof ATTN] || ATTN.info;
  return (
    <div className="bl-attn">
      <Avatar name={p.name} size="md" />
      <div className="bl-grow bl-minw0">
        <div className="bl-attn-top">
          <span className="bl-attn-name">{p.name}</span>
          <Badge tone={K.tone} icon={K.icon} size="sm">
            {p.reason}
          </Badge>
        </div>
        <div className="bl-attn-detail">{p.detail}</div>
      </div>
      {p.time ? <span className="bl-attn-time">{p.time}</span> : null}
      <Button variant="secondary" size="sm" to={p.to} onClick={p.onAction}>
        {p.actionLabel || 'مشاهده'}
      </Button>
    </div>
  );
}

const MEAL = {
  followed: { tone: 'success', icon: 'check-circle', label: 'رعایت شد' },
  partial: { tone: 'warning', icon: 'circle-half', label: 'تا حدی رعایت شد' },
  skipped: { tone: 'error', icon: 'x-circle', label: 'رعایت نشد' },
  unlogged: { tone: 'neutral', icon: 'circle', label: 'ثبت نشده' },
} as const;

export function MealCard(p: {
  meal?: string;
  time?: ReactNode;
  items?: ReactNode;
  macros?: ReactNode;
  status?: keyof typeof MEAL;
  editable?: boolean;
  onChange?: (v: string) => void;
}) {
  const st = p.status || 'unlogged';
  const M = MEAL[st];
  return (
    <article className="bl-meal">
      <header className="bl-meal-head">
        <div className="bl-grow bl-minw0">
          <h3 className="bl-meal-name">{p.meal}</h3>
          {p.time ? <span className="bl-meal-time">{p.time}</span> : null}
        </div>
        {!p.editable ? (
          <Badge tone={M.tone} icon={M.icon} size="sm">
            {M.label}
          </Badge>
        ) : null}
      </header>
      <p className="bl-meal-items">{p.items}</p>
      {p.macros ? <div className="bl-meal-macros">{p.macros}</div> : null}
      {p.editable ? (
        <SegmentedControl
          options={[
            { value: 'followed', label: 'رعایت شد' },
            { value: 'partial', label: 'تا حدی' },
            { value: 'skipped', label: 'رد شد' },
          ]}
          value={st === 'unlogged' ? null : st}
          size="md"
          fullWidth
          label={'Did you follow ' + p.meal + '?'}
          onChange={p.onChange}
        />
      ) : null}
    </article>
  );
}

export function MacroSummary(p: { items?: Array<{ label: ReactNode; value?: Numeric | null; target?: Numeric; unit?: string }>; layout?: 'list' | 'grid' }) {
  return (
    <div className={cx('bl-macros', p.layout === 'grid' && 'is-grid')}>
      {(p.items || []).map((r, i) => {
        const v = r.value == null ? null : num(r.value, 0);
        const t = num(r.target, 1);
        return (
          <div key={i} className="bl-macro">
            <div className="bl-macro-head">
              <span className="bl-macro-label">{r.label}</span>
              <span className="bl-macro-val">
                {v == null ? (
                  <span className="bl-nr">ثبت نشده</span>
                ) : (
                  <>
                    {fmt(v, 1)}
                    <span className="bl-muted">{' / ' + fmt(t, 1) + ' ' + (r.unit || '')}</span>
                  </>
                )}
              </span>
            </div>
            <div
              className="bl-pbar-track"
              role="progressbar"
              aria-label={typeof r.label === 'string' ? r.label : undefined}
              aria-valuenow={v == null ? undefined : v}
              aria-valuemax={t}
              aria-valuemin={0}
            >
              {v != null ? <div className="bl-pbar-fill" style={{ width: Math.min(100, (v / t) * 100) + '%' }} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
