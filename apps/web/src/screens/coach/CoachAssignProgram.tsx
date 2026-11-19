// Ported from design handoff: project/C21 Coach Assign Program.dc.html
import { Fragment } from 'react';
import { Banner, Button, Checkbox, PageHeader, RadioGroup, SearchField, Select, Sidebar, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { go, param } from '@/lib/nav';
import { api, faError, remote } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { faDate } from '@/lib/format';
import { toast } from '@/lib/toast';
import { GOAL_LABEL } from './CoachAthletes';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Data container: the template, the coach's athletes and who already runs this template. */
export default function CoachAssignProgramPage(props: { brand?: string }) {
  const id = param('id') || '';
  const program = useQuery('program:' + id, () => api.programs.get(id));
  const athletes = useQuery('athletes', () => api.athletes.list());
  const copies = useQuery('program-copies:' + id, () => remote.programCopies(id));
  const wait = pending(program, athletes, copies);
  if (wait) return wait;
  return <CoachAssignProgram {...props} program={program.data} athletes={athletes.data} copies={copies.data} />;
}

const isoOf = (x: Date) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');

/**
 * Start options (#61). Program weeks count from the start day and each day runs the session written for
 * its weekday, so the coach chooses: today (week 1 = today → same weekday next week), the next Saturday
 * (calendar weeks, Saturday → Friday), or another date in the next two weeks.
 */
function startDays(): Array<{ value: string; label: string; d: Date }> {
  return Array.from({ length: 14 }, (_, off) => {
    const x = new Date();
    x.setDate(x.getDate() + off);
    const label = faDate(x, { weekday: 'long', day: 'numeric', month: 'long' });
    return { value: isoOf(x), label: off === 0 ? 'امروز · ' + label : off === 1 ? 'فردا · ' + label : label, d: x };
  });
}
function nextSaturday(): string {
  const x = new Date();
  x.setDate(x.getDate() + ((6 - x.getDay() + 7) % 7 || 7));
  return isoOf(x);
}

class CoachAssignProgram extends Screen {
  state: ScreenState = { sel: [], q: '', together: 'replace', mode: 'today', custom: startDays()[1].value, fromWeek: '1', notify: true, saving: false };
  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const id = param('id') || '';
    const pr = this.props.program;
    const [pname, ver, weeks] = [pr.name, 'v' + fa(pr.version), pr.durationWeeks];
    const runningIds = new Set(this.props.copies.filter((c) => c.current).map((c) => String(c.athleteId)));
    const { sel, q, together, mode, custom, fromWeek, notify, saving } = this.state;
    const start = mode === 'today' ? isoOf(new Date()) : mode === 'sat' ? nextSaturday() : custom;
    const ATH = this.props.athletes
      .filter((a) => a.userId || a.status === 'invited' || a.status === 'draft')
      .map((a) => ({
        id: a.id,
        name: a.name,
        desc: runningIds.has(a.id)
          ? 'در حال حاضر روی همین قالب است'
          : [a.goal ? GOAL_LABEL[a.goal] : null, a.programName ? 'برنامه فعلی: ' + a.programName : 'بدون برنامه'].filter(Boolean).join(' · '),
        locked: runningIds.has(a.id),
      }));
    const shown = ATH.filter((a) => !q.trim() || a.name.includes(q.trim()));
    const chosen = ATH.filter((a) => sel.includes(a.id) && !a.locked);
    const toggle = (aid) => this.setState({ sel: sel.includes(aid) ? sel.filter((x) => x !== aid) : [...sel, aid] });
    const starts = startDays();
    const startLabel = (starts.find((s) => s.value === start) || { label: faDate(new Date(start + 'T12:00:00'), { weekday: 'long', day: 'numeric', month: 'long' }) }).label;
    const names = chosen.map((a) => a.name.split(' ')[0]);
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'برنامه‌ها', to: 'coach:programs' }, { label: pname, to: 'coach:program?id=' + id }, 'اختصاص'],
      title: 'اختصاص «' + pname + '»',
      subtitle: 'قالب ' + ver + ' · هر ورزشکار یک نسخه مستقل دریافت می‌کند',
      backLabel: pname,
      backTo: 'coach:program?id=' + id,
      selLabel: fa(chosen.length) + ' انتخاب شده',
      setQ: (v) => this.setState({ q: v }),
      noMatch: shown.length === 0,
      athletes: shown.map((a) => ({ name: a.name, desc: a.desc, locked: !!a.locked, on: sel.includes(a.id) && !a.locked, toggle: () => toggle(a.id) })),
      together,
      setTogether: (v) => this.setState({ together: v }),
      togetherOpts: [
        { value: 'replace', label: 'جایگزین برنامه فعلی', description: 'برنامه‌های فعلی ورزشکار متوقف می‌شوند (در فهرست برنامه‌هایش می‌مانند و می‌شود دوباره فعالشان کرد).' },
        { value: 'add', label: 'هم‌زمان با برنامه فعلی', description: 'مثلاً برنامه دو کنار برنامه بدنسازی؛ ورزشکار هر روز جلسه هر دو برنامه را می‌بیند.' },
      ],
      mode,
      setMode: (v) => this.setState({ mode: v }),
      modeOpts: [
        { value: 'today', label: 'از امروز شروع کن', description: 'هفته‌ها از امروز شمرده می‌شوند؛ هر روز، تمرین همان روز هفته را دارد.' },
        {
          value: 'sat',
          label: 'از شنبه‌ی بعد شروع کن',
          description: 'هفته‌های کامل شنبه تا جمعه · ' + faDate(new Date(nextSaturday() + 'T12:00:00'), { day: 'numeric', month: 'long' }),
        },
        { value: 'date', label: 'تاریخ دیگر', description: 'یکی از روزهای دو هفته‌ی آینده' },
      ],
      custom,
      starts: starts.slice(1),
      setCustom: (v) => this.setState({ custom: v }),
      fromWeek,
      weekOpts: Array.from({ length: weeks }, (_, i) => ({ value: String(i + 1), label: 'هفته ' + fa(i + 1) })),
      setWeek: (v) => this.setState({ fromWeek: v }),
      notify,
      setNotify: (v) => this.setState({ notify: v }),
      hasSel: chosen.length > 0,
      noSel: chosen.length === 0,
      bannerTitle: fa(chosen.length) + ' نسخه مستقل ساخته می‌شود',
      bannerDesc: 'تغییر نسخه هر ورزشکار هرگز روی قالب یا بقیه اثر ندارد.' + ' شروع از هفته ' + fa(fromWeek) + ' · ' + startLabel + '.',
      assignLabel: 'اختصاص به ' + fa(chosen.length) + ' ورزشکار',
      saving,
      assign: async () => {
        if (!chosen.length) return;
        this.setState({ saving: true });
        {
          // Starting from week N: week 1 began (N−1) weeks before the chosen date.
          const d = new Date(start + 'T12:00:00');
          d.setDate(d.getDate() - 7 * (+fromWeek - 1));
          const iso = d.toISOString().slice(0, 10);
          try {
            await api.programs.assign(
              id,
              chosen.map((a) => a.id),
              iso,
              together === 'replace',
            );
            if (notify) {
              const when = startLabel;
              await Promise.all(chosen.map((a) => remote.sendMessage(a.id, `برنامه جدید «${pname}» برایت تنظیم شد؛ از ${when} شروع می‌شود. 💪`).catch(() => null)));
            }
          } catch (e) {
            this.setState({ saving: false });
            return toast('اختصاص انجام نشد', faError(e), 'error');
          }
          return go('coach:program?id=' + id, {
            title: 'برنامه اختصاص یافت',
            desc: '«' + pname + '» به ' + names.join('، ') + (notify ? ' · پیام و اعلان برایشان ارسال شد.' : '.'),
          });
        }
      },
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
          <PageHeader title={v.title} subtitle={v.subtitle} back={v.backLabel} backTo={v.backTo} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                minWidth: '0',
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>ورزشکاران</h3>
                <div style={{ flex: '1' }}></div>
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.selLabel}</p>
              </div>
              <SearchField placeholder="جستجوی ورزشکار" size="sm" onChange={v.setQ} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '0' }}>
                {(v.athletes || []).map((a: any, $index: number) => (
                  <Fragment key={$index}>
                    <Checkbox label={a?.name} description={a?.desc} checked={a?.on} disabled={a?.locked} onChange={a?.toggle} />
                  </Fragment>
                ))}
                {v.noMatch ? (
                  <>
                    <p style={{ margin: '0', fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)' }}>ورزشکاری یافت نشد.</p>
                  </>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minWidth: '0',
                }}
              >
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>زمان‌بندی</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <RadioGroup label="زمان شروع" value={v.mode} options={v.modeOpts} onChange={v.setMode} />
                  </div>
                  {v.mode === 'date' ? <Select label="تاریخ شروع" value={v.custom} options={v.starts} onChange={v.setCustom} /> : null}
                  <Select label="شروع از" value={v.fromWeek} options={v.weekOpts} onChange={v.setWeek} />
                </div>
                <RadioGroup label="برنامه‌های فعلی ورزشکار" value={v.together} options={v.togetherOpts} onChange={v.setTogether} />
                <Checkbox label="اطلاع‌رسانی به ورزشکاران در اپ" checked={v.notify} onChange={v.setNotify} />
              </div>
            </div>
          </div>
          {v.hasSel ? (
            <>
              <Banner tone="success" icon="git-branch" title={v.bannerTitle} description={v.bannerDesc} />
            </>
          ) : null}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Button variant="ghost" to={v.backTo}>
              انصراف
            </Button>
            <Button variant="primary" icon="check" disabled={v.noSel} loading={v.saving} onClick={v.assign}>
              {v.assignLabel}
            </Button>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
