// Ported from design handoff: project/C19 Coach Program Builder.dc.html
import { Fragment } from 'react';
import { Button, IconButton, Modal, PageHeader, SearchField, Select, Sidebar, Tabs, Tag, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { go, href, param } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { BAND_LEVELS, categoriesFor, EX_CATS, EX_EQUIP, PROGRAM_SPORTS, SPORT_LABEL } from '@/data/exercises';
import { QuickExerciseModal } from './QuickExerciseModal';
import { BuilderPreview } from './BuilderPreview';
import { api, faError } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { copySection, DAY_TIMES, daySections, fromBuilderWeeks, loadLabel, loadText, sessionsPerWeek, toBuilderWeeks } from '@/lib/programs';
import { panelUser } from '@/data/session';
import { clearDraft, draftAge, draftFor, readDraft, writeDraft } from '@/lib/builderDraft';
import { Screen } from '../Screen';

const toFa = (v: string | number) => String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const toEn = (v: string) => String(v ?? '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

/** Data container: the program in `?id=` (or a new one) and the exercise library. */
export default function CoachProgramBuilderPage(props: { brand?: string }) {
  const id = param('id') || '';
  const exercises = useQuery('exercises', api.exercises.list);
  const program = useQuery('program:' + id, () => (id ? api.programs.get(id) : Promise.resolve(null)));
  const wait = pending(exercises, program);
  if (wait) return wait;
  return <CoachProgramBuilder key={program.data?.id || 'new'} {...props} exercises={exercises.data} program={program.data} />;
}

class CoachProgramBuilder extends Screen {
  constructor(p) {
    super(p);
    this.state = { ...this.liveInit(p), w: 0, sel: 0, hist: [], libQ: '', libCats: [], modal: null, dropDay: null, saving: false };
    // An unsaved draft of this program on this device: continue it or start over. «ادامه» on the programs
    // page asks for it straight away; a program just made in C18 starts fresh.
    const draft = readDraft();
    let fresh = false,
      resume = false;
    try {
      fresh = !!sessionStorage.getItem('bl-new-program');
      resume = sessionStorage.getItem('bl-builder-resume') === '1';
    } catch {
      /* storage unavailable */
    }
    if (!fresh && draftFor(draft, p.program?.id || '')) {
      this.state = { ...this.state, ...(resume ? this.fromDraft(draft) : { draftAsk: draft }) };
    }
  }
  draftTimer: ReturnType<typeof setTimeout> | null = null;

  fromDraft(d) {
    return { meta: d.meta, weeks: d.weeks, extraSec: d.extraSec || {}, w: Math.min(d.w || 0, d.weeks.length - 1), sel: d.sel || 0, dirty: true, hist: [], draftAsk: null };
  }

  /** Keep every edit in this browser until it is saved (lib/builderDraft). */
  componentDidUpdate(_pp, ps) {
    const { meta, weeks, extraSec, w, sel, dirty, draftAsk } = this.state;
    if (draftAsk) return;
    if (!dirty) {
      if (ps.dirty) clearDraft();
      return;
    }
    if (ps.weeks === weeks && ps.meta === meta && ps.extraSec === extraSec) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => writeDraft({ id: meta.id ? String(meta.id) : null, meta, weeks, extraSec, w, sel }), 300);
  }

  warnLeave = (e: BeforeUnloadEvent) => {
    if (!this.state.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  };

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.warnLeave);
    // Flush a pending write: leaving for the library right after an edit must not lose it.
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      const { meta, weeks, extraSec, w, sel, dirty, draftAsk } = this.state;
      if (dirty && !draftAsk) writeDraft({ id: meta.id ? String(meta.id) : null, meta, weeks, extraSec, w, sel });
    }
  }
  /** Start: an existing program, a new one from C18 (optionally copied from another), or blank. */
  liveInit(p) {
    const read = (k) => {
      try {
        return JSON.parse(sessionStorage.getItem(k) || 'null');
      } catch {
        return null;
      }
    };
    const ret = read('bl-builder-return');
    const EXL = p.exercises;
    if (p.program) {
      const pr = p.program;
      return {
        meta: {
          id: pr.id,
          name: pr.name,
          goal: pr.goal,
          sport: pr.sport,
          time: pr.time || '',
          kind: pr.kind === 'template' ? 'template' : 'one',
          athlete: pr.athleteName,
          version: 'v' + pr.version,
        },
        weeks: toBuilderWeeks(pr.weeks, EXL),
        dirty: false,
        ret,
      };
    }
    // Removed in componentDidMount, not here: React may construct a screen twice (StrictMode), and the
    // second construction must still find the name and settings the coach chose (#61).
    const np = read('bl-new-program');
    if (np) {
      const n = Math.max(1, Math.min(6, np.sessions || 3));
      const focus = ['بالاتنه A', 'پایین‌تنه A', 'بالاتنه B', 'پایین‌تنه B', 'تمام بدن', 'هوازی'];
      return {
        meta: {
          name: np.name,
          goal: np.goalLabel,
          sport: np.sport || 'fitness',
          kind: np.saveAs === 'one' ? 'one' : 'template',
          athlete: np.athlete,
          athleteId: np.athleteId,
          src: np.src,
          version: 'پیش‌نویس',
          isNew: true,
        },
        weeks: Array.from({ length: Math.max(1, Math.min(52, np.weeks || 4)) }, () => ({ days: Array.from({ length: n }, (_, i) => ({ focus: focus[i], ex: [] })) })),
        dirty: true,
        ret,
      };
    }
    return { meta: { name: 'برنامه جدید', kind: 'template', version: 'پیش‌نویس', isNew: true }, weeks: [{ days: [{ focus: 'روز ۱', ex: [] }] }], dirty: true, ret };
  }

  async componentDidMount() {
    window.addEventListener('beforeunload', this.warnLeave);
    try {
      sessionStorage.removeItem('bl-new-program');
      sessionStorage.removeItem('bl-builder-resume');
    } catch {
      /* storage unavailable */
    }
    // «کپی از قالب / از برنامه ورزشکار»: start from the source program's weeks.
    const src = this.state.meta?.src;
    if (!src) return;
    try {
      const pr = await api.programs.get(src);
      if (pr) this.setState({ weeks: toBuilderWeeks(pr.weeks, this.props.exercises) });
    } catch (e) {
      toast('برنامه مبدأ بارگذاری نشد', faError(e), 'error');
    }
  }

  /** Save to the API; returns false on failure. */
  async saveLive(): Promise<boolean> {
    const { meta, weeks } = this.state;
    const body = {
      name: meta.name,
      goal: meta.goal || '',
      ...(meta.sport ? { sport: meta.sport } : {}),
      time: meta.time || '',
      durationWeeks: weeks.length,
      sessionsPerWeek: sessionsPerWeek(weeks),
      weeks: fromBuilderWeeks(weeks),
    };
    this.setState({ saving: true });
    try {
      const saved = meta.id ? await api.programs.update(meta.id, body) : await api.programs.create({ ...body, ...(meta.athleteId ? { forAthlete: meta.athleteId } : {}) });
      if (this.draftTimer) clearTimeout(this.draftTimer);
      clearDraft();
      this.setState({ meta: { ...meta, id: saved.id, isNew: false, src: null, version: 'v' + saved.version }, dirty: false, saving: false });
      window.history.replaceState(null, '', '?id=' + saved.id);
      return true;
    } catch (e) {
      this.setState({ saving: false });
      toast('برنامه ذخیره نشد', faError(e), 'error');
      return false;
    }
  }

  /** #103: copy a day's section (صبح / شب…) to a section of another day. */
  openCopy(d: number, t: string) {
    const { w, weeks } = this.state;
    const n = weeks[w].days.length;
    this.setState({ copySec: { w, d, t, tw: w, td: d + 1 < n ? d + 1 : Math.max(0, d - 1), tt: t, mode: 'replace' } });
  }

  renderCopy() {
    const c = this.state.copySec;
    if (!c) return null;
    const { weeks } = this.state;
    const fa = (n) => String(n).replace(/\d/g, (x) => '۰۱۲۳۴۵۶۷۸۹'[x]);
    const names = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const tl = (t) => (DAY_TIMES.find(([k]) => k === t) || [])[1] || 'بدون زمان';
    const src = weeks[c.w].days[c.d];
    const count = src.ex.filter((e) => (e.time || src.time || '') === c.t).length;
    const set = (patch) => this.setState({ copySec: { ...c, ...patch } });
    const dayLabel = (i, d) => names[i] + ' · ' + (d.focus || 'روز ' + fa(i + 1));
    return (
      <Modal
        title="کپی بخش تمرین"
        description={'بخش «' + tl(c.t) + '» از ' + dayLabel(c.d, src) + (weeks.length > 1 ? ' (هفته ' + fa(c.w + 1) + ')' : '') + ' · ' + fa(count) + ' حرکت'}
        primaryLabel="کپی کن"
        secondaryLabel="انصراف"
        primaryDisabled={!count || (c.tw === c.w && c.td === c.d && c.tt === c.t)}
        onSecondary={() => this.setState({ copySec: null })}
        onClose={() => this.setState({ copySec: null })}
        onPrimary={() => {
          const nw = copySection(weeks, { w: c.w, d: c.d, t: c.t }, { w: c.tw, d: c.td, t: c.tt }, c.mode);
          this.setState({ weeks: nw, hist: [...this.state.hist.slice(-29), weeks], dirty: true, copySec: null, w: c.tw, sel: c.td });
          toast('بخش کپی شد', fa(count) + ' حرکت به ' + dayLabel(c.td, nw[c.tw].days[c.td]) + ' · ' + tl(c.tt) + ' رفت.');
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px' }}>
          {weeks.length > 1 ? (
            <Select
              label="هفته"
              value={String(c.tw)}
              options={weeks.map((_, i) => ({ value: String(i), label: 'هفته ' + fa(i + 1) }))}
              onChange={(v) => set({ tw: +v, td: Math.min(c.td, weeks[+v].days.length - 1) })}
            />
          ) : null}
          <Select
            key={'d' + c.tw}
            label="به روز"
            value={String(c.td)}
            options={weeks[c.tw].days.map((d, i) => ({ value: String(i), label: dayLabel(i, d) }))}
            onChange={(v) => set({ td: +v })}
          />
          <Select label="بخش" value={c.tt || 'none'} options={DAY_TIMES.map(([k, l]) => ({ value: k || 'none', label: l }))} onChange={(v) => set({ tt: v === 'none' ? '' : v })} />
          <Select
            label="اگر آن بخش حرکت دارد"
            value={c.mode}
            options={[
              { value: 'replace', label: 'جایگزین شود' },
              { value: 'append', label: 'به انتهایش اضافه شود' },
            ]}
            onChange={(v) => set({ mode: v })}
          />
        </div>
      </Modal>
    );
  }

  renderVals() {
    const EX = this.props.exercises,
      CATS = EX_CATS || {},
      EQ = EX_EQUIP || {};
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const { meta, weeks, w, sel, hist, libQ, libCats, modal, dropDay, dropAt, dragging, dirty, saving, ret } = this.state;
    const week = weeks[w] || weeks[0];
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const commit = (fn, extra?) => {
      const nw = clone(weeks);
      fn(nw);
      this.setState({ weeks: nw, hist: [...hist.slice(-29), weeks], dirty: true, ...(extra || {}) });
    };
    const newEx = (x) => {
      // Distance/time exercises (runs, intervals) start as one set; weights as 3 × 10.
      const cardio = ['km', 'm', 's', 'min'].includes(x.unit);
      return {
        uid: Math.random().toString(36).slice(2),
        exId: x.id,
        name: x.name,
        sets: cardio ? 1 : 3,
        reps: cardio ? '۱' : '۱۰',
        load: '',
        rest: cardio ? '' : '۶۰',
        rpe: '',
        note: '',
        unit: x.unit || 'kg',
      };
    };
    // A day can hold several sessions (صبح / عصر / شب…): each exercise has the time of its section;
    // '' means it follows the day's time. New exercises go to the day's active section.
    const secKey = (di) => w + '-' + di;
    const effTime = (day, e) => e.time || day.time || '';
    const norm = (day, t) => (t === (day.time || '') ? '' : t);
    const activeSec = (di) => {
      const secs = daySections(week.days[di], (this.state.extraSec || {})[secKey(di)]);
      const want = (this.state.secSel || {})[secKey(di)];
      return secs.includes(want) ? want : secs[secs.length - 1];
    };
    const exIn = (di, x, t?) => ({ ...newEx(x), time: norm(week.days[di], t ?? activeSec(di)) });
    const addTo = (di, x, t?) => {
      commit((nw) => nw[w].days[di].ex.push(exIn(di, x, t)), { sel: di });
      toast('«' + x.name + '» اضافه شد', week.days[di] ? 'به روز ' + fa(di + 1) + ' · ' + (week.days[di].focus || '') : '');
    };
    const dayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const rx = (e) =>
      [
        { t: fa(e.sets) + ' ست × ' + (e.reps || '—') + ' تکرار', dir: 'rtl' },
        e.load ? { t: loadText(e.unit, e.load), dir: e.unit === 'band' ? 'rtl' : 'ltr' } : null,
        e.rest ? { t: 'استراحت ' + e.rest + ' ث', dir: 'rtl' } : null,
        e.rpe ? { t: 'RPE ' + fa(e.rpe), dir: 'ltr' } : null,
      ].filter(Boolean);
    // The chips are the program's sport: its own categories plus strength (#75). A search looks in every
    // sport (#101) — one program can mix gym work with a run or intervals.
    const sportCats = categoriesFor(meta.sport);
    const libOn = libCats.filter((k) => sportCats.includes(k));
    const q = libQ.trim();
    const lib = EX.filter(
      (x) => (q || !(x.cat in CATS) || sportCats.includes(x.cat)) && (!libOn.length || libOn.includes(x.cat)) && (!q || (x.name + ' ' + (CATS[x.cat] || '')).includes(q)),
    );
    const ownSport = meta.sport || 'fitness';
    const totalSets = (d) => d.ex.reduce((a, e) => a + (+e.sets || 0), 0);
    const m = modal && week.days[modal.d] && week.days[modal.d].ex[modal.i] ? { ...week.days[modal.d].ex[modal.i], ...modal.draft } : null;
    // Library v2: swap for a band or no-equipment alternative, keeping sets and reps; kilos become a band level.
    const mEx = m ? EX.find((x) => x.id === m.exId) : null;
    const swapOpts = [...(mEx?.alternatives?.band || []).map((id) => ['با کش', id]), ...(mEx?.alternatives?.home || []).map((id) => ['بدون وسیله', id])]
      .map(([kind, id]) => [kind, EX.find((x) => x.id === id)])
      .filter(([, x]) => x)
      .map(([kind, x]) => ({ value: x.id, label: kind + ': ' + x.name }));
    const swapTo = (id) => {
      const x = EX.find((y) => y.id === id);
      if (!x) return;
      const kg = m.unit === 'kg' ? parseFloat(toEn(m.load)) : NaN;
      const unit = x.unit || 'kg';
      const load = unit === 'band' ? toFa(Number.isFinite(kg) && kg > 0 ? Math.min(5, Math.max(1, Math.ceil(kg / 15))) : 2) : unit === m.unit ? m.load : '';
      this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, exId: x.id, name: x.name, unit, load } } }));
      toast('جایگزین شد: «' + x.name + '»', 'ست‌ها و تکرارها همان ماند' + (unit === 'band' ? '؛ وزنه به شدت کش تبدیل شد.' : '.'));
    };
    const imgOf = new Map(EX.map((x) => [x.id, x.imageSrc]));
    const nDaysTotal = weeks.reduce((a, wk) => a + wk.days.length, 0);
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'برنامه‌ها', to: 'coach:programs' }, meta.name, 'هفته ' + fa(w + 1)],
      backLabel: ret ? ret.label : 'برنامه‌ها',
      backTo: ret ? ret.to : 'coach:programs',
      title: meta.name,
      subtitle:
        (meta.kind === 'one' ? 'برنامه اختصاصی' + (meta.athlete ? ' · ' + meta.athlete : '') : 'قالب ' + meta.version) +
        ' · ' +
        fa(weeks.length) +
        ' هفته · ' +
        fa(nDaysTotal) +
        ' روز تمرین' +
        (dirty ? ' · تغییرات ذخیره‌نشده' : ' · همه تغییرات ذخیره شده'),
      badges: [
        meta.kind === 'one' ? { label: 'برنامه شخصی', tone: 'brand', icon: 'git-branch' } : { label: 'قالب ' + meta.version, tone: 'neutral', icon: 'layers' },
        ...(dirty ? [{ label: 'در حال ویرایش', tone: 'info', icon: 'edit' }] : []),
      ],
      noUndo: hist.length === 0,
      undo: () => {
        if (!hist.length) return;
        this.setState({ weeks: hist[hist.length - 1], hist: hist.slice(0, -1), w: Math.min(w, hist[hist.length - 1].length - 1), dirty: true });
      },
      preview: () => this.setState({ preview: true }),
      programTime: (DAY_TIMES.find(([k]) => k && k === meta.time) || [])[1] || '',
      openMeta: () => this.setState({ metaEdit: { name: meta.name, goal: meta.goal || '', sport: meta.sport || 'fitness', time: meta.time || '' } }),
      hasReturn: !!ret,
      returnLabel: ret ? 'ذخیره و ' + ret.label : '',
      saveReturn: async () => {
        if (!(await this.saveLive())) return;
        try {
          sessionStorage.removeItem('bl-builder-return');
        } catch (e) {}
        go(ret.to, { title: 'برنامه شخصی ذخیره شد', desc: '«' + meta.name + '» آماده اختصاص است.' });
      },
      saving,
      saveLabel: meta.kind === 'one' ? 'ذخیره برنامه' : 'ذخیره قالب',
      save: async () => {
        if (await this.saveLive()) toast('برنامه ذخیره شد', meta.kind === 'one' ? 'تغییرات برای این ورزشکار اعمال شد.' : 'ورزشکارانی که نسخه دارند تحت تأثیر قرار نمی‌گیرند.');
      },
      weekId: 'w' + w,
      weekTabs: weeks.map((_, i) => ({ id: 'w' + i, label: 'هفته ' + fa(i + 1) })),
      pickWeek: (id) => this.setState({ w: +id.slice(1), sel: 0 }),
      dupWeek: () => {
        commit((nw) => nw.splice(w + 1, 0, clone(nw[w])), { w: w + 1 });
        toast('هفته کپی شد', 'هفته ' + fa(w + 2) + ' از روی هفته ' + fa(w + 1) + ' ساخته شد.');
      },
      addWeek: () => commit((nw) => nw.push({ days: nw[nw.length - 1].days.map((d) => ({ focus: d.focus, time: d.time, ex: [] })) }), { w: weeks.length }),
      oneWeek: weeks.length <= 1,
      removeWeek: () => {
        if (weeks.length <= 1) return;
        commit((nw) => nw.splice(w, 1), { w: Math.max(0, w - 1) });
        toast('هفته ' + fa(w + 1) + ' حذف شد', 'با «واگرد» برمی‌گردد.');
      },
      libHref: href('coach:library'),
      libPh: 'جستجو در ' + fa(EX.length) + ' حرکت',
      setLibQ: (v) => this.setState({ libQ: v }),
      catChips: sportCats.map((k) => ({
        label: CATS[k],
        on: libOn.includes(k),
        toggle: () => this.setState({ libCats: libCats.includes(k) ? libCats.filter((x) => x !== k) : [...libCats, k] }),
      })),
      libEmpty: lib.length === 0,
      libItems: lib.map((x) => ({
        name: x.name,
        meta: [(x.sport || 'fitness') !== ownSport ? SPORT_LABEL[x.sport || 'fitness'] : '', CATS[x.cat], EQ[x.equip]].filter(Boolean).join(' · '),
        icon: x.video ? '▶' : '▢',
        img: x.imageSrc || null,
        addTitle: 'افزودن به روز ' + fa(sel + 1),
        add: () => (week.days.length ? addTo(Math.min(sel, week.days.length - 1), x) : toast('روزی وجود ندارد', 'اول یک روز تمرین اضافه کنید.', 'error')),
        dragStart: (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ lib: x.id }));
          e.dataTransfer.effectAllowed = 'copy';
        },
      })),
      quickTarget: week.days.length
        ? (() => {
            const di = Math.min(sel, week.days.length - 1);
            const t = activeSec(di);
            const tl = (DAY_TIMES.find(([k]) => k && k === t) || [])[1];
            return dayNames[di] + ' (روز ' + fa(di + 1) + ')' + (tl ? ' · بخش ' + tl : '');
          })()
        : '',
      openQuick: () => (week.days.length ? this.setState({ quickEx: true }) : toast('روزی وجود ندارد', 'اول یک روز تمرین اضافه کنید.', 'error')),
      quickAdd: (x) => {
        this.setState({ quickEx: false });
        addTo(Math.min(sel, week.days.length - 1), x);
      },
      libHint: 'حرکت را روی یک روز بکشید، یا + بزنید تا به روز انتخاب‌شده (روز ' + fa(sel + 1) + ') اضافه شود.',
      dragEnd: () => this.setState({ dropDay: null, dropAt: null, dragging: null }),
      stop: (e) => e.stopPropagation(),
      days: week.days.map((d, di) => {
        const on = di === sel,
          drop = di === dropDay;
        return {
          label: dayNames[di] + ' · روز ' + fa(di + 1),
          focus: d.focus || '',
          time: d.time || '',
          setTime: (e) => commit((nw) => (nw[w].days[di].time = e.target.value)),
          border: drop ? '2px dashed var(--brand-primary)' : on ? '1.5px solid var(--brand-primary)' : '1px solid var(--border)',
          shadow: on ? 'var(--shadow-1)' : 'none',
          selTag: on ? 'انتخاب‌شده' : '',
          select: () => {
            if (sel !== di) this.setState({ sel: di });
          },
          setFocus: (e) => {
            const v = e.target.value;
            const nw = clone(weeks);
            nw[w].days[di].focus = v;
            this.setState({ weeks: nw, dirty: true });
          },
          remove: (e) => {
            e.stopPropagation();
            commit((nw) => nw[w].days.splice(di, 1), { sel: Math.max(0, Math.min(sel, week.days.length - 2)) });
            toast('روز ' + fa(di + 1) + ' حذف شد', 'با «واگرد» برمی‌گردد.');
          },
          dragOver: (e) => {
            e.preventDefault();
            if (dropDay !== di) this.setState({ dropDay: di });
          },
          dragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) this.setState({ dropDay: null });
          },
          drop: (e) => {
            e.preventDefault();
            this.setState({ dropDay: null, dropAt: null, dragging: null });
            let data;
            try {
              data = JSON.parse(e.dataTransfer.getData('text/plain'));
            } catch (er) {
              return;
            }
            if (data.lib) {
              const x = EX.find((y) => y.id === data.lib);
              if (x) addTo(di, x);
            } else if (data.from != null) {
              commit(
                (nw) => {
                  const [it] = nw[w].days[data.from].ex.splice(data.i, 1);
                  it.time = norm(nw[w].days[di], activeSec(di));
                  nw[w].days[di].ex.push(it);
                },
                { sel: di },
              );
            }
          },
          ...(() => {
            const extra = (this.state.extraSec || {})[secKey(di)] || [];
            const secs = daySections(d, extra);
            const act = activeSec(di);
            const label = (t) => (DAY_TIMES.find(([k]) => k === t) || [])[1] || '';
            const progTime = label(meta.time || '') && meta.time ? label(meta.time) : '';
            const setSec = (patch) => this.setState((st) => ({ secSel: { ...(st.secSel || {}), [secKey(di)]: patch } }));
            return {
              multi: secs.length > 1,
              sections: secs.map((t) => ({
                key: t || 'none',
                time: t,
                label: t ? label(t) : progTime ? progTime + ' (برنامه)' : 'بدون زمان',
                // «افزودن به اینجا» only on the selected day's section (#103)
                active: on && t === act,
                copy: (ev) => {
                  ev.stopPropagation();
                  this.openCopy(di, t);
                },
                pick: (ev) => {
                  ev.stopPropagation();
                  setSec(t);
                  if (sel !== di) this.setState({ sel: di });
                },
                // Change a section's time: its exercises (and the day, for the day's own section) move with it.
                retime: (ev) => {
                  const nt = ev.target.value;
                  commit((nw) => {
                    const day = nw[w].days[di];
                    const base = day.time || '';
                    day.ex.forEach((x) => {
                      if ((x.time || base) === t) x.time = nt;
                    });
                    if (t === base) day.time = nt;
                    day.ex.forEach((x) => {
                      if (x.time === (day.time || '')) x.time = '';
                    });
                  });
                  this.setState((st) => ({
                    extraSec: { ...(st.extraSec || {}), [secKey(di)]: extra.map((x) => (x === t ? nt : x)) },
                    secSel: { ...(st.secSel || {}), [secKey(di)]: nt },
                  }));
                },
                timeOpts: DAY_TIMES.filter(([k]) => k === t || !secs.includes(k)).map(([k, l]) => [k, k ? l : progTime ? progTime + ' (برنامه)' : l]),
                removable: !d.ex.some((x) => effTime(d, x) === t) && t !== (d.time || ''),
                remove: (ev) => {
                  ev.stopPropagation();
                  this.setState((st) => ({ extraSec: { ...(st.extraSec || {}), [secKey(di)]: extra.filter((x) => x !== t) } }));
                },
                dragOver: (ev) => {
                  ev.preventDefault();
                  if (dropDay !== di) this.setState({ dropDay: di });
                },
                drop: (ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  this.setState({ dropDay: null, dropAt: null, dragging: null });
                  let data;
                  try {
                    data = JSON.parse(ev.dataTransfer.getData('text/plain'));
                  } catch (er) {
                    return;
                  }
                  if (data.lib) {
                    const x = EX.find((y) => y.id === data.lib);
                    if (x) addTo(di, x, t);
                  } else if (data.from != null) {
                    commit(
                      (nw) => {
                        const [it] = nw[w].days[data.from].ex.splice(data.i, 1);
                        it.time = norm(nw[w].days[di], t);
                        nw[w].days[di].ex.push(it);
                      },
                      { sel: di },
                    );
                  }
                },
                idx: d.ex.map((x, i) => (effTime(d, x) === t ? i : -1)).filter((i) => i >= 0),
              })),
              addSecOpts: DAY_TIMES.filter(([k]) => k && !secs.includes(k)),
              addSec: (ev) => {
                const t = ev.target.value;
                if (!t) return;
                ev.target.value = '';
                if (!d.time && !d.ex.length) {
                  commit((nw) => (nw[w].days[di].time = t));
                } else {
                  this.setState((st) => ({ extraSec: { ...(st.extraSec || {}), [secKey(di)]: [...extra, t] } }));
                }
                setSec(t);
                if (sel !== di) this.setState({ sel: di });
              },
            };
          })(),
          copyDay: (ev) => {
            ev.stopPropagation();
            this.openCopy(di, (d.time || '') as string);
          },
          empty: d.ex.length === 0,
          summary: d.ex.length ? fa(d.ex.length) + ' حرکت · ' + fa(totalSets(d)) + ' ست · حدود ' + fa(Math.round(totalSets(d) * 2.8)) + ' دقیقه' : 'بدون حرکت',
          ex: d.ex.map((e, i) => ({
            code: String.fromCharCode(65 + i),
            name: e.name,
            img: imgOf.get(e.exId) || null,
            rxParts: rx(e),
            note: e.note,
            hasNote: !!e.note,
            edit: (ev) => {
              ev.stopPropagation();
              this.setState({ sel: di, modal: { d: di, i, draft: {} } });
            },
            remove: (ev) => {
              ev.stopPropagation();
              commit((nw) => nw[w].days[di].ex.splice(i, 1));
              toast('«' + e.name + '» حذف شد', 'با «واگرد» برمی‌گردد.');
            },
            dropLine: dropAt && dropAt.d === di && dropAt.i === i ? '0 -3px 0 0 var(--brand-primary)' : 'none',
            opacity: dragging && dragging.d === di && dragging.i === i ? 0.4 : 1,
            dragStart: (ev) => {
              ev.stopPropagation();
              ev.dataTransfer.setData('text/plain', JSON.stringify({ from: di, i }));
              ev.dataTransfer.effectAllowed = 'move';
              setTimeout(() => this.setState({ dragging: { d: di, i } }), 0);
            },
            dragOver: (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              if (!dropAt || dropAt.d !== di || dropAt.i !== i || dropDay !== di) this.setState({ dropAt: { d: di, i }, dropDay: di });
            },
            drop: (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              this.setState({ dropDay: null, dropAt: null, dragging: null });
              let data;
              try {
                data = JSON.parse(ev.dataTransfer.getData('text/plain'));
              } catch (er) {
                return;
              }
              if (data.lib) {
                const x = EX.find((y) => y.id === data.lib);
                if (!x) return;
                commit((nw) => nw[w].days[di].ex.splice(i, 0, exIn(di, x, effTime(d, e))), { sel: di });
                toast('«' + x.name + '» اضافه شد');
                return;
              }
              if (data.from == null) return;
              commit(
                (nw) => {
                  const src = nw[w].days[data.from].ex;
                  const [it] = src.splice(data.i, 1);
                  let at = i;
                  if (data.from === di && data.i < i) at = i - 1;
                  it.time = norm(nw[w].days[di], effTime(d, e));
                  nw[w].days[di].ex.splice(at, 0, it);
                },
                { sel: di },
              );
            },
          })),
        };
      }),
      addDay: () => commit((nw) => nw[w].days.push({ focus: '', ex: [] }), { sel: week.days.length }),
      maxDays: week.days.length >= 7,
      restNote:
        'روزهای استراحت این هفته: ' +
        (['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'].slice(week.days.length).join('، ') || 'ندارد') +
        ' · با «افزودن روز تمرین» روز جدید بسازید.',
      one: 1,
      ten: 10,
      modalOpen: !!m,
      mTitle: m ? m.name : '',
      mDesc: m ? 'هفته ' + fa(w + 1) + ' · ' + dayNames[modal.d] + ' · ' + (week.days[modal.d].focus || '') : '',
      mSets: m ? +m.sets : 3,
      mReps: m ? m.reps : '',
      mLoad: m ? m.load : '',
      mLoadLabel: loadLabel(m?.unit).label,
      mLoadSuffix: loadLabel(m?.unit).suffix,
      mLoadPh: { km: '۵', m: '۴۰۰', s: '۶۰', min: '۳۰' }[m?.unit] || '۶۰',
      mBand: m?.unit === 'band',
      mBandLevel: m ? toEn(m.load) || 'none' : 'none',
      bandOpts: [{ value: 'none', label: 'انتخاب کنید' }, ...BAND_LEVELS.map((b) => ({ value: String(b.level), label: b.label }))],
      mSetBand: (v) => this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, load: v === 'none' ? '' : toFa(v) } } })),
      swapOpts,
      swapTo,
      mRest: m ? m.rest : '',
      mRpe: m ? m.rpe || 'none' : 'none',
      mNote: m ? m.note : '',
      mDay: m ? String(modal.d) : '0',
      rpeOpts: [{ value: 'none', label: 'بدون RPE' }, ...[6, 7, 8, 9, 10].map((v) => ({ value: String(v), label: 'RPE ' + fa(v) }))],
      dayOpts: week.days.map((d, i) => ({ value: String(i), label: dayNames[i] + ' · ' + (d.focus || 'بدون عنوان') })),
      mSetsLabel: m ? fa(m.sets) : '',
      mSetsDec: () => this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, sets: Math.max(1, (+m.sets || 1) - 1) } } })),
      mSetsInc: () => this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, sets: Math.min(10, (+m.sets || 0) + 1) } } })),
      mSetReps: (v) => this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, reps: v } } })),
      mSetLoad: (v) => this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, load: v } } })),
      mSetRest: (v) => this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, rest: v } } })),
      mSetRpe: (v) => this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, rpe: v === 'none' ? '' : v } } })),
      mSetNote: (v) => this.setState((s) => ({ modal: { ...s.modal, draft: { ...s.modal.draft, note: v } } })),
      mSetDay: (v) => this.setState((s) => ({ modal: { ...s.modal, moveTo: +v } })),
      mClose: () => this.setState({ modal: null }),
      mRemove: () => {
        const { d, i } = modal;
        commit((nw) => nw[w].days[d].ex.splice(i, 1), { modal: null });
        toast('«' + m.name + '» حذف شد', 'با «واگرد» برمی‌گردد.');
      },
      mSave: () => {
        const { d, i, draft, moveTo } = modal;
        commit(
          (nw) => {
            const a = nw[w].days[d].ex;
            a[i] = { ...a[i], ...draft };
            if (moveTo != null && moveTo !== d) {
              const [it] = a.splice(i, 1);
              nw[w].days[moveTo].ex.push(it);
            }
          },
          { modal: null, sel: moveTo != null ? moveTo : d },
        );
      },
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="programs" collapsed user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
        overlays={
          <>
            {this.state.preview ? (
              <BuilderPreview
                weeks={this.state.weeks}
                week={this.state.w}
                day={Math.min(this.state.sel ?? 0, (this.state.weeks[this.state.w]?.days.length || 1) - 1)}
                exercises={this.props.exercises}
                programName={this.state.meta.name}
                onDay={(wk, d) => this.setState({ w: wk, sel: d })}
                onClose={() => this.setState({ preview: false })}
              />
            ) : null}
            {this.renderCopy()}
            {this.state.quickEx ? (
              <QuickExerciseModal sport={this.state.meta.sport} target={v.quickTarget} onCreated={v.quickAdd} onClose={() => this.setState({ quickEx: false })} />
            ) : null}
            {this.state.draftAsk ? (
              <Modal
                title="برنامهٔ ذخیره‌نشده"
                description={
                  '«' + (this.state.draftAsk.meta?.name || 'برنامه') + '» را ذخیره نکرده بودید · آخرین تغییر ' + draftAge(this.state.draftAsk) + '. از همان‌جا ادامه می‌دهید؟'
                }
                primaryLabel="ادامه بده"
                secondaryLabel="از نو شروع کن"
                onPrimary={() => this.setState(this.fromDraft(this.state.draftAsk))}
                onSecondary={() => {
                  clearDraft();
                  this.setState({ draftAsk: null });
                }}
                onClose={() => this.setState(this.fromDraft(this.state.draftAsk))}
              >
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '22px', color: 'var(--text-secondary)' }}>
                  پیش‌نویس فقط روی همین دستگاه نگه داشته می‌شود تا «ذخیره» را بزنید؛ با خروج از حساب یا ۳ ساعت بدون تغییر پاک می‌شود.
                </p>
              </Modal>
            ) : null}
            {this.state.metaEdit ? (
              <Modal
                title="مشخصات برنامه"
                description="نام، هدف و رشته برنامه. با «ذخیره» بالای صفحه ثبت می‌شود."
                primaryLabel="اعمال"
                secondaryLabel="انصراف"
                onPrimary={() => {
                  const m = this.state.metaEdit;
                  if (!m.name.trim()) return toast('نام برنامه خالی است', 'یک نام وارد کنید.', 'error');
                  this.setState({ meta: { ...this.state.meta, name: m.name.trim(), goal: m.goal.trim(), sport: m.sport, time: m.time }, metaEdit: null, dirty: true });
                }}
                onClose={() => this.setState({ metaEdit: null })}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <TextField label="نام برنامه" value={this.state.metaEdit.name} onChange={(x) => this.setState({ metaEdit: { ...this.state.metaEdit, name: x } })} />
                  <TextField
                    label="هدف"
                    optional
                    placeholder="مثلاً عضله‌سازی"
                    value={this.state.metaEdit.goal}
                    onChange={(x) => this.setState({ metaEdit: { ...this.state.metaEdit, goal: x } })}
                  />
                  <Select
                    label="رشته"
                    value={this.state.metaEdit.sport}
                    options={(PROGRAM_SPORTS.some(([k]) => k === this.state.metaEdit?.sport) ? PROGRAM_SPORTS : [...PROGRAM_SPORTS, [this.state.metaEdit?.sport, SPORT_LABEL[this.state.metaEdit?.sport ?? ''] ?? this.state.metaEdit?.sport]]).map(([value, label]) => ({ value: value as string, label: label as string }))}
                    onChange={(x) => this.setState({ metaEdit: { ...this.state.metaEdit, sport: x } })}
                  />
                  <Select
                    label="زمان جلسات"
                    hint="زمان پیش‌فرض همه روزهای این برنامه؛ هر روز می‌تواند زمان خودش را داشته باشد."
                    value={this.state.metaEdit.time || 'none'}
                    options={DAY_TIMES.map(([value, label]) => ({ value: value || 'none', label }))}
                    onChange={(x) => this.setState({ metaEdit: { ...this.state.metaEdit, time: x === 'none' ? '' : x } })}
                  />
                </div>
              </Modal>
            ) : null}
            {v.modalOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal title={v.mTitle} description={v.mDesc} primaryLabel="ذخیره" secondaryLabel="حذف از روز" onSecondary={v.mRemove} onPrimary={v.mSave} onClose={v.mClose}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '0' }}>
                        <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: '500' }}>ست</span>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            height: '40px',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface)',
                            overflow: 'hidden',
                          }}
                        >
                          <button
                            className="hv-subtle"
                            type="button"
                            onClick={v.mSetsDec}
                            aria-label="کاهش ست"
                            style={{
                              width: '40px',
                              height: '100%',
                              flexShrink: '0',
                              border: '0',
                              background: 'var(--surface-sunken)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              font: "600 18px/1 'Vazirmatn',sans-serif",
                            }}
                          >
                            −
                          </button>
                          <span style={{ flex: '1', textAlign: 'center', font: "600 16px/1 'Vazirmatn',sans-serif" }}>{v.mSetsLabel}</span>
                          <button
                            className="hv-subtle"
                            type="button"
                            onClick={v.mSetsInc}
                            aria-label="افزایش ست"
                            style={{
                              width: '40px',
                              height: '100%',
                              flexShrink: '0',
                              border: '0',
                              background: 'var(--surface-sunken)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              font: "600 18px/1 'Vazirmatn',sans-serif",
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <TextField label="تکرار" value={v.mReps} placeholder="مثلاً ۸–۱۰" onChange={v.mSetReps} />
                      {v.mBand ? (
                        <Select label="شدت کش" value={v.mBandLevel} options={v.bandOpts} onChange={v.mSetBand} />
                      ) : (
                        <TextField label={v.mLoadLabel} value={v.mLoad} suffix={v.mLoadSuffix} optional placeholder={v.mLoadPh} onChange={v.mSetLoad} />
                      )}
                      <TextField label="استراحت" value={v.mRest} suffix="ثانیه" optional placeholder="۹۰" onChange={v.mSetRest} />
                      <Select label="RPE" value={v.mRpe} options={v.rpeOpts} onChange={v.mSetRpe} />
                      <Select label="انتقال به روز" value={v.mDay} options={v.dayOpts} onChange={v.mSetDay} />
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <TextField label="یادداشت برای ورزشکار" value={v.mNote} optional placeholder="مثلاً فاز منفی آهسته" onChange={v.mSetNote} />
                    </div>
                    {v.swapOpts.length ? (
                      <div style={{ marginTop: '12px' }}>
                        <Select
                          key={v.mTitle}
                          label="جایگزین با کش / بدون وسیله"
                          hint="ست و تکرار حفظ می‌شود؛ وزنه به شدت کش تبدیل می‌شود."
                          value=""
                          options={[{ value: '', label: 'انتخاب حرکت جایگزین…' }, ...v.swapOpts]}
                          onChange={v.swapTo}
                        />
                      </div>
                    ) : null}
                  </Modal>
                </div>
              </>
            ) : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
          <PageHeader back={v.backLabel} backTo={v.backTo} title={v.title} subtitle={v.subtitle} badges={v.badges}>
            <IconButton icon="undo" label="واگرد" variant="secondary" disabled={v.noUndo} onClick={v.undo} />
            <Button variant="secondary" icon="edit" onClick={v.openMeta}>
              مشخصات برنامه
            </Button>
            <Button variant="secondary" icon="eye" onClick={v.preview}>
              پیش‌نمایش ورزشکار
            </Button>
            {v.hasReturn ? (
              <>
                <Button variant="secondary" icon="arrow-right" onClick={v.saveReturn}>
                  {v.returnLabel}
                </Button>
              </>
            ) : null}
            <Button variant="primary" icon="save" loading={v.saving} onClick={v.save}>
              {v.saveLabel}
            </Button>
          </PageHeader>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: '0' }}>
            <div style={{ minWidth: '0', overflowX: 'auto', flex: '0 1 auto' }}>
              <Tabs variant="pill" value={v.weekId} tabs={v.weekTabs} onChange={v.pickWeek} />
            </div>
            <div style={{ flex: '1' }}></div>
            <Button variant="secondary" size="sm" icon="copy" onClick={v.dupWeek}>
              کپی هفته
            </Button>
            <Button variant="ghost" size="sm" icon="plus" onClick={v.addWeek}>
              افزودن هفته
            </Button>
            <Button variant="ghost" size="sm" icon="trash" disabled={v.oneWeek} onClick={v.removeWeek}>
              حذف هفته
            </Button>
          </div>
          <div className="bl-stack-mobile" style={{ display: 'flex', gap: '12px', alignItems: 'stretch', minWidth: '0', flex: '1 1 auto' }}>
            <div
              className="bl-unstick-mobile bl-last-mobile"
              style={{
                width: '280px',
                flexShrink: '0',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minWidth: '0',
                alignSelf: 'flex-start',
                position: 'sticky',
                top: '16px',
                // #94: never taller than the screen, so the day columns' side scroll is in view.
                // #101: a fixed height (also on phones) — the list scrolls inside and nothing spills out.
                height: 'max(360px, calc(100vh - 250px))',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>کتابخانه</h3>
                <div style={{ flex: '1' }}></div>
                <Button variant="secondary" size="sm" icon="plus" onClick={v.openQuick}>
                  حرکت جدید
                </Button>
                <a href={v.libHref} style={{ fontSize: '12px', lineHeight: '18px', fontWeight: '500' }}>
                  مدیریت
                </a>
              </div>
              <SearchField placeholder={v.libPh} size="sm" onChange={v.setLibQ} />
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', maxHeight: '96px', overflowY: 'auto', flexShrink: 0 }}>
                {(v.catChips || []).map((c: any, $index: number) => (
                  <Fragment key={$index}>
                    <div onClick={c?.toggle} style={{ display: 'flex', cursor: 'pointer' }}>
                      <Tag variant="filter" selected={c?.on}>
                        {c?.label}
                      </Tag>
                    </div>
                  </Fragment>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '0', minHeight: '120px', flex: '1 1 0', overflow: 'auto' }}>
                {(v.libItems || []).map((x: any, $index: number) => (
                  <Fragment key={$index}>
                    <div
                      className="hv-sunken"
                      draggable="true"
                      onDragStart={x?.dragStart}
                      onDragEnd={v.dragEnd}
                      style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 8px', borderRadius: 'var(--radius-sm)', cursor: 'grab', minWidth: '0' }}
                    >
                      <span
                        style={{
                          width: '36px',
                          height: '36px',
                          flexShrink: '0',
                          borderRadius: '6px',
                          background: 'var(--surface-sunken)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                          overflow: 'hidden',
                        }}
                      >
                        {x?.img ? <img src={x.img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : x?.icon}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                        <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {x?.name}
                        </span>
                        <span style={{ fontSize: '11px', lineHeight: '16px', color: 'var(--text-muted)' }}>{x?.meta}</span>
                      </div>
                      <button
                        className="hv-brand-soft"
                        type="button"
                        onClick={x?.add}
                        title={x?.addTitle}
                        style={{
                          width: '28px',
                          height: '28px',
                          flexShrink: '0',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          font: "600 16px/1 'Vazirmatn',sans-serif",
                        }}
                      >
                        +
                      </button>
                    </div>
                  </Fragment>
                ))}
                {v.libEmpty ? (
                  <>
                    <p style={{ margin: '0', padding: '8px', fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)' }}>حرکتی یافت نشد.</p>
                  </>
                ) : null}
              </div>
              <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)', textWrap: 'pretty' }}>{v.libHint}</p>
            </div>
            <div
              className="bl-unstick-mobile"
              style={{
                flex: '1 1 0',
                minWidth: '0',
                paddingBottom: '4px',
                alignSelf: 'flex-start',
                // #94: the days scroll inside a screen-high box, so the side scrollbar is always in view.
                overflow: 'auto',
                maxHeight: 'max(360px, calc(100vh - 250px))',
                position: 'sticky',
                top: '16px',
              }}
            >
              <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(230px,1fr)', gap: '12px', alignItems: 'start' }}>
                {(v.days || []).map((d: any, $index: number) => (
                  <Fragment key={$index}>
                    <section
                      onClick={d?.select}
                      onDragOver={d?.dragOver}
                      onDragLeave={d?.dragLeave}
                      onDrop={d?.drop}
                      style={{
                        background: 'var(--surface)',
                        border: d?.border,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: '0',
                        boxShadow: d?.shadow,
                      }}
                    >
                      <header style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px 12px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                          <span style={{ fontSize: '12px', lineHeight: '16px', color: 'var(--text-muted)' }}>{d?.label}</span>
                          <input
                            className="fc-underline"
                            value={d?.focus}
                            onChange={d?.setFocus}
                            onClick={v.stop}
                            placeholder="عنوان روز"
                            style={{
                              border: '0',
                              outline: 'none',
                              background: 'transparent',
                              padding: '2px 0',
                              font: "600 15px/22px 'Vazirmatn',sans-serif",
                              color: 'var(--text-primary)',
                              width: '100%',
                              minWidth: '0',
                            }}
                          />
                          {d?.multi ? null : (
                            <select
                              className="bl-native-select"
                              aria-label="زمان جلسه"
                              value={d?.time}
                              onChange={d?.setTime}
                              onClick={v.stop}
                              style={{
                                alignSelf: 'flex-start',
                                marginTop: '2px',
                                border: '1.5px solid ' + (d?.time || v.programTime ? 'var(--brand-primary)' : 'var(--border-strong, var(--border))'),
                                borderRadius: '999px',
                                font: "600 12px/18px 'Vazirmatn',sans-serif",
                                padding: '1px 8px',
                                cursor: 'pointer',
                              }}
                            >
                              {DAY_TIMES.map(([k, label]) => (
                                <option key={k} value={k}>
                                  {k ? 'زمان: ' + label : v.programTime ? 'زمان: ' + v.programTime + ' (برنامه)' : 'زمان جلسه: —'}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {!d?.multi && !d?.empty ? (
                          <button
                            className="hv-sunken-text"
                            type="button"
                            onClick={d?.copyDay}
                            title="کپی حرکات این روز به روز دیگر"
                            style={{
                              height: '28px',
                              border: '0',
                              borderRadius: '6px',
                              background: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              font: "600 11px/16px 'Vazirmatn',sans-serif",
                            }}
                          >
                            کپی
                          </button>
                        ) : null}
                        <button
                          className="hv-sunken-text"
                          type="button"
                          onClick={d?.remove}
                          title="حذف روز"
                          style={{
                            width: '28px',
                            height: '28px',
                            border: '0',
                            borderRadius: '6px',
                            background: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '16px',
                          }}
                        >
                          ×
                        </button>
                      </header>
                      <ol style={{ listStyle: 'none', margin: '0', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '64px' }}>
                        {(d?.sections || []).map((sec: any) => (
                          <li
                            key={sec.key}
                            style={
                              d?.multi
                                ? {
                                    // #99: each time section is its own card under the day
                                    listStyle: 'none',
                                    border: '1.5px solid ' + (sec.active ? 'var(--brand-primary)' : 'var(--border-strong, var(--border))'),
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--surface-sunken)',
                                    padding: '6px 8px 8px',
                                    boxShadow: sec.active ? 'var(--shadow-1)' : 'none',
                                  }
                                : { listStyle: 'none' }
                            }
                          >
                            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {d?.multi ? (
                                <li
                                  onClick={sec.pick}
                                  onDragOver={sec.dragOver}
                                  onDrop={sec.drop}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 2px 2px',
                                    marginTop: '4px',
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <select
                                    className="bl-native-select"
                                    aria-label="زمان این بخش"
                                    value={sec.time}
                                    onClick={v.stop}
                                    onChange={sec.retime}
                                    style={{
                                      border: 0,
                                      background: 'transparent',
                                      font: "700 13px/20px 'Vazirmatn',sans-serif",
                                      color: 'var(--text-primary)',
                                      cursor: 'pointer',
                                      padding: 0,
                                    }}
                                  >
                                    {sec.timeOpts.map(([k, label]: [string, string]) => (
                                      <option key={k} value={k}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                  <span style={{ flex: 1 }} />
                                  {sec.active ? <span style={{ fontSize: '11px', color: 'var(--brand-primary-text)' }}>افزودن به اینجا</span> : null}
                                  {sec.idx.length ? (
                                    <button
                                      type="button"
                                      className="hv-sunken-text"
                                      title="کپی این بخش به روز دیگر"
                                      onClick={sec.copy}
                                      style={{
                                        border: 0,
                                        background: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        font: "600 11px/16px 'Vazirmatn',sans-serif",
                                        padding: '2px 4px',
                                      }}
                                    >
                                      کپی
                                    </button>
                                  ) : null}
                                  {sec.removable ? (
                                    <button
                                      type="button"
                                      title="حذف بخش"
                                      onClick={sec.remove}
                                      style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                      ×
                                    </button>
                                  ) : null}
                                </li>
                              ) : null}
                              {d?.multi && !sec.idx.length ? (
                                <li
                                  onDragOver={sec.dragOver}
                                  onDrop={sec.drop}
                                  onClick={sec.pick}
                                  style={{
                                    padding: '10px 8px',
                                    border: '1.5px dashed var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    textAlign: 'center',
                                    fontSize: '12px',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  حرکت را اینجا رها کنید یا با + اضافه کنید
                                </li>
                              ) : null}
                              {sec.idx
                                .map((i: number) => (d?.ex || [])[i])
                                .map((e: any, $index: number) => (
                                  <Fragment key={sec.key + $index}>
                                    <li
                                      className="hv-border-brand"
                                      draggable="true"
                                      onDragStart={e?.dragStart}
                                      onDragEnd={v.dragEnd}
                                      onDragOver={e?.dragOver}
                                      onDrop={e?.drop}
                                      onClick={e?.edit}
                                      style={{
                                        display: 'flex',
                                        gap: '8px',
                                        alignItems: 'flex-start',
                                        padding: '8px',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--surface)',
                                        cursor: 'grab',
                                        minWidth: '0',
                                        boxShadow: e?.dropLine,
                                        opacity: e?.opacity,
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          flexShrink: '0',
                                          borderRadius: '4px',
                                          background: 'var(--brand-primary-subtle)',
                                          color: 'var(--brand-primary-text)',
                                          font: "600 11px/20px 'IBM Plex Mono',monospace",
                                          textAlign: 'center',
                                        }}
                                      >
                                        {e?.code}
                                      </span>
                                      {e?.img ? (
                                        <img
                                          src={e.img}
                                          alt=""
                                          loading="lazy"
                                          style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '6px', background: 'var(--surface-sunken)', objectFit: 'contain' }}
                                        />
                                      ) : null}
                                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                                        <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '500' }}>{e?.name}</span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                                          {(e?.rxParts || []).map((r: any, $index: number) => (
                                            <Fragment key={$index}>
                                              <span
                                                dir={r?.dir}
                                                style={{
                                                  unicodeBidi: 'isolate',
                                                  fontSize: '11px',
                                                  lineHeight: '16px',
                                                  padding: '1px 6px',
                                                  borderRadius: '4px',
                                                  background: 'var(--surface-sunken)',
                                                  color: 'var(--text-secondary)',
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {r?.t}
                                              </span>
                                            </Fragment>
                                          ))}
                                        </div>
                                        {e?.hasNote ? (
                                          <>
                                            <span style={{ fontSize: '11px', lineHeight: '16px', color: 'var(--text-muted)' }}>{e?.note}</span>
                                          </>
                                        ) : null}
                                      </div>
                                      <button
                                        className="hv-danger"
                                        type="button"
                                        onClick={e?.remove}
                                        title="حذف حرکت"
                                        aria-label="حذف حرکت"
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          flexShrink: '0',
                                          border: '0',
                                          borderRadius: '6px',
                                          background: 'none',
                                          color: 'var(--text-muted)',
                                          cursor: 'pointer',
                                          fontSize: '16px',
                                          lineHeight: '1',
                                        }}
                                      >
                                        ×
                                      </button>
                                    </li>
                                  </Fragment>
                                ))}
                            </ol>
                          </li>
                        ))}
                        {d?.empty && !d?.multi ? (
                          <>
                            <li
                              style={{
                                padding: '16px 8px',
                                border: '1.5px dashed var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'center',
                                fontSize: '12px',
                                lineHeight: '18px',
                                color: 'var(--text-muted)',
                              }}
                            >
                              حرکتی را اینجا رها کنید یا از کتابخانه + بزنید
                            </li>
                          </>
                        ) : null}
                      </ol>
                      {d?.addSecOpts?.length ? (
                        <div style={{ padding: '0 8px' }} onClick={v.stop}>
                          <select
                            className="bl-native-select"
                            aria-label="افزودن بخش زمانی"
                            value=""
                            onChange={d.addSec}
                            style={{
                              width: '100%',
                              border: '1.5px dashed var(--brand-primary)',
                              borderRadius: 'var(--radius-sm)',
                              font: "600 12px/18px 'Vazirmatn',sans-serif",
                              padding: '6px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">+ بخش زمانی دیگر در همین روز (صبح / ظهر / عصر / شب)</option>
                            {d.addSecOpts.map(([k, label]: [string, string]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <footer style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 12px' }}>
                        <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{d?.summary}</span>
                        <span style={{ fontSize: '11px', lineHeight: '16px', fontWeight: '600', color: 'var(--brand-primary-text)' }}>{d?.selTag}</span>
                      </footer>
                    </section>
                  </Fragment>
                ))}
                {/* A week has at most 7 days: the «add day» tile disappears once all 7 exist. */}
                {v.maxDays ? null : (
                  <button
                    className="hv-border-brand-text"
                    type="button"
                    onClick={v.addDay}
                    style={{
                      minHeight: '160px',
                      border: '1.5px dashed var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      font: "500 14px/22px 'Vazirmatn',sans-serif",
                    }}
                  >
                    + افزودن روز تمرین
                  </button>
                )}
              </div>
            </div>
          </div>
          <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.restNote}</p>
        </div>
      </PanelLayout>
    );
  }
}
