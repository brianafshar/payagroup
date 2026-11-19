// Ported from design handoff: project/C18 Coach Create Program.dc.html
import { Button, NumberStepper, PageHeader, ProgramDay, RadioGroup, SegmentedControl, Select, Sidebar, TextField, TopBar } from '@/ds';
import { SPORTS } from '@/data/exercises';
import { PanelLayout } from '@/app/PanelLayout';
import { go } from '@/lib/nav';
import { api } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Data container: athletes and programs for the «copy from» and «for one athlete» options. */
export default function CoachCreateProgramPage(props: { brand?: string }) {
  const athletes = useQuery('athletes', () => api.athletes.list());
  const programs = useQuery('programs', () => api.programs.list());
  const exercises = useQuery('exercises', api.exercises.list);
  const wait = pending(athletes, programs, exercises);
  if (wait) return wait;
  return <CoachCreateProgram {...props} athletes={athletes.data} programs={programs.data} exercises={exercises.data} />;
}

class CoachCreateProgram extends Screen {
  state: ScreenState = {
    sport: 'fitness',
    name: '',
    goal: 'gain',
    weeks: 10,
    sessions: '4',
    from: 'blank',
    src: null,
    saveAs: 'template',
    athlete: null,
    tried: false,
    saving: false,
  };
  renderVals() {
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const { name, goal, weeks, sessions, from, src, saveAs, athlete, tried, saving } = this.state;
    const athletes = this.props.athletes.map((a) => ({ value: a.id, label: a.name }));
    const tplOpts = this.props.programs.filter((p) => p.kind === 'template').map((p) => ({ value: p.id, label: p.name + ' (v' + fa(p.version) + ')' }));
    const copyOpts = this.props.programs.filter((p) => p.kind !== 'template').map((p) => ({ value: p.id, label: (p.athleteName || '') + ' · ' + p.name }));
    // Preview: the first training day of the program being copied.
    const source = from === 'blank' ? null : this.props.programs.find((p) => p.id === src);
    const day = source?.weeks?.flatMap((w) => w.days).find((d) => !d.rest && d.exercises.length);
    const exName = (id) => this.props.exercises.find((e) => e.id === id)?.name || 'حرکت';
    const sample = (day?.exercises || []).slice(0, 4).map((x) => ({
      name: exName(x.exerciseId),
      sets: fa(x.sets.length) + ' × ' + fa(x.sets[0]?.reps || '—'),
      load: x.sets[0]?.value != null ? fa(x.sets[0].value) + ' kg' : undefined,
      rest: x.sets[0]?.restSec ? fa(x.sets[0].restSec) + ' ث' : undefined,
    }));
    const bad = { name: !name.trim(), ath: saveAs === 'one' && !athlete };
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'برنامه‌ها', to: 'coach:programs' }, 'برنامه جدید'],
      one: 1,
      two: 2,
      maxWeeks: 52,
      setName: (v) => this.setState({ name: v }),
      nameErr: tried && bad.name ? 'نام برنامه را وارد کنید.' : undefined,
      goals: [
        { value: 'gain', label: 'عضله‌سازی' },
        { value: 'loss', label: 'کاهش چربی' },
        { value: 'str', label: 'قدرت' },
        { value: 'gen', label: 'آمادگی عمومی' },
      ],
      setGoal: (v) => this.setState({ goal: v }),
      sports: SPORTS.map(([value, label]) => ({ value, label })),
      sport: this.state.sport,
      setSport: (v) => this.setState({ sport: v }),
      weeks,
      setWeeks: (v) => this.setState({ weeks: v }),
      sessionOpts: ['2', '3', '4', '5', '6'].map((v) => ({ value: v, label: fa(v) })),
      setSessions: (v) => this.setState({ sessions: v }),
      fromOpts: [
        { value: 'blank', label: 'برنامه خالی' },
        { value: 'tpl', label: 'کپی از یک قالب موجود', description: 'برنامه جدید از قالب مبدأ مستقل است.' },
        { value: 'ath', label: 'کپی از برنامه یک ورزشکار', description: 'برای تبدیل یک نسخه شخصی‌سازی‌شده به قالب جدید مفید است.' },
      ],
      setFrom: (v) => this.setState({ from: v, src: v === 'tpl' ? tplOpts[0]?.value : v === 'ath' ? copyOpts[0]?.value : null }),
      fromTpl: from === 'tpl',
      fromAth: from === 'ath',
      tplOpts,
      athOpts: copyOpts,
      setSrc: (v) => this.setState({ src: v }),
      saveOpts: [
        { value: 'template', label: 'قالب', description: 'قابل استفاده مجدد. به هر تعداد ورزشکار اختصاص دهید؛ هر کدام نسخه خودش را می‌گیرد.' },
        { value: 'one', label: 'برنامه برای یک ورزشکار', description: 'مستقیم برای یک ورزشکار ساخته می‌شود و در قالب‌ها نمایش داده نمی‌شود.' },
      ],
      setSaveAs: (v) => this.setState({ saveAs: v }),
      forOne: saveAs === 'one',
      athletes,
      setAthlete: (v) => this.setState({ athlete: v }),
      athErr: tried && bad.ath ? 'ورزشکار را انتخاب کنید.' : undefined,
      outline: fa(weeks) + ' هفته × ' + fa(sessions) + ' جلسه = ' + fa(weeks * +sessions) + ' روز تمرین',
      sample,
      sampleFocus: day?.focus || (source ? 'روز ۱' : 'برنامه خالی'),
      saving,
      next: () => {
        if (bad.name || bad.ath) return this.setState({ tried: true });
        this.setState({ saving: true });
        try {
          sessionStorage.setItem(
            'bl-new-program',
            JSON.stringify({
              name: name.trim(),
              sport: this.state.sport,
              goal,
              goalLabel: { gain: 'عضله‌سازی', loss: 'کاهش چربی', str: 'قدرت', gen: 'آمادگی عمومی' }[goal],
              weeks,
              sessions: +sessions,
              from,
              src: from === 'blank' ? null : src,
              saveAs,
              athleteId: saveAs === 'one' ? athlete : null,
              athlete: (athletes.find((a) => a.value === athlete) || {}).label || null,
            }),
          );
        } catch (e) {}
        setTimeout(() => go('coach:program-builder'), 400);
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
          <PageHeader title="ایجاد برنامه" subtitle="ساختار کلی را مشخص کنید، سپس هفته‌ها و روزها را بسازید." back="برنامه‌ها" backTo="coach:programs" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div
              style={{
                gridColumn: 'span 2',
                minWidth: '0',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                <TextField label="نام برنامه" placeholder="مثلاً هایپرتروفی — بالاتنه / پایین‌تنه" onChange={v.setName} error={v.nameErr} />
                <Select label="هدف" value="gain" options={v.goals} onChange={v.setGoal} />
                <Select label="رشته" value={v.sport} options={v.sports} onChange={v.setSport} />
                <NumberStepper label="مدت (هفته)" value={v.weeks} min={v.one} max={v.maxWeeks} unit="هفته" size="md" onChange={v.setWeeks} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: '500' }}>جلسه در هفته</span>
                <SegmentedControl options={v.sessionOpts} value="4" onChange={v.setSessions} label="جلسه در هفته" />
              </div>
              <TextField label="توضیحات" multiline rows={v.two} optional placeholder="این برنامه برای چه هدفی است و مناسب چه کسانی است" />
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <RadioGroup label="شروع از" value="blank" options={v.fromOpts} onChange={v.setFrom} />
              {v.fromTpl ? (
                <>
                  <Select label="قالب مبدأ" value="mg" options={v.tplOpts} onChange={v.setSrc} hint="برنامه جدید از این قالب مستقل است." />
                </>
              ) : null}
              {v.fromAth ? (
                <>
                  <Select label="برنامه ورزشکار مبدأ" value="c2" options={v.athOpts} onChange={v.setSrc} />
                </>
              ) : null}
              <RadioGroup label="ذخیره به‌عنوان" value="template" options={v.saveOpts} onChange={v.setSaveAs} />
              {v.forOne ? (
                <>
                  <Select label="ورزشکار" placeholder="انتخاب ورزشکار" options={v.athletes} onChange={v.setAthlete} error={v.athErr} />
                </>
              ) : null}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Button variant="ghost" to="coach:programs">
                  انصراف
                </Button>
                <Button variant="primary" iconRight="arrow-left" loading={v.saving} onClick={v.next}>
                  ادامه به برنامه‌ساز
                </Button>
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: '0',
              }}
            >
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>ساختار</h3>
              <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)', textWrap: 'pretty' }}>
                برنامه ← هفته‌ها ← روزها ← حرکات. هر حرکت نسخه خودش را دارد: ست، تکرار، وزنه، استراحت و RPE اختیاری.
              </p>
              <p style={{ margin: '0', fontSize: '13px', lineHeight: '20px', fontWeight: '600' }}>{v.outline}</p>
              <ProgramDay day="نمونه · روز ۱" focus={v.sampleFocus} readOnly compact exercises={v.sample} />
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
