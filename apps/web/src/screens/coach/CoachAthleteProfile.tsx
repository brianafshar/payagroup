// Ported from design handoff: project/C12 Coach Athlete Profile.dc.html
import { Fragment } from 'react';
import {
  Button,
  Card,
  ChartContainer,
  DescriptionList,
  EmptyState,
  LineChart,
  ListRow,
  Modal,
  PRCard,
  PageHeader,
  ProgressBar,
  SensitiveSection,
  Sidebar,
  StatCard,
  Tabs,
  TextField,
  TopBar,
  WorkoutCard,
} from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { go, param } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { api, faError, remote } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import type { Athlete } from '@/data/types';
import { faDate, faDayMonth, faDigits, faLastSeen, faTime, yearsSince } from '@/lib/format';
import { HEALTH_LABELS, METRICS, faNum } from '@/lib/metrics';
import { GOAL_LABEL } from './CoachAthletes';
import { AthletePersonalModal, faBirth } from './AthletePersonalModal';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';
import { ProgramPdfButtons } from './ProgramPdf';

/** Data container: the athlete in `?id=` with overview, measurements and notes. */
export default function CoachAthleteProfilePage(props: { brand?: string }) {
  const id = param('id') || '';
  const athlete = useQuery('athlete:' + id, () => api.athletes.get(id));
  const overview = useQuery('athlete-overview:' + id, () => remote.athleteOverview(id));
  const measures = useQuery('athlete-measures:' + id, () => remote.latestMeasurements(id));
  const notes = useQuery('athlete-notes:' + id, () => remote.notes(id));
  const wait = pending(athlete, overview, measures, notes);
  if (wait) return wait;
  return <CoachAthleteProfile {...props} athlete={athlete.data} overview={overview.data} measures={measures.data} liveNotes={notes.data} />;
}

const WORKOUT_STATUS: Record<string, string> = { completed: 'completed', partial: 'partial', missed: 'missed', 'in-progress': 'in-progress', planned: 'planned', rest: 'rest' };

class CoachAthleteProfile extends Screen {
  state: ScreenState = {
    tab: 'overview',
    modal: null,
    note: '',
    weightIn: '',
    waistIn: '',
    range: 'یک سال',
    health: null,
  };

  live() {
    const a: Athlete = this.props.athlete;
    const o = this.props.overview;
    const pct = (n: number | null | undefined) => ({ value: n ?? 0, label: n == null ? 'ثبت نشده' : '٪' + faDigits(n) });
    const w = o?.weight || [];
    const lastW = w.at(-1);
    const prevW = w.at(-2);
    const measures = this.props.measures.map((m) => ({
      label: METRICS[m.metric]?.label || m.metric,
      cur: faNum(m.value),
      unit: m.unit,
      date: faDayMonth(new Date(m.date)),
      prev: m.previous == null ? '—' : faNum(m.previous),
      prevDate: '',
      change: m.previous == null ? undefined : Math.round((m.value - m.previous) * 10) / 10,
    }));
    const age = a.birthDate ? faDigits(yearsSince(a.birthDate)) : null;
    const gender = a.gender === 'f' ? 'زن' : a.gender === 'm' ? 'مرد' : null;
    const prog = a.programName ? a.programName + (a.programWeek ? '، هفته ' + faDigits(a.programWeek) : '') : 'بدون برنامه';
    const st = o?.strength;
    return {
      a,
      subtitle: [age, gender, a.goal ? GOAL_LABEL[a.goal] : null, prog].filter(Boolean).join(' · '),
      today: {
        eyebrow: 'امروز' + (o.today.startedAt ? ' · شروع ' + faTime(new Date(o.today.startedAt)) : ''),
        title: o.today.rest ? 'روز استراحت' : o.today.focus || 'جلسه تمرین',
        subtitle: o.today.week ? 'هفته ' + faDigits(o.today.week) : 'بدون برنامه فعال',
        exercises: o.today.exercises,
        status: WORKOUT_STATUS[o.today.status] || 'planned',
        setsDone: o.today.setsDone,
        setsTotal: o.today.setsTotal,
      },
      adh: { w: pct(o.adherence.training), n: pct(o.adherence.nutrition), r: pct(o.adherence.recovery) },
      record: o.record,
      recordsCount: faDigits(o.recordsCount ?? 0),
      strength: st && st.values.length ? st : null,
      weight: lastW
        ? {
            cur: faNum(lastW.value),
            date: faDayMonth(new Date(lastW.date)),
            prev: prevW ? faNum(prevW.value) : '—',
            prevDate: prevW ? faDayMonth(new Date(prevW.date)) : '',
            change: prevW ? Math.round((lastW.value - prevW.value) * 10) / 10 : undefined,
            spark: w.map((x) => x.value),
          }
        : null,
      measures,
      personal: [
        { label: 'نام', value: a.name },
        { label: 'سن', value: age ? age + ' سال' : 'ثبت نشده' },
        { label: 'تاریخ تولد', value: a.birthDate ? faBirth(a.birthDate) : 'ثبت نشده' },
        { label: 'جنسیت', value: gender || 'ثبت نشده' },
        { label: 'قد', value: a.heightCm ? faNum(a.heightCm) + ' cm' : 'ثبت نشده' },
        { label: 'هدف', value: a.goal ? GOAL_LABEL[a.goal] : 'ثبت نشده' },
        { label: 'مربی', value: a.coachName || '—' },
        { label: 'ایمیل', value: a.email || 'ثبت نشده' },
        { label: 'تلفن', value: a.phone ? faDigits(a.phone) : 'ثبت نشده' },
        { label: 'عضو از', value: a.createdAt ? faDate(new Date(a.createdAt)) : '—' },
      ],
      notes: this.props.liveNotes.map((n) => ({ text: n.text, date: faLastSeen(n.createdAt, new Date(), false) })),
    };
  }

  async revealHealth() {
    const a: Athlete = this.props.athlete;
    try {
      const h = await remote.health(a.id);
      this.setState({ health: HEALTH_LABELS.map(([k, label]) => ({ label, value: h[k] || 'ثبت نشده' })) });
      toast('اطلاعات سلامت نمایش داده شد', 'این مشاهده در گزارش رویدادها ثبت شد.');
    } catch (e) {
      toast('بارگذاری نشد', faError(e), 'error');
    }
  }

  renderVals() {
    const L = this.live();
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const toEn = (s) =>
      String(s)
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace('٫', '.')
        .replace(/[^\d.]/g, '');
    const { tab, modal, note, weightIn, range } = this.state;
    const notes = L.notes;
    const pages = {
      programs: 'coach:customize',
      history: 'coach:history',
      perf: 'coach:strength',
      nutrition: 'coach:nutrition',
      recovery: 'coach:recovery',
      progress: 'coach:analytics',
      records: 'coach:records',
    };
    const allLabels = L.strength ? L.strength.labels.map((m) => faDate(new Date(m), { month: 'long' })) : [];
    const allVals = L.strength ? L.strength.values : [];
    const take = { ماه: 2, '۳ ماه': 4, '۶ ماه': 7, 'یک سال': 13 }[range] || 13;
    const vals = allVals.slice(-take),
      labels = allLabels.slice(-take);
    const pct = vals.length ? (((vals[vals.length - 1] - vals[0]) / vals[0]) * 100).toFixed(1) : '0';
    const close = () => this.setState({ modal: null, note: '', weightIn: '' });
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      L,
      crumbs: [{ label: 'ورزشکاران', to: 'coach:athletes' }, L.a.name],
      badges: [{ status: L.a.status }],
      tabs: [
        { id: 'overview', label: 'نمای کلی' },
        { id: 'personal', label: 'اطلاعات شخصی' },
        { id: 'health', label: 'سلامت' },
        { id: 'measure', label: 'اندازه‌گیری‌ها' },
        { id: 'programs', label: 'برنامه‌ها' },
        { id: 'history', label: 'سابقه تمرین' },
        { id: 'perf', label: 'عملکرد' },
        { id: 'nutrition', label: 'تغذیه' },
        { id: 'recovery', label: 'ریکاوری' },
        { id: 'progress', label: 'پیشرفت' },
        { id: 'records', label: 'رکوردها', count: L.recordsCount },
        { id: 'notes', label: 'یادداشت‌ها', count: fa(notes.length) },
      ],
      onTab: (id) => {
        if (pages[id]) {
          go(pages[id] + '?id=' + L.a.id);
          return false;
        }
        this.setState({ tab: id });
      },
      isOverview: tab === 'overview',
      isPersonal: tab === 'personal',
      isHealth: tab === 'health',
      isMeasure: tab === 'measure',
      isNotes: tab === 'notes',
      wt: 90,
      nt: 80,
      rt: 80,
      goRecords: () => go('coach:records?id=' + L.a.id),
      goStrength: () => go('coach:strength?id=' + L.a.id),
      ranges: ['ماه', '۳ ماه', '۶ ماه', 'یک سال'],
      setRange: (v) => this.setState({ range: v }),
      chartSummary: vals.length ? fa(vals[vals.length - 1]) + ' kg اکنون · ' + fa(pct) + '٪ در این بازه (از ' + fa(vals[0]) + ' kg، ' + labels[0] + ')' : '',
      chartLabels: labels,
      chartSeries: [{ values: vals }],
      chartH: 200,
      chartW: 720,
      chartAnn: [{ index: vals.length - 1 }],
      sparkW: 320,
      revealed: () => void this.revealHealth(),
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      health: this.state.health || [{ label: 'در حال بارگذاری…', value: '' }],
      personal: L.personal,
      editPersonal: () => this.setState({ modal: 'personal' }),
      personalOpen: modal === 'personal',
      measures: L.measures,
      noMeasures: L.measures.length === 0,
      notes,
      openNote: () => this.setState({ modal: 'note' }),
      openMeasure: () => this.setState({ modal: 'measure' }),
      closeModal: close,
      noteOpen: modal === 'note',
      measureOpen: modal === 'measure',
      setNote: (v) => this.setState({ note: v }),
      noteEmpty: !note.trim(),
      saveNote: async () => {
        try {
          await remote.addNote(L.a.id, note.trim());
        } catch (e) {
          return toast('ذخیره نشد', faError(e), 'error');
        }
        this.setState({ modal: null, note: '', tab: 'notes' });
        toast('یادداشت ذخیره شد');
      },
      setWeight: (v) => this.setState({ weightIn: v }),
      measureEmpty: !(parseFloat(toEn(weightIn)) > 0),
      setWaist: (v) => this.setState({ waistIn: v }),
      saveMeasure: async () => {
        const v = parseFloat(toEn(weightIn));
        const day = new Date().toISOString().slice(0, 10);
        const waist = parseFloat(toEn(this.state.waistIn));
        try {
          await remote.addMeasurement(L.a.id, 'weight', v, day);
          if (waist > 0) await remote.addMeasurement(L.a.id, 'waist', waist, day);
        } catch (e) {
          return toast('ثبت نشد', faError(e), 'error');
        }
        this.setState({ modal: null, weightIn: '', waistIn: '' });
        toast('اندازه‌گیری ثبت شد', 'وزن بدن: ' + fa(v) + ' kg');
      },
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="athletes" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
        overlays={
          <>
            {v.noteOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal
                    title="افزودن یادداشت"
                    description="یادداشت‌ها فقط برای شما قابل مشاهده‌اند."
                    primaryLabel="ذخیره یادداشت"
                    secondaryLabel="انصراف"
                    primaryDisabled={v.noteEmpty}
                    onPrimary={v.saveNote}
                    onClose={v.closeModal}
                  >
                    <TextField label="یادداشت" multiline rows={v.four} placeholder="مثلاً فرم اسکوات در ست آخر افت کرد؛ هفته بعد وزنه ثابت بماند." onChange={v.setNote} />
                  </Modal>
                </div>
              </>
            ) : null}
            {v.personalOpen ? <AthletePersonalModal athlete={this.props.athlete} onClose={v.closeModal} /> : null}
            {v.measureOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal
                    title="ثبت اندازه‌گیری"
                    description="مقدار جدید در نمودارها و تحلیل ترکیب بدن نمایش داده می‌شود."
                    primaryLabel="ثبت"
                    secondaryLabel="انصراف"
                    primaryDisabled={v.measureEmpty}
                    onPrimary={v.saveMeasure}
                    onClose={v.closeModal}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px' }}>
                      <TextField label="وزن بدن" suffix="kg" placeholder="مثلاً ۸۲٫۴" onChange={v.setWeight} />
                      <TextField label="دور کمر" suffix="cm" optional placeholder="مثلاً ۸۴" onChange={v.setWaist} />
                    </div>
                  </Modal>
                </div>
              </>
            ) : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader back="ورزشکاران" backTo="coach:athletes" avatar={v.L.a.name} title={v.L.a.name} subtitle={v.L.subtitle} badges={v.badges}>
            <Button variant="secondary" icon="file-text" onClick={v.openNote}>
              افزودن یادداشت
            </Button>
            <Button variant="secondary" icon="ruler" onClick={v.openMeasure}>
              ثبت اندازه‌گیری
            </Button>
            <ProgramPdfButtons athleteId={v.L.a.id} name={v.L.a.name} />
            <Button variant="primary" icon="edit" to={'coach:customize?id=' + v.L.a.id}>
              ویرایش برنامه
            </Button>
          </PageHeader>
          <Tabs value="overview" tabs={v.tabs} onChange={v.onTab} />
          {v.isOverview ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  <WorkoutCard
                    eyebrow={v.L.today.eyebrow}
                    title={v.L.today.title}
                    subtitle={v.L.today.subtitle}
                    exercises={v.L.today.exercises}
                    status={v.L.today.status}
                    setsDone={v.L.today.setsDone}
                    setsTotal={v.L.today.setsTotal}
                    ctaLabel="مشاهده سابقه"
                    ctaTo={'coach:history?id=' + v.L.a.id}
                  />
                  <Card title="پایبندی" subtitle="۳۰ روز گذشته · نشانگر = هدف">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '0' }}>
                      <ProgressBar label="تمرین‌ها" value={v.L.adh.w.value} valueLabel={v.L.adh.w.label} target={v.wt} />
                      <ProgressBar label="تغذیه" value={v.L.adh.n.value} valueLabel={v.L.adh.n.label} target={v.nt} />
                      <ProgressBar label="ریکاوری" value={v.L.adh.r.value} valueLabel={v.L.adh.r.label} target={v.rt} />
                    </div>
                  </Card>
                  <div onClick={v.goRecords} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                    {v.L.record ? (
                      <PRCard
                        exercise={v.L.record.exercise}
                        type={'حداکثر ' + faDigits(parseInt(v.L.record.type) || 1) + ' تکرار'}
                        date={faLastSeen(v.L.record.date, new Date(), false)}
                        value={faNum(v.L.record.value)}
                        unit={v.L.record.unit}
                        previous={v.L.record.previous ? faNum(v.L.record.previous) + ' ' + v.L.record.unit : undefined}
                        delta={v.L.record.previous ? Math.round(((v.L.record.value - v.L.record.previous) / v.L.record.previous) * 1000) / 10 : undefined}
                        isNew={Date.now() - Date.parse(v.L.record.date) < 7 * 86400000}
                      />
                    ) : (
                      <Card title="رکوردها">هنوز رکوردی ثبت نشده است.</Card>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  <div style={{ gridColumn: 'span 2', minWidth: '0' }}>
                    {!v.L.strength ? (
                      <Card title="روند قدرت">هنوز ست وزنه‌داری ثبت نشده است.</Card>
                    ) : (
                      <ChartContainer
                        title={v.L.strength.exercise + ' · 1RM تخمینی'}
                        ranges={v.ranges}
                        range="یک سال"
                        onRange={v.setRange}
                        summary={v.chartSummary}
                        footnote="1RM آزمون‌شده. مقادیر تخمینی با فرمول Epley: وزنه × (۱ + تکرار ÷ ۳۰)."
                        tableLabel="تحلیل کامل قدرت"
                        onTable={v.goStrength}
                      >
                        <LineChart labels={v.chartLabels} series={v.chartSeries} unit="kg" height={v.chartH} width={v.chartW} annotations={v.chartAnn} points />
                      </ChartContainer>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
                    {v.L.weight ? (
                      <StatCard
                        label="وزن بدن"
                        current={v.L.weight.cur}
                        unit="kg"
                        date={v.L.weight.date}
                        previous={v.L.weight.prev}
                        previousDate={v.L.weight.prevDate}
                        change={v.L.weight.change}
                        spark={v.L.weight.spark}
                        sparkWidth={v.sparkW}
                      />
                    ) : (
                      <StatCard label="وزن بدن" current="ثبت نشده" />
                    )}
                    <SensitiveSection hidden onReveal={v.revealed} footer="دسترسی در گزارش رویدادها ثبت می‌شود">
                      <DescriptionList columns={v.one} items={v.health} />
                    </SensitiveSection>
                  </div>
                </div>
              </div>
            </>
          ) : null}
          {v.isPersonal ? (
            <>
              <Card title="اطلاعات شخصی" actionLabel="ویرایش" onAction={v.editPersonal}>
                <DescriptionList columns={v.three} items={v.personal} />
              </Card>
            </>
          ) : null}
          {v.isHealth ? (
            <>
              <SensitiveSection hidden onReveal={v.revealed} footer="دسترسی در گزارش رویدادها ثبت می‌شود">
                <DescriptionList columns={v.two} items={v.health} />
              </SensitiveSection>
            </>
          ) : null}
          {v.isMeasure ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                {(v.measures || []).map((m: any, $index: number) => (
                  <Fragment key={$index}>
                    <StatCard label={m?.label} current={m?.cur} unit={m?.unit} date={m?.date} previous={m?.prev} previousDate={m?.prevDate} change={m?.change} />
                  </Fragment>
                ))}
              </div>
              {v.noMeasures ? (
                <EmptyState icon="ruler" title="هنوز اندازه‌گیری ثبت نشده" description="ورزشکار از اپ یا شما از «ثبت اندازه‌گیری» اولین مقدار را ثبت کنید." compact />
              ) : null}
            </>
          ) : null}
          {v.isNotes ? (
            <>
              <Card title="یادداشت‌ها" subtitle="فقط برای شما قابل مشاهده است" actionLabel="یادداشت جدید" onAction={v.openNote} padding="none">
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                  {(v.notes || []).map((nt: any, $index: number) => (
                    <Fragment key={$index}>
                      <ListRow icon="file-text" title={nt?.text} subtitle={nt?.date} chevron={false} />
                    </Fragment>
                  ))}
                  {v.notes.length ? null : <EmptyState icon="file-text" title="یادداشتی ندارید" compact />}
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </PanelLayout>
    );
  }
}
