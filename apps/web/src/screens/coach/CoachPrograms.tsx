// Ported from design handoff: project/C17 Coach Programs.dc.html
import { Fragment } from 'react';
import { SPORT_LABEL } from '@/data/exercises';
import { DAY_TIMES } from '@/lib/programs';
import { Badge, Button, EmptyState, PageHeader, ProgramCard, SearchField, Select, Sidebar, Tabs, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { deleteProgram } from '@/lib/deletions';
import { toast } from '@/lib/toast';
import { api, faError, remote } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { faDayMonth, faDigits } from '@/lib/format';
import { panelUser } from '@/data/session';
import { clearDraft, draftAge, readDraft } from '@/lib/builderDraft';
import { go } from '@/lib/nav';
import { Screen, type ScreenState } from '../Screen';

const GOAL_KEY: Record<string, string> = { عضله‌سازی: 'gain', 'کاهش چربی': 'loss', قدرت: 'str', 'آمادگی عمومی': 'gen' };

/** Data container: every program of the coach (templates, athlete copies, archived). */
export default function CoachProgramsPage(props: { brand?: string }) {
  const programs = useQuery('programs-all', remote.allPrograms);
  const wait = pending(programs);
  if (wait) return wait;
  return <CoachPrograms {...props} programs={programs.data} />;
}

class CoachPrograms extends Screen {
  state: ScreenState = { tab: 't', q: '', goal: 'all' };

  /** API programs → the design's list items. */
  liveList() {
    return this.props.programs.map((p) => {
      const tpl = p.kind === 'template';
      // The list response has no week tree, only how many exercises are planned.
      const empty = p.weeks?.length ? !p.weeks.some((w) => w.days.some((d) => d.exercises.length)) : !p.exerciseCount;
      return {
        id: p.id,
        name: tpl ? p.name : p.name + ' · ' + (p.athleteName || ''),
        goal: p.goal || (tpl ? 'قالب' : 'نسخه اختصاصی'),
        g: GOAL_KEY[p.goal || ''] || 'gen',
        kind: p.kind,
        sport: p.sport,
        timeLabel: (DAY_TIMES.find(([k]) => k && k === p.time) || [])[1] || '',
        version: tpl ? 'v' + faDigits(p.version) : 'از v' + faDigits(p.version),
        weeks: faDigits(p.durationWeeks) + ' هفته',
        freq: faDigits(p.sessionsPerWeek) + ' / هفته',
        assigned: tpl ? p.assignedCount || 0 : 1,
        updated: 'به‌روزرسانی ' + faDayMonth(new Date(p.updatedAt)),
        st: p.archived ? 'archived' : tpl && empty ? 'draft' : 'active',
        athleteId: p.athleteId,
        athleteName: p.athleteName || '',
        running: !!p.active || !!p.main,
        main: !!p.main,
      };
    });
  }

  activate(p: { id: string; name: string; athleteName: string }, replace: boolean) {
    api.programs
      .activate(p.id, { replace })
      .then(() => toast('برنامه فعال شد', p.athleteName + (replace ? ' از امروز «' + p.name.split(' · ')[0] + '» را دارد.' : ' این برنامه را هم‌زمان با برنامه فعلی دارد.')))
      .catch((e) => toast('انجام نشد', faError(e), 'error'));
  }

  stop(p: { id: string; name: string; athleteName: string }) {
    api.programs
      .deactivate(p.id)
      .then(() => toast('برنامه متوقف شد', '«' + p.name.split(' · ')[0] + '» برای ' + p.athleteName + ' متوقف شد؛ هر وقت بخواهید دوباره شروعش کنید.'))
      .catch((e) => toast('انجام نشد', faError(e), 'error'));
  }

  renderVals() {
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const list = this.liveList();
    const { tab, q, goal } = this.state;
    const inTab = (p) =>
      tab === 't' ? p.kind === 'template' && p.st === 'active' : tab === 'c' ? p.kind !== 'template' && p.st !== 'archived' : tab === 'd' ? p.st === 'draft' : p.st === 'archived';
    const items = list.filter((p) => inTab(p) && (goal === 'all' || p.g === goal) && (!q.trim() || p.name.includes(q.trim())));
    const n = (f) => list.filter(f).length;
    const tmplN = n((p) => p.kind === 'template' && p.st === 'active'),
      copyN = n((p) => p.kind !== 'template' && p.st !== 'archived');
    // A program left unsaved in the builder on this device (lib/builderDraft).
    const draft = readDraft();
    return {
      draft: draft
        ? {
            text: 'برنامهٔ ذخیره‌نشده: «' + (draft.meta?.name || 'برنامه') + '» · آخرین تغییر ' + draftAge(draft),
            resume: () => {
              try {
                sessionStorage.setItem('bl-builder-resume', '1');
              } catch {
                /* storage unavailable: the builder asks instead */
              }
              go('coach:program-builder' + (draft.id ? '?id=' + draft.id : ''));
            },
            discard: () => {
              clearDraft();
              this.setState({ draftGone: Date.now() });
            },
          }
        : null,
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'داشبورد', to: 'coach:dashboard' }, 'برنامه‌ها'],
      subtitle: fa(tmplN) + ' قالب · ' + fa(copyN) + ' نسخه ورزشکار',
      tabs: [
        { id: 't', label: 'قالب‌ها', count: fa(tmplN) },
        { id: 'c', label: 'برنامه‌های ورزشکاران', count: fa(copyN) },
        { id: 'd', label: 'پیش‌نویس‌ها', count: fa(n((p) => p.st === 'draft')) },
        { id: 'a', label: 'آرشیو', count: fa(n((p) => p.st === 'archived')) },
      ],
      setTab: (v) => this.setState({ tab: v }),
      setQ: (v) => this.setState({ q: v }),
      goalOpts: [
        { value: 'all', label: 'همه اهداف' },
        { value: 'gain', label: 'عضله‌سازی' },
        { value: 'loss', label: 'کاهش چربی' },
        { value: 'str', label: 'قدرت' },
        { value: 'gen', label: 'آمادگی عمومی' },
      ],
      setGoal: (v) => this.setState({ goal: v }),
      hasItems: items.length > 0,
      noItems: items.length === 0,
      emptyTitle: tab === 'a' ? 'برنامه آرشیوشده‌ای نیست' : 'برنامه‌ای یافت نشد',
      emptyDesc: tab === 'a' ? 'برنامه‌هایی که آرشیو کنید اینجا نگه داشته می‌شوند.' : 'جستجو یا فیلتر را تغییر دهید، یا برنامه جدیدی بسازید.',
      items: items.map((p) => ({
        ...p,
        assignedLabel:
          p.kind === 'template'
            ? p.assigned
              ? 'اختصاص به ' + fa(p.assigned) + ' نفر'
              : 'اختصاص نیافته'
            : p.running
              ? p.main
                ? 'در حال اجرا · برنامه اصلی'
                : 'در حال اجرا · هم‌زمان'
              : 'متوقف',
        to: p.kind === 'template' ? (p.st === 'draft' ? 'coach:program-builder?id=' : 'coach:program?id=') + p.id : 'coach:program-builder?id=' + p.id,
        actions:
          p.st === 'archived'
            ? [
                {
                  label: 'بازگردانی',
                  icon: 'refresh',
                  onClick: () => {
                    remote
                      .restoreProgram(p.id)
                      .then(() => toast('برنامه بازگردانی شد', '«' + p.name + '» به قالب‌ها برگشت.'))
                      .catch((e) => toast('انجام نشد', faError(e), 'error'));
                  },
                },
                { label: 'حذف برای همیشه', icon: 'trash', destructive: true, onClick: () => void deleteProgram({ id: p.id, name: p.name, template: p.kind === 'template' }) },
              ]
            : [
                ...(p.kind === 'template' ? [{ label: 'اختصاص به ورزشکار', icon: 'users', to: 'coach:assign?id=' + p.id }] : []),
                // Athlete programs (#74): start one again (e.g. the custom program after a template) or stop it.
                ...(p.kind !== 'template' && !p.running
                  ? [
                      { label: 'شروع دوباره (جایگزین برنامه فعلی)', icon: 'play', onClick: () => this.activate(p, true) },
                      { label: 'شروع هم‌زمان با برنامه فعلی', icon: 'plus', onClick: () => this.activate(p, false) },
                    ]
                  : []),
                ...(p.kind !== 'template' && p.running ? [{ label: 'توقف این برنامه', icon: 'pause', onClick: () => this.stop(p) }] : []),
                { label: 'ویرایش در برنامه‌ساز', icon: 'edit', to: 'coach:program-builder?id=' + p.id },
                {
                  label: 'کپی',
                  icon: 'copy',
                  onClick: () => {
                    api.programs
                      .duplicate(p.id)
                      .then(() => {
                        this.setState({ tab: 't' });
                        toast('برنامه کپی شد', 'نسخه کپی به‌عنوان قالب جدید ساخته شد.');
                      })
                      .catch((e) => toast('کپی نشد', faError(e), 'error'));
                  },
                },
                {
                  label: 'آرشیو',
                  icon: 'archive',
                  destructive: true,
                  onClick: () => {
                    api.programs
                      .archive(p.id)
                      .then(() => toast('برنامه آرشیو شد', 'ورزشکارانی که این برنامه را دارند تحت تأثیر قرار نمی‌گیرند.'))
                      .catch((e) => toast('انجام نشد', faError(e), 'error'));
                  },
                },
                { label: 'حذف', icon: 'trash', destructive: true, onClick: () => void deleteProgram({ id: p.id, name: p.name, template: p.kind === 'template' }) },
              ],
      })),
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="programs" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="برنامه‌ها" subtitle={v.subtitle}>
            <Button variant="primary" icon="plus" to="coach:create-program">
              ایجاد برنامه
            </Button>
          </PageHeader>
          {v.draft ? (
            <div
              role="status"
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '12px 16px',
                border: '1.5px solid var(--brand-primary)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-primary-subtle)',
              }}
            >
              <span style={{ flex: '1 1 240px', fontSize: '14px', lineHeight: '22px', fontWeight: 600, color: 'var(--text-primary)' }}>{v.draft.text}</span>
              <Button variant="primary" size="sm" icon="edit" onClick={v.draft.resume}>
                ادامه بده
              </Button>
              <Button variant="secondary" size="sm" onClick={v.draft.discard}>
                از نو شروع کن
              </Button>
            </div>
          ) : null}
          <Tabs value="t" tabs={v.tabs} onChange={v.setTab} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '300px' }}>
              <SearchField placeholder="جستجوی برنامه" onChange={v.setQ} />
            </div>
            <div style={{ width: '180px' }}>
              <Select value="all" options={v.goalOpts} onChange={v.setGoal} />
            </div>
            <div style={{ flex: '1' }}></div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Badge tone="neutral" icon="layers" size="sm">
                قالب
              </Badge>
              <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>الگوی قابل استفاده مجدد</p>
              <Badge tone="info" icon="link" size="sm">
                نسخه ورزشکار
              </Badge>
              <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>مستقل برای هر ورزشکار</p>
              <Badge tone="brand" icon="git-branch" size="sm">
                شخصی‌سازی‌شده
              </Badge>
              <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>ویرایش‌شده برای یک ورزشکار</p>
            </div>
          </div>
          {v.hasItems ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                {(v.items || []).map((p: any, $index: number) => (
                  <Fragment key={$index}>
                    <ProgramCard
                      name={p?.name}
                      goal={p?.goal}
                      kind={p?.kind}
                      version={p?.version}
                      weeks={p?.weeks}
                      frequency={p?.freq}
                      sport={(SPORT_LABEL[p?.sport || 'fitness'] || p?.sport) + (p?.timeLabel ? ' · ' + p.timeLabel : '')}
                      assigned={p?.assignedLabel}
                      updated={p?.updated}
                      actions={p?.actions}
                      to={p?.to}
                    />
                  </Fragment>
                ))}
              </div>
            </>
          ) : null}
          {v.noItems ? (
            <>
              <EmptyState icon="layers" title={v.emptyTitle} description={v.emptyDesc} actionLabel="ایجاد برنامه" actionTo="coach:create-program" />
            </>
          ) : null}
        </div>
      </PanelLayout>
    );
  }
}
