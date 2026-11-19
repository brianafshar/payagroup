// Ported from design handoff: project/C20 Coach Program Template.dc.html
import { Fragment } from 'react';
import { Banner, Button, Card, Checkbox, DataTable, DescriptionList, ListRow, Modal, PageHeader, Sidebar, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { go, param } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { api, faError, remote } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import type { Program } from '@/data/types';
import { faDate } from '@/lib/format';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Data container: the template in `?id=` and its athlete copies. */
export default function CoachProgramTemplatePage(props: { brand?: string }) {
  const id = param('id') || '';
  const program = useQuery('program:' + id, () => api.programs.get(id));
  const copies = useQuery('program-copies:' + id, () => remote.programCopies(id));
  const wait = pending(program, copies);
  if (wait) return wait;
  return <CoachProgramTemplate {...props} program={program.data} liveCopies={copies.data} />;
}

class CoachProgramTemplate extends Screen {
  state: ScreenState = { upd: false, pick: [], ver: null };

  live() {
    const pr: Program = this.props.program;
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const weeks = pr.weeks || [];
    const copies = this.props.liveCopies.map((c) => {
      const old = c.kind === 'copy' && c.version < pr.version;
      return {
        id: String(c.id),
        athleteId: c.athleteId,
        a: { name: c.athleteName, sub: c.start ? 'شروع ' + faDate(new Date(c.start), { day: 'numeric', month: 'long' }) : 'برنامه فعلی نیست' },
        k:
          c.kind === 'customized'
            ? { label: 'شخصی‌سازی‌شده', tone: 'brand', icon: 'git-branch' }
            : old
              ? { label: 'کپی از v' + fa(c.version) + ' · v' + fa(pr.version) + ' موجود است', tone: 'warning', icon: 'refresh' }
              : { label: 'کپی از v' + fa(c.version), tone: 'info', icon: 'link' },
        w: c.week ? 'هفته ' + fa(Math.min(c.week, c.durationWeeks)) + ' از ' + fa(c.durationWeeks) : '—',
        c: c.adherencePct,
        custom: c.kind === 'customized',
        old,
      };
    });
    const totalSets = weeks.reduce((a, w) => a + w.days.reduce((b, d) => b + d.exercises.reduce((c, x) => c + x.sets.length, 0), 0), 0);
    return {
      pr,
      copies,
      totalSets,
      weekRows: weeks.map((w) => {
        const days = w.days.filter((d) => !d.rest && d.exercises.length);
        const sets = days.reduce((a, d) => a + d.exercises.reduce((b, x) => b + x.sets.length, 0), 0);
        const rpes = days.flatMap((d) => d.exercises.flatMap((x) => x.sets.map((st) => st.rpe).filter((r) => r != null)));
        return {
          id: String(w.index),
          w: 'هفته ' + fa(w.index),
          f: [...new Set(days.map((d) => d.focus).filter(Boolean))].join('، ') || '—',
          s: fa(sets) + ' ست',
          r: rpes.length ? 'RPE ' + fa(Math.max(...rpes)) : '—',
          to: 'coach:program-builder?id=' + pr.id,
        };
      }),
    };
  }

  renderVals() {
    const L = this.live();
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const p = {
      name: L.pr.name,
      goal: L.pr.goal || '—',
      desc: L.pr.goal || 'قالب',
      weeks: L.pr.durationWeeks,
      s: L.pr.sessionsPerWeek,
      v: 'v' + fa(L.pr.version),
      n: L.copies.length,
    };
    const { upd, pick, ver } = this.state;
    const copies = L.copies;
    const vers = [{ key: 'cur', icon: 'layers', title: p.v + ' · فعلی', sub: 'آخرین ذخیره ' + faDate(new Date(L.pr.updatedAt)), badge: 'فعلی' }];
    const updList = copies.filter((c) => c.old || c.custom);
    const vObj = vers.find((v) => v.key === ver);
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'برنامه‌ها', to: 'coach:programs' }, p.name],
      title: p.name,
      subtitle: p.desc + ' · ' + fa(p.weeks) + ' هفته · ' + fa(p.s) + ' جلسه در هفته',
      badges: [{ label: 'قالب ' + p.v, tone: 'neutral', icon: 'layers' }],
      version: p.v,
      assignTo: 'coach:assign?id=' + L.pr.id,
      editTo: 'coach:program-builder?id=' + L.pr.id,
      duplicate: () =>
        void api.programs
          .duplicate(L.pr.id)
          .then((d) => go('coach:program?id=' + d.id, { title: 'قالب کپی شد', desc: '«' + d.name + '» ساخته شد.' }))
          .catch((e) => toast('کپی نشد', faError(e), 'error')),
      copiesSub: fa(p.n) + ' ورزشکار',
      openUpdate: () => this.setState({ upd: true }),
      copyCols: [
        { key: 'a', label: 'ورزشکار', type: 'person' },
        { key: 'k', label: 'نسخه', type: 'badge' },
        { key: 'w', label: 'پیشرفت' },
        { key: 'c', label: 'انجام تمرین', type: 'progress' },
      ],
      copies: copies.map((c) => ({ ...c, to: c.custom ? 'coach:program-builder?id=' + c.id : 'coach:athlete?id=' + c.athleteId })),
      weekCols: [
        { key: 'w', label: 'هفته' },
        { key: 'f', label: 'تمرکز' },
        { key: 's', label: 'حجم', align: 'right' },
        { key: 'r', label: 'شدت' },
      ],
      weekRows: L.weekRows,
      one: 1,
      about: [
        { label: 'هدف', value: p.goal },
        { label: 'هفته‌ها', value: fa(p.weeks) },
        { label: 'جلسه در هفته', value: fa(p.s) },
        { label: 'آخرین ویرایش', value: faDate(new Date(L.pr.updatedAt)) },
      ],
      versions: vers.map((v) => ({ ...v, badge: v.badge || '', open: () => this.setState({ ver: v.key }) })),
      updOpen: upd,
      updList: updList.map((c) => ({
        label: c.a.name,
        desc: c.custom ? 'شخصی‌سازی‌شده — بازنویسی نمی‌شود' : c.k.label + ' · ' + c.w,
        on: !c.custom && pick.includes(c.id),
        locked: !!c.custom,
        toggle: () => this.setState({ pick: pick.includes(c.id) ? pick.filter((x) => x !== c.id) : [...pick, c.id] }),
      })),
      updNone: pick.length === 0,
      updLabel: 'به‌روزرسانی ' + fa(pick.length) + ' نسخه',
      doUpdate: async () => {
        try {
          await remote.pushProgramUpdate(L.pr.id, pick.map(Number));
        } catch (e) {
          return toast('به‌روزرسانی نشد', faError(e), 'error');
        }
        this.setState({ upd: false, pick: [] });
        toast('نسخه‌ها به‌روز شد', fa(pick.length) + ' ورزشکار ' + p.v + ' را گرفتند.');
      },
      closeUpdate: () => this.setState({ upd: false }),
      verOpen: !!vObj,
      verTitle: vObj ? 'نسخه ' + vObj.title : '',
      verDesc: vObj ? vObj.sub : '',
      verPrimary: 'باز کردن در برنامه‌ساز',
      verItems: [
        { label: 'هفته‌ها', value: fa(p.weeks) },
        { label: 'جلسه در هفته', value: fa(p.s) },
        { label: 'حجم کل', value: fa(L.totalSets) + ' ست' },
      ],
      verAction: () => go('coach:program-builder?id=' + L.pr.id),
      closeVer: () => this.setState({ ver: null }),
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="programs" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
        overlays={
          <>
            {v.updOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal
                    title={'به‌روزرسانی نسخه‌ها به ' + v.version}
                    description={'نسخه‌های انتخاب‌شده با ' + v.version + ' جایگزین می‌شوند. سابقه تمرین ورزشکار حفظ می‌شود.'}
                    primaryLabel={v.updLabel}
                    primaryDisabled={v.updNone}
                    secondaryLabel="انصراف"
                    onPrimary={v.doUpdate}
                    onClose={v.closeUpdate}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(v.updList || []).map((u: any, $index: number) => (
                        <Fragment key={$index}>
                          <Checkbox label={u?.label} description={u?.desc} checked={u?.on} disabled={u?.locked} onChange={u?.toggle} />
                        </Fragment>
                      ))}
                    </div>
                  </Modal>
                </div>
              </>
            ) : null}
            {v.verOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal title={v.verTitle} description={v.verDesc} primaryLabel={v.verPrimary} secondaryLabel="بستن" onPrimary={v.verAction} onClose={v.closeVer}>
                    <DescriptionList columns={v.one} items={v.verItems} />
                  </Modal>
                </div>
              </>
            ) : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader back="برنامه‌ها" backTo="coach:programs" title={v.title} subtitle={v.subtitle} badges={v.badges}>
            <Button variant="secondary" icon="copy" onClick={v.duplicate}>
              کپی
            </Button>
            <Button variant="secondary" icon="edit" to={v.editTo}>
              ویرایش قالب
            </Button>
            <Button variant="primary" icon="users" to={v.assignTo}>
              اختصاص به ورزشکاران
            </Button>
          </PageHeader>
          <Banner
            tone="info"
            title="ویرایش این قالب فقط روی اختصاص‌های بعدی اثر دارد"
            description="هر ورزشکار نسخه مستقل خودش را دارد. با انتشار نسخه جدید، خودتان انتخاب می‌کنید کدام نسخه‌ها به‌روز شوند؛ نسخه‌های شخصی‌سازی‌شده هرگز بازنویسی نمی‌شوند."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Card title="نسخه‌های اختصاص‌یافته" subtitle={v.copiesSub} actionLabel="به‌روزرسانی نسخه‌ها" onAction={v.openUpdate} padding="none">
                <DataTable bare columns={v.copyCols} rows={v.copies} />
              </Card>
              <Card title="هفته به هفته" subtitle="روی هر هفته بزنید تا در برنامه‌ساز باز شود" padding="none">
                <DataTable bare dense columns={v.weekCols} rows={v.weekRows} />
              </Card>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <Card title="درباره">
                <DescriptionList columns={v.one} items={v.about} />
              </Card>
              <Card title="نسخه‌ها" padding="none">
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                  {(v.versions || []).map((v: any, $index: number) => (
                    <Fragment key={$index}>
                      <ListRow icon={v?.icon} title={v?.title} subtitle={v?.sub} badge={v?.badge} badgeTone="neutral" onClick={v?.open} chevron={false} />
                    </Fragment>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
