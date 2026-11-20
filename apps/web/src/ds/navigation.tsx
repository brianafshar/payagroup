import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useCoachBrand, useLiveAthleteCount, useNotifications, useSearch, type Notification, type SearchHit } from '@/data/panel';
import { useSessionUser } from '@/data/session';
import { logout } from '@/data/session';
import { faDigits, faLastSeen } from '@/lib/format';
import { useSupportEmail } from '@/app/public/usePublicInfo';
import { openGuide } from '@/lib/guide';
import { go, href, navigate } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { setNavOpen, useMedia } from '@/lib/navDrawer';
import { IconButton } from './actions';
import { Badge } from './data';
import { SearchField } from './forms';
import { Icon, type IconName } from './Icon';
import { Avatar, BrandMark } from './identity';
import { ThemeToggle } from './ThemeToggle';
import { cx, fmt, num, useSynced, type Numeric } from './utils';
import type { Tone } from './status';

type IconRef = IconName | (string & {});
type NavItem = { id: string; label: string; icon: IconName; locked?: boolean };

const NAV: Record<'coach' | 'coachFoot' | 'admin' | 'adminFoot', NavItem[]> = {
  coach: [
    { id: 'dashboard', label: 'داشبورد', icon: 'dashboard' },
    { id: 'athletes', label: 'ورزشکاران', icon: 'users' },
    { id: 'programs', label: 'برنامه‌ها', icon: 'clipboard' },
    { id: 'attendance', label: 'حضور و غیاب', icon: 'check-circle' },
    { id: 'library', label: 'کتابخانه حرکات', icon: 'library' },
    { id: 'nutrition', label: 'تغذیه', icon: 'utensils' },
    { id: 'recovery', label: 'ریکاوری', icon: 'moon' },
    { id: 'analytics', label: 'تحلیل‌ها', icon: 'progress' },
  ],
  coachFoot: [{ id: 'settings', label: 'تنظیمات', icon: 'settings' }],
  admin: [
    { id: 'dashboard', label: 'نمای کلی', icon: 'dashboard' },
    { id: 'coaches', label: 'مربیان', icon: 'building' },
    { id: 'athletes', label: 'ورزشکاران', icon: 'users' },
    { id: 'activity', label: 'فعالیت کاربران', icon: 'activity' },
    { id: 'branding', label: 'برندینگ', icon: 'palette' },
    { id: 'access', label: 'دسترسی و نقش‌ها', icon: 'key' },
  ],
  adminFoot: [{ id: 'settings', label: 'تنظیمات', icon: 'settings' }],
};

const RAIL_KEY = 'bl-sidebar-rail';

export interface SidebarProps {
  app?: 'coach' | 'admin';
  active?: string;
  counts?: Record<string, ReactNode>;
  user?: { name: string; role: string };
  brandName?: string;
  brandInitials?: string;
  brandSub?: string;
  brandSrc?: string;
  /** Force a state (e.g. in reference boards); otherwise persisted in localStorage. */
  collapsed?: boolean | null;
}

/** Collapsible sidebar; collapses to a 72px icon rail, state persisted in `localStorage('bl-sidebar-rail')`. */
export function Sidebar(p: SidebarProps) {
  const app = p.app || 'coach';
  const liveCount = useLiveAthleteCount(app === 'coach');
  const brand = useCoachBrand();
  if (brand) p = { ...p, brandName: brand.appName, brandInitials: brand.initials };
  const counts: Record<string, ReactNode> = liveCount != null ? { ...p.counts, athletes: faDigits(liveCount) } : { ...p.counts };
  const fixed = p.collapsed !== undefined && p.collapsed !== null;
  const narrow = useMedia();
  const [railPref, setRail] = useState<boolean>(() => {
    if (fixed) return !!p.collapsed;
    try {
      return localStorage.getItem(RAIL_KEY) === '1';
    } catch {
      return false;
    }
  });
  // On a phone the sidebar is a full-width drawer: never the icon rail, and its button closes it.
  const rail = railPref && !narrow;
  const toggle = () => {
    if (narrow) return setNavOpen(false);
    const v = !rail;
    setRail(v);
    if (!fixed) {
      try {
        localStorage.setItem(RAIL_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  };
  const me = useSessionUser();
  const u = p.user || (app === 'admin' ? { name: 'Sina Tavakoli', role: 'مدیر ارشد' } : { name: 'Ali Ahmadi', role: 'سرمربی' });
  const item = (it: NavItem) => {
    const on = it.id === p.active;
    return (
      <li key={it.id}>
        <a
          href={it.locked ? '#' : href(app + ':' + it.id)}
          className={cx('bl-nav-item', on && 'is-on', it.locked && 'is-locked')}
          aria-current={on ? 'page' : undefined}
          title={rail ? it.label : undefined}
        >
          <Icon name={it.icon} size={18} />
          <span className={rail ? 'bl-sr' : 'bl-nav-label'}>
            {it.label}
            {it.locked && rail ? ' (coming soon)' : ''}
          </span>
          {rail && it.locked ? (
            <span className="bl-nav-raillock" aria-hidden="true">
              <Icon name="lock" size={10} stroke={2.5} />
            </span>
          ) : null}
          {!rail && it.locked ? (
            <span className="bl-nav-soon">
              <Icon name="lock" size={12} stroke={2} />
              به‌زودی
            </span>
          ) : null}
          {!rail && counts[it.id] != null ? <span className="bl-nav-count">{counts[it.id]}</span> : null}
        </a>
      </li>
    );
  };
  return (
    <nav
      className={cx('bl-sidebar', rail && 'is-rail')}
      aria-label="Main"
      onClick={(e) => {
        if (narrow && (e.target as Element).closest?.('a[href]')) setNavOpen(false);
      }}
    >
      <div className="bl-sidebar-brand">
        <div className="bl-grow bl-minw0">
          <BrandMark
            name={p.brandName || 'PAYA Group'}
            initials={p.brandInitials || 'PG'}
            sub={p.brandSub || (app === 'admin' ? 'مدیریت پلتفرم' : 'فضای کاری مربی')}
            variant={rail ? 'mark' : 'full'}
            src={p.brandSrc || '/brand/paya-app-icon-orange.svg'}
            size="sm"
          />
        </div>
        <button
          type="button"
          className="bl-sidebar-toggle"
          onClick={toggle}
          aria-label={narrow ? 'بستن منو' : rail ? 'باز کردن منو' : 'جمع کردن منو'}
          title={narrow ? 'بستن منو' : rail ? 'باز کردن منو' : 'جمع کردن منو'}
          aria-expanded={!rail}
        >
          <Icon name={narrow ? 'x' : rail ? 'chevron-left' : 'chevron-right'} size={16} />
        </button>
      </div>
      <ul className="bl-nav-list">{[...NAV[app], ...(app === 'coach' && me?.isHeadCoach ? [{ id: 'team', label: 'تیم مربیان', icon: 'users' as IconName }] : [])].map(item)}</ul>
      <div className="bl-grow" />
      <ul className="bl-nav-list">{NAV[app === 'admin' ? 'adminFoot' : 'coachFoot'].map(item)}</ul>
      <div className="bl-sidebar-user">
        <Avatar name={u.name} size="sm" current />
        {rail ? null : (
          <div className="bl-minw0 bl-grow">
            <div className="bl-sidebar-uname">{u.name}</div>
            <div className="bl-sidebar-urole">{u.role}</div>
          </div>
        )}
        {rail ? null : (
          <IconButton
            icon="log-out"
            label="خروج"
            size="sm"
            onClick={() => {
              void logout();
              go(app === 'coach' ? 'coach:login' : 'login');
            }}
          />
        )}
      </div>
    </nav>
  );
}

export type Crumb = ReactNode | { label: ReactNode; to?: string };

function isCrumbObj(t: Crumb): t is { label: ReactNode; to?: string } {
  return !!t && typeof t === 'object' && 'label' in (t as object);
}

export function Breadcrumbs({ items }: { items?: Crumb[] }) {
  const list = items || [];
  return (
    <nav className="bl-crumbs" aria-label="Breadcrumb">
      <ol>
        {list.map((t, i) => {
          const last = i === list.length - 1;
          const label = isCrumbObj(t) ? t.label : t;
          return (
            <li key={i}>
              {last ? <span aria-current="page">{label}</span> : <a href={isCrumbObj(t) && t.to ? href(t.to) : '#'}>{label}</a>}
              {last ? null : <Icon name="chevron-right" size={14} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type SearchEntry = { g?: string; t: string; s?: string; to?: string; ic?: IconRef; act?: () => void };

/** Pages matched by the top-bar search (records come from the API — `useSearch`). */
const ADMIN_PAGES: SearchEntry[] = [
  { g: 'صفحه', t: 'داشبورد', to: 'admin:dashboard', ic: 'dashboard' },
  { g: 'صفحه', t: 'مربیان', to: 'admin:coaches', ic: 'users' },
  { g: 'صفحه', t: 'ساخت مربی', to: 'admin:create-coach', ic: 'plus' },
  { g: 'صفحه', t: 'ورزشکاران', to: 'admin:athletes', ic: 'users' },
  { g: 'صفحه', t: 'دسترسی‌ها', to: 'admin:access', ic: 'shield' },
  { g: 'صفحه', t: 'فعالیت کاربران', to: 'admin:activity', ic: 'activity' },
];
const COACH_PAGES: SearchEntry[] = [
  { g: 'صفحه', t: 'داشبورد', to: 'coach:dashboard', ic: 'dashboard' },
  { g: 'صفحه', t: 'ورزشکاران', to: 'coach:athletes', ic: 'users' },
  { g: 'صفحه', t: 'کتابخانه حرکات', to: 'coach:library', ic: 'dumbbell' },
  { g: 'صفحه', t: 'برنامه‌ها', to: 'coach:programs', ic: 'clipboard' },
  { g: 'صفحه', t: 'تحلیل‌ها', to: 'coach:analytics', ic: 'trend-up' },
  { g: 'صفحه', t: 'ترکیب بدن', to: 'coach:body', ic: 'ruler' },
  { g: 'صفحه', t: 'رکوردهای شخصی', to: 'coach:records', ic: 'trophy' },
  { g: 'صفحه', t: 'تنظیمات', to: 'coach:settings', ic: 'settings' },
];

const CAT_FA: Record<string, string> = { chest: 'سینه', back: 'پشت', legs: 'پا', arms: 'بازو', shoulders: 'سرشانه', conditioning: 'آمادگی هوازی', power: 'توان' };
const EQUIP_FA: Record<string, string> = { barbell: 'هالتر', dumbbell: 'دمبل', cable: 'کابل', bodyweight: 'وزن بدن', machine: 'دستگاه', box: 'جعبه پرش' };

function hitEntry(h: SearchHit, admin: boolean): SearchEntry {
  switch (h.kind) {
    case 'coach':
      return { g: 'مربی', t: h.title, s: h.subtitle, to: 'admin:coach?id=' + h.id, ic: 'user' };
    case 'athlete':
      return { g: 'ورزشکار', t: h.title, s: admin ? 'مربی: ' + h.subtitle : h.subtitle || 'بدون برنامه', to: admin ? 'admin:athletes' : 'coach:athlete?id=' + h.id, ic: 'user' };
    case 'program':
      return { g: 'برنامه', t: h.title, s: h.sessionsPerWeek ? faDigits(h.sessionsPerWeek) + ' روز در هفته' : h.subtitle, to: 'coach:program?id=' + h.id, ic: 'clipboard' };
    default:
      return { g: 'حرکت', t: h.title, s: [CAT_FA[h.category || ''], EQUIP_FA[h.equipment || '']].filter(Boolean).join(' · '), to: 'coach:exercise?id=' + h.id, ic: 'dumbbell' };
  }
}

const fa1 = (n?: number) => faDigits(String(Math.round((n ?? 0) * 10) / 10)).replace('.', '٫');

function notifEntry(n: Notification): SearchEntry {
  const s = faLastSeen(n.at, new Date(), false);
  switch (n.kind) {
    case 'pr':
      return { t: n.athleteName + ' رکورد جدید ' + n.exercise + ' زد · ' + fa1(n.value) + ' ' + (n.unit || ''), s, to: 'coach:records?id=' + n.athleteId };
    case 'soreness':
      return { t: n.athleteName + ' کوفتگی ' + faDigits(n.value ?? 0) + ' از ۱۰ گزارش کرد', s, to: 'coach:recovery-analytics?id=' + n.athleteId };
    case 'message':
      return { t: 'پیام جدید از ' + n.athleteName, s: n.text ? s + ' · ' + n.text : s, to: 'coach:chat?a=' + n.athleteId };
    case 'measurement':
      return { t: n.athleteName + ' اندازه‌گیری جدید ثبت کرد', s, to: 'coach:body?id=' + n.athleteId };
    case 'coach.invite_pending':
      return { t: n.coachName + ' دعوت را هنوز نپذیرفته', s, to: 'admin:coach?id=' + n.coachId };
    case 'coach.cap':
      return { t: 'سهمیه ورزشکاران ' + n.coachName + ' به ' + faDigits(n.value ?? 0) + '٪ رسید', s, to: 'admin:coach?id=' + n.coachId };
    case 'coach.renewal_request':
      return { t: n.coachName + ' درخواست تمدید حساب داد', s: n.value != null ? s + ' · ' + faDigits(n.value) + ' روز مانده' : s, to: 'admin:coach?id=' + n.coachId };
    case 'coach.expiring':
      return { t: 'حساب ' + n.coachName + ' تا ' + faDigits(n.value ?? 0) + ' روز دیگر منقضی می‌شود', s, to: 'admin:coach?id=' + n.coachId };
    default:
      return { t: n.kind, s };
  }
}

const popStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  insetInlineEnd: 0,
  width: 340,
  maxHeight: 420,
  overflowY: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 12px 32px rgba(0,0,0,.14)',
  zIndex: 50,
  padding: 6,
  textAlign: 'start',
};

export interface TopBarProps {
  breadcrumbs?: Crumb[];
  /** Show the global search (default true). */
  search?: boolean;
  searchPlaceholder?: string;
  unread?: boolean;
  /** Which panel's search pages to show; inferred from the URL when omitted. */
  app?: 'admin' | 'coach';
  children?: ReactNode;
}

/** Top bar: breadcrumbs, global search (`/` to focus), help, notifications and the light/dark toggle. */
export function TopBar(p: TopBarProps) {
  const showSearch = p.search === undefined || p.search;
  const isAdmin = p.app ? p.app === 'admin' : window.location.pathname.startsWith('/admin');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<null | 'search' | 'help' | 'notif'>(null);
  const [inputKey, setKey] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(tag)) {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('.bl-topbar-search input');
        el?.focus();
      }
      if (e.key === 'Escape') setOpen(null);
    };
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || !t.closest || !t.closest('.bl-topbar-pop, .bl-topbar-anchor')) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);
  const term = q.trim();
  const signedIn = !!useSessionUser();
  const found = useSearch(signedIn ? term : '');
  const pages = (isAdmin ? ADMIN_PAGES : COACH_PAGES).filter((x) => term && x.t.indexOf(term) > -1);
  const hits = [...found.map((h) => hitEntry(h, isAdmin)), ...pages].slice(0, 10);
  const notif = useNotifications(signedIn);
  // Read notifications drop out of the panel; they don't come back after a refresh.
  const fresh = notif.items.filter((x) => x.unread);
  const NOTIF = fresh.map(notifEntry);
  const read = notif.unread === 0;
  const supportEmail = useSupportEmail(open === 'help');
  const HELP: SearchEntry[] = [
    { t: 'کلید / برای جستجو', s: 'از هر صفحه‌ای' },
    isAdmin ? { t: 'راهنمای شروع', s: 'ساخت اولین مربی', to: 'admin:create-coach' } : { t: 'راهنمای شروع قدم‌به‌قدم', s: 'از کجا شروع کنم و به چه می‌رسم', act: openGuide },
    { t: 'راهنما و سؤالات رایج', s: 'شروع کار برای مربی و شاگرد', act: () => navigate('/help') },
    { t: 'تماس با پشتیبانی', s: supportEmail || 'ایمیل پشتیبانی', act: () => supportEmail && window.location.assign('mailto:' + supportEmail) },
    { t: 'حریم خصوصی', s: 'چه اطلاعاتی نگه می‌داریم', act: () => navigate('/privacy') },
  ];
  const pick = (x: SearchEntry) => {
    setOpen(null);
    setQ('');
    setKey(inputKey + 1);
    if (x.act) x.act();
    else if (x.to) go(x.to);
  };
  const row = (x: SearchEntry, i: number, hl?: boolean) => (
    <button
      key={i}
      type="button"
      onClick={() => pick(x)}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        width: '100%',
        padding: '8px 10px',
        border: 0,
        borderRadius: 8,
        background: hl ? 'var(--surface-sunken)' : 'transparent',
        cursor: x.to || x.act ? 'pointer' : 'default',
        font: 'inherit',
        color: 'var(--text-primary)',
        textAlign: 'start',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-sunken)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = hl ? 'var(--surface-sunken)' : 'transparent')}
    >
      {x.ic ? <Icon name={x.ic} size={16} /> : null}
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13, lineHeight: '20px', fontWeight: 500 }}>{x.t}</span>
        {x.s ? <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)' }}>{x.s}</span> : null}
      </span>
      {x.g ? <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{x.g}</span> : null}
    </button>
  );
  const head = (t: string, extra?: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
      <span style={{ flex: 1 }}>{t}</span>
      {extra || null}
    </div>
  );
  return (
    <header className="bl-topbar">
      <span className="bl-topbar-menu">
        <IconButton icon="list" label="منو" onClick={() => setNavOpen(true)} />
      </span>
      {(p.breadcrumbs || []).length ? <Breadcrumbs items={p.breadcrumbs} /> : <span />}
      <div className="bl-grow" />
      {showSearch ? (
        <div
          className="bl-topbar-search bl-topbar-anchor"
          style={{ position: 'relative' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits[0]) pick(hits[0]);
          }}
        >
          <SearchField
            key={inputKey}
            placeholder={p.searchPlaceholder || (isAdmin ? 'جستجوی مربی یا صفحه' : 'جستجوی ورزشکار، برنامه، حرکت')}
            shortcut="/"
            size="sm"
            onChange={(v) => {
              setQ(v);
              setOpen(v.trim() ? 'search' : null);
            }}
          />
          {open === 'search' && term ? (
            <div className="bl-topbar-pop" style={popStyle}>
              {hits.length ? (
                hits.map((x, i) => row(x, i, i === 0))
              ) : (
                <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text-muted)' }}>{'نتیجه‌ای برای «' + term + '» پیدا نشد.'}</div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="bl-topbar-anchor bl-topbar-help" style={{ position: 'relative' }}>
        <IconButton icon="help" label="راهنما" onClick={() => setOpen(open === 'help' ? null : 'help')} />
        {open === 'help' ? (
          <div className="bl-topbar-pop" style={{ ...popStyle, width: 280 }}>
            {head('راهنما')}
            {HELP.map((x, i) => row(x, i))}
          </div>
        ) : null}
      </div>
      <div className="bl-topbar-anchor" style={{ position: 'relative' }}>
        <IconButton icon="bell" label="اعلان‌ها" badge={!read} onClick={() => setOpen(open === 'notif' ? null : 'notif')} />
        {open === 'notif' ? (
          <div className="bl-topbar-pop" style={popStyle}>
            {head(
              'اعلان‌ها',
              read ? null : (
                <button
                  type="button"
                  onClick={notif.markRead}
                  style={{ border: 0, background: 'none', color: 'var(--brand-primary-text)', font: 'inherit', fontSize: 12, cursor: 'pointer' }}
                >
                  علامت خوانده‌شده
                </button>
              ),
            )}
            {NOTIF.length ? null : <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text-muted)' }}>اعلان تازه‌ای ندارید.</div>}
            {NOTIF.map((x, i) => (
              <div key={fresh[i].kind + fresh[i].at + i} style={{ position: 'relative' }}>
                {row(x, i)}
                <span style={{ position: 'absolute', insetInlineEnd: 10, top: 14, width: 6, height: 6, borderRadius: 3, background: 'var(--brand-primary)' }} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <ThemeToggle />
      {p.children || null}
    </header>
  );
}

export interface PageBadge {
  label?: ReactNode;
  tone?: Tone;
  icon?: IconRef;
  status?: string;
}

export function PageHeader(p: { title?: ReactNode; subtitle?: ReactNode; back?: ReactNode; backTo?: string; avatar?: string; badges?: PageBadge[]; children?: ReactNode }) {
  return (
    <div className="bl-pagehead">
      {p.back ? (
        <a href={p.backTo ? href(p.backTo) : '#'} className="bl-back">
          <Icon name="arrow-left" size={16} />
          {p.back}
        </a>
      ) : null}
      <div className="bl-pagehead-row">
        {p.avatar ? <Avatar name={p.avatar} size="xl" /> : null}
        <div className="bl-grow bl-minw0">
          <div className="bl-pagehead-titlerow">
            <h1 className="bl-pagehead-title">{p.title}</h1>
            {(p.badges || []).map((b, i) => (
              <Badge key={i} tone={b.tone} icon={b.icon} status={b.status} size="sm">
                {b.label}
              </Badge>
            ))}
          </div>
          {p.subtitle ? <p className="bl-pagehead-sub">{p.subtitle}</p> : null}
        </div>
        {p.children ? <div className="bl-pagehead-actions">{p.children}</div> : null}
      </div>
    </div>
  );
}

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: IconRef;
  count?: ReactNode;
  locked?: boolean;
  disabled?: boolean;
  demoState?: string;
}

/** Tabs. Returning `false` from `onChange` cancels the switch (e.g. unsaved changes). */
export function Tabs(p: { tabs?: Array<TabItem | string>; value?: string; variant?: 'line' | 'pill' | (string & {}); label?: string; onChange?: (id: string) => boolean | void }) {
  const tabs: TabItem[] = (p.tabs || []).map((t) => (typeof t === 'string' ? { id: t, label: t } : t));
  const [cur, setCur] = useSynced(p.value || (tabs[0] && tabs[0].id));
  return (
    <div className={cx('bl-tabs', 'bl-tabs-' + (p.variant || 'line'))} role="tablist" aria-label={p.label}>
      {tabs.map((t) => {
        const on = t.id === cur;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={cx('bl-tab', on && 'is-on', t.locked && 'is-locked', t.demoState && 'is-' + t.demoState)}
            disabled={t.disabled || undefined}
            onClick={() => {
              if (p.onChange && p.onChange(t.id) === false) return;
              setCur(t.id);
            }}
          >
            {t.icon ? <Icon name={t.icon} size={16} /> : null}
            {t.label}
            {t.count != null ? <span className="bl-tab-count">{t.count}</span> : null}
            {t.locked ? <Icon name="lock" size={12} stroke={2} label="coming soon" /> : null}
          </button>
        );
      })}
    </div>
  );
}

const TABS: Array<{ id: string; label: string; icon: IconName }> = [
  { id: 'home', label: 'خانه', icon: 'home' },
  { id: 'workout', label: 'تمرین', icon: 'dumbbell' },
  { id: 'nutrition', label: 'تغذیه', icon: 'utensils' },
  { id: 'recovery', label: 'ریکاوری', icon: 'moon' },
  { id: 'progress', label: 'پیشرفت', icon: 'progress' },
  { id: 'profile', label: 'پروفایل', icon: 'user' },
];

/** Athlete-app bottom navigation (used by the responsive reference boards). */
export function BottomNav(p: { active?: string; routes?: Record<string, string> | null; onChange?: (id: string) => void }) {
  const [cur, setCur] = useState(p.active || 'home');
  const rts = p.routes;
  return (
    <nav className="bl-bnav" aria-label="Main">
      {TABS.map((t) => {
        const on = t.id === cur;
        return (
          <a
            key={t.id}
            href={rts && rts[t.id] ? href(rts[t.id]) : '#'}
            onClick={(e) => {
              if (!(rts && rts[t.id])) {
                e.preventDefault();
                setCur(t.id);
                p.onChange?.(t.id);
              }
            }}
            className={cx('bl-bnav-item', on && 'is-on')}
            aria-current={on ? 'page' : undefined}
          >
            <span className="bl-bnav-pill">
              <Icon name={t.icon} size={22} />
            </span>
            <span className="bl-bnav-label">{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

export interface MobileAction {
  icon: IconRef;
  label: string;
  to?: string;
  locked?: boolean;
  dot?: boolean;
  onClick?: () => void;
}

export function MobileHeader(p: {
  title?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  back?: ReactNode;
  backTo?: string;
  backIcon?: IconRef;
  onBack?: () => void;
  brand?: string;
  brandInitials?: string;
  brandSrc?: string;
  actions?: MobileAction[];
  large?: boolean;
  sheet?: boolean;
}) {
  const acts = p.actions || [];
  const large = !!p.large;
  return (
    <header className={cx('bl-mhead', large && 'is-large', p.sheet && 'is-sheet')}>
      <div className="bl-mhead-bar">
        {p.back ? (
          <a
            href={p.backTo ? href(p.backTo) : '#'}
            onClick={(e) => {
              if (p.onBack) {
                e.preventDefault();
                p.onBack();
              } else if (!p.backTo) {
                e.preventDefault();
                history.back();
              }
            }}
            className="bl-mhead-back"
          >
            <Icon name={p.backIcon || 'chevron-right'} size={24} />
            <span>{p.back}</span>
          </a>
        ) : p.brand ? (
          <BrandMark name={p.brand} initials={p.brandInitials} src={p.brandSrc} size="sm" />
        ) : null}
        {!large && p.title ? <h1 className="bl-mhead-title">{p.title}</h1> : <span className="bl-grow" />}
        <div className="bl-mhead-actions">
          {acts.map((a, i) => (
            <button
              key={i}
              type="button"
              title={a.label}
              onClick={() => {
                if (a.onClick) a.onClick();
                else if (a.to) go(a.to);
              }}
              className="bl-mhead-act"
              aria-label={a.label + (a.locked ? ' (coming soon)' : '')}
            >
              <Icon name={a.icon} size={22} />
              {a.locked ? (
                <span className="bl-mhead-lock">
                  <Icon name="lock" size={10} stroke={2.5} />
                </span>
              ) : null}
              {a.dot ? <span className="bl-iconbtn-dot" /> : null}
            </button>
          ))}
        </div>
      </div>
      {large ? (
        <div className="bl-mhead-large">
          {p.eyebrow ? <div className="bl-mhead-eyebrow">{p.eyebrow}</div> : null}
          <h1 className="bl-mhead-ltitle">{p.title}</h1>
          {p.subtitle ? <p className="bl-mhead-sub">{p.subtitle}</p> : null}
        </div>
      ) : null}
    </header>
  );
}

export function StepIndicator(p: { steps?: ReactNode[]; current?: Numeric }) {
  const steps = p.steps || [];
  const cur = num(p.current, 1);
  return (
    <ol className="bl-steps" aria-label="پیشرفت">
      {steps.map((s, i) => {
        const n = i + 1;
        const st = n < cur ? 'done' : n === cur ? 'current' : 'todo';
        return (
          <li key={i} className={'bl-step is-' + st} aria-current={st === 'current' ? 'step' : undefined}>
            <span className="bl-step-n">{st === 'done' ? <Icon name="check" size={14} stroke={2.5} /> : fmt(n)}</span>
            <span className="bl-step-label">
              {s}
              {st === 'done' ? <span className="bl-sr"> (انجام شد)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
