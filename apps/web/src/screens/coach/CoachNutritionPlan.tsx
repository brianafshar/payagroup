// Ported from design handoff: project/C24 Coach Nutrition Plan.dc.html
import { Fragment } from 'react';
import { Badge, BarChart, Button, Card, ChartLegend, Checkbox, MacroSummary, Modal, PageHeader, ProgressBar, Sidebar, Tabs, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { api, faError, remote } from '@/data/api';
import { NoAthletePage, pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { AthleteSwitcher } from './AthleteSwitcher';
import { param } from '@/lib/nav';
import { panelUser } from '@/data/session';
import { Screen } from '../Screen';
import { foodIcon } from '@/lib/foodIcons';
import { NutritionTemplateButtons } from './NutritionTemplates';
import { CustomFoodModal, FoodNameInput, inputStyle } from './FoodPicker';
import { ProgramPdfButtons } from './ProgramPdf';

const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const faS = (v: number | string) =>
  String(v)
    .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])
    .replace('.', '٫');
const enN = (s) =>
  +String(s ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace('٫', '.')
    .replace(/[^\d.]/g, '') || 0;

// #47: each meal is served on some weekdays (empty = every day), so every day can have its own menu.
const WEEK = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_FA = { sat: 'شنبه', sun: 'یکشنبه', mon: 'دوشنبه', tue: 'سه‌شنبه', wed: 'چهارشنبه', thu: 'پنجشنبه', fri: 'جمعه' };
const DAY_SHORT = { sat: 'ش', sun: 'ی', mon: 'د', tue: 'س', wed: 'چ', thu: 'پ', fri: 'ج' };
const weekday = (d: Date) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()];
const servedOn = (m, day: string) => day === 'all' || !m.days?.length || m.days.includes(day);

/** Data container: the athlete in `?id=` (or the first one), their plan and last week's logs. */
export default function CoachNutritionPlanPage(props: { brand?: string }) {
  const athletes = useQuery('athletes', () => api.athletes.list());
  const id = param('id') || athletes.data?.[0]?.id || '';
  const week = new Date();
  week.setDate(week.getDate() - 6);
  const plan = useQuery('nutrition-plan:' + id, () => (id ? remote.nutritionPlan(id) : Promise.resolve(null)));
  const logs = useQuery('meal-logs:' + id, () => (id ? remote.mealLogs(id, iso(week)) : Promise.resolve([])));
  const water = useQuery('water-logs:' + id, () => (id ? remote.waterLogs(id, iso(new Date())) : Promise.resolve([])));
  const wait = pending(athletes, plan, logs, water);
  if (wait) return wait;
  if (!id) return <NoAthletePage active="nutrition" title="تغذیه" />;
  const athlete = athletes.data?.find((a) => a.id === id);
  return <CoachNutritionPlan key={id} {...props} athlete={athlete} athletes={athletes.data} livePlan={plan.data} logs={logs.data} water={water.data} />;
}

/** API plan → the screen's editable plan (Persian digits, kcal per 100 g). */
function toDesignPlan(p, logs) {
  const today = iso(new Date());
  const st = new Map(logs.filter((l) => l.date === today).map((l) => [l.mealId, l.status]));
  return {
    t: { kcal: faS(p.targets.kcal), p: faS(p.targets.protein), c: faS(p.targets.carbs), f: faS(p.targets.fat), w: faS(p.targets.waterL) },
    meals: p.meals.map((m) => ({
      id: m.id,
      sid: m.id,
      meal: m.name,
      time: m.time ? faS(m.time.slice(0, 5)) : '',
      st: st.get(m.id) || 'unlogged',
      days: m.days || [],
      foods: m.foods.map((f) => ({
        id: f.id,
        sid: f.id,
        name: f.name,
        // From the food bank (#food-bank): «۳ عدد» of a food; grams follow from the unit.
        food: f.food ?? null,
        unit: f.unit || '',
        qty: f.quantity != null ? faS(f.quantity) : '',
        units: f.units || [],
        g: faS(f.grams),
        k100: faS(f.kcalPer100g),
        p100: f.proteinPer100g,
        c100: f.carbsPer100g,
        f100: f.fatPer100g,
      })),
    })),
    supps: (p.supplements || []).map((x) => ({ name: x.name, dose: x.dose || '', timing: x.timing || '' })),
  };
}

/** The screen's plan → API body (server ids kept so the athlete's meal logs survive). */
function toApiPlan(plan, keepIds = true) {
  const time = (t: string) => {
    const x = String(t || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    return /^\d{1,2}:\d{2}$/.test(x) ? x.padStart(5, '0') : null;
  };
  return {
    targets: { kcal: Math.round(enN(plan.t.kcal)), protein: Math.round(enN(plan.t.p)), carbs: Math.round(enN(plan.t.c)), fat: Math.round(enN(plan.t.f)), waterL: enN(plan.t.w) },
    meals: plan.meals.map((m) => ({
      ...(keepIds && m.sid ? { id: m.sid } : {}),
      name: m.meal.trim() || 'وعده',
      time: time(m.time),
      days: WEEK.filter((d) => (m.days || []).includes(d)),
      foods: m.foods
        .filter((f) => f.name.trim())
        .map((f) =>
          f.food
            ? { ...(keepIds && f.sid ? { id: f.sid } : {}), food: f.food, unit: f.unit, quantity: enN(f.qty), name: f.name.trim() }
            : {
                ...(keepIds && f.sid ? { id: f.sid } : {}),
                food: null,
                name: f.name.trim(),
                grams: enN(f.g),
                kcalPer100g: enN(f.k100),
                proteinPer100g: f.p100 || 0,
                carbsPer100g: f.c100 || 0,
                fatPer100g: f.f100 || 0,
              },
        ),
    })),
    supplements: (plan.supps || []).filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), dose: x.dose.trim(), timing: x.timing.trim() })),
  };
}

/** A bank food's grams for a quantity of one of its units. */
const unitGrams = (f) => (f.units || []).find((u) => u.unit === f.unit)?.grams || 0;
const regram = (f) => {
  f.g = faS(Math.round(enN(f.qty) * unitGrams(f) * 10) / 10);
};

class CoachNutritionPlan extends Screen {
  constructor(p) {
    super(p);
    this.state = { plan: toDesignPlan(p.livePlan, p.logs), draft: null, saving: false, copy: false, pick: [], day: weekday(new Date()) };
  }
  /** Last 7 days of meal logs → adherence, stacked bars and today's totals (followed 100 %, partial 50 %). */
  liveStats(plan, en) {
    const logs = this.props.logs;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - 6 + i);
      return d;
    });
    const count = (st) => days.map((d) => logs.filter((l) => l.date === iso(d) && l.status === st).length);
    const f = { followed: 1, partial: 0.5, skipped: 0 };
    const adh = logs.length ? Math.round((100 * logs.reduce((a, l) => a + f[l.status], 0)) / logs.length) : 0;
    const today = logs.filter((l) => l.date === iso(new Date()));
    const mealKcal = (m) => m.foods.reduce((a, x) => a + (en(x.g) * en(x.k100)) / 100, 0);
    const mealP = (m) => m.foods.reduce((a, x) => a + (en(x.g) * (x.p100 || 0)) / 100, 0);
    const eaten = (fn) => Math.round(today.reduce((a, l) => a + f[l.status] * fn(plan.meals.find((m) => m.sid === l.mealId) || { foods: [] }), 0));
    const water = this.props.water.find((w) => w.date === iso(new Date()));
    const todays = plan.meals.filter((m) => servedOn(m, weekday(new Date())));
    return {
      adh,
      chartLabels: days.map((d) => ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'][d.getDay()]),
      series: [
        { name: 'رعایت شد', values: count('followed'), color: 'success' },
        { name: 'تا حدی', values: count('partial'), color: 'warning' },
        { name: 'رد شد', values: count('skipped'), color: 'error' },
      ],
      chartTarget: { value: todays.length, label: faS(todays.length) + ' وعده' },
      today: [
        { label: 'کالری', value: eaten(mealKcal), target: en(plan.t.kcal), unit: 'kcal' },
        { label: 'پروتئین', value: eaten(mealP), target: en(plan.t.p), unit: 'g' },
        { label: 'آب', value: water ? water.liters : 0, target: en(plan.t.w), unit: 'L' },
      ],
    };
  }

  renderVals() {
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const en = (s) =>
      +String(s || '')
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace('٫', '.')
        .replace(/[^\d.]/g, '') || 0;
    const { plan, draft, saving, copy, pick, day } = this.state;
    const cur = draft || plan,
      editing = !!draft;
    const upd = (fn) => {
      const d = JSON.parse(JSON.stringify(draft));
      fn(d);
      this.setState({ draft: d });
    };
    const ST = {
      followed: ['رعایت شد', 'success', 'check'],
      partial: ['تا حدی', 'warning', 'minus-circle'],
      skipped: ['رد شد', 'error', 'x'],
      unlogged: ['ثبت نشده', 'neutral', 'clock'],
    };
    const macroKcal = en(cur.t.p) * 4 + en(cur.t.c) * 4 + en(cur.t.f) * 9,
      kcal = en(cur.t.kcal);
    const diff = Math.round(macroKcal - kcal);
    const who = this.props.athlete;
    const ATH = this.props.athletes.filter((a) => a.id !== who.id).map((a) => [a.id, a.name, a.programName || '']);
    const fk = (f) => Math.round((en(f.g) * en(f.k100)) / 100);
    const ev = (e) => (e && e.target ? e.target.value : e);
    const kcalOf = (m) => m.foods.reduce((a, f) => a + fk(f), 0);
    const dayKcal = Object.fromEntries(WEEK.map((d) => [d, cur.meals.filter((m) => servedOn(m, d)).reduce((a, m) => a + kcalOf(m), 0)]));
    const mealRows = cur.meals.map((m, i) => {
      const s = ST[m.st || 'unlogged'];
      const days = m.days || [];
      const total = m.foods.reduce((a, f) => a + fk(f), 0);
      return {
        ...m,
        stLabel: s[0],
        tone: s[1],
        icon: s[2],
        totalFa: fa(total) + ' kcal',
        total,
        shown: servedOn(m, day),
        daysLabel: days.length ? days.map((d) => DAY_FA[d]).join('، ') : 'هر روز',
        dayChips: WEEK.map((d) => ({
          d,
          label: DAY_SHORT[d],
          title: DAY_FA[d],
          on: !days.length || days.includes(d),
          toggle: () =>
            upd((x) => {
              const cur = x.meals[i].days?.length ? x.meals[i].days : [...WEEK];
              const next = cur.includes(d) ? cur.filter((y) => y !== d) : [...cur, d];
              if (!next.length) return; // a meal is served on at least one day
              x.meals[i].days = next.length === WEEK.length ? [] : WEEK.filter((y) => next.includes(y));
            }),
        })),
        duplicate: () =>
          upd((x) => {
            const copy = JSON.parse(JSON.stringify(x.meals[i]));
            copy.id = Date.now();
            copy.sid = undefined;
            copy.st = 'unlogged';
            copy.foods = copy.foods.map((f, k) => ({ ...f, id: Date.now() + k + 1, sid: undefined }));
            // A copy for the day being edited, taken off that day in the original so the two can differ.
            if (day !== 'all') {
              copy.days = [day];
              const was = x.meals[i].days?.length ? x.meals[i].days : [...WEEK];
              const rest = was.filter((y) => y !== day);
              if (rest.length) x.meals[i].days = rest;
            }
            x.meals.splice(i + 1, 0, copy);
          }),
        foods: m.foods.map((f, j) => ({
          ...f,
          bank: !!f.food,
          gFa: f.food && f.unit !== 'گرم' ? f.qty + ' ' + f.unit + ' (' + f.g + ' g)' : f.g ? f.g + ' g' : '—',
          pFa: fa(Math.round((en(f.g) * (f.p100 || 0)) / 100)) + 'g پروتئین',
          unitOpts: (f.units || []).map((u) => u.unit),
          k100Fa: f.k100 || '—',
          kcalFa: fa(fk(f)),
          setName: (e) =>
            upd((d) => {
              const x = d.meals[i].foods[j];
              x.name = ev(e);
              // Edited by hand → a typed food again (no bank link, grams entered directly).
              if (x.food) Object.assign(x, { food: null, unit: '', qty: '', units: [] });
            }),
          pick: (food) =>
            upd((d) => {
              const x = d.meals[i].foods[j];
              Object.assign(x, {
                name: food.name,
                food: food.id,
                units: food.units,
                unit: food.defaultUnit,
                qty: food.defaultUnit === 'گرم' ? '۱۰۰' : '۱',
                k100: faS(food.kcalPer100g),
                p100: food.proteinPer100g,
                c100: food.carbsPer100g,
                f100: food.fatPer100g,
              });
              regram(x);
            }),
          create: (name) => this.setState({ newFood: { i, j, name } }),
          setQty: (e) =>
            upd((d) => {
              const x = d.meals[i].foods[j];
              x.qty = ev(e);
              regram(x);
            }),
          setUnit: (e) =>
            upd((d) => {
              const x = d.meals[i].foods[j];
              x.unit = ev(e);
              regram(x);
            }),
          setG: (e) =>
            upd((d) => {
              d.meals[i].foods[j].g = ev(e);
            }),
          setK: (e) =>
            upd((d) => {
              d.meals[i].foods[j].k100 = ev(e);
            }),
          remove: () =>
            upd((d) => {
              d.meals[i].foods.splice(j, 1);
            }),
        })),
        setMeal: (v) =>
          upd((d) => {
            d.meals[i].meal = v;
          }),
        setTime: (v) =>
          upd((d) => {
            d.meals[i].time = v;
          }),
        addFood: () =>
          upd((d) => {
            d.meals[i].foods.push({ id: Date.now(), name: '', g: '', k100: '' });
          }),
        remove: () =>
          upd((d) => {
            d.meals.splice(i, 1);
          }),
      };
    });
    const dayTotal = day === 'all' ? Math.round(WEEK.reduce((a, d) => a + dayKcal[d], 0) / 7) : dayKcal[day];
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      whoName: who.name,
      whoId: who.id,
      headerSub: [
        who.programName,
        this.props.livePlan.updatedAt ? 'به‌روزرسانی ' + new Date(this.props.livePlan.updatedAt).toLocaleDateString('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' }) : null,
        'کالری هر غذا بر اساس ۱۰۰ گرم و مقدار آن محاسبه می‌شود',
      ]
        .filter(Boolean)
        .join(' · '),
      whoTo: 'coach:athlete?id=' + who.id,
      crumbs: [{ label: 'ورزشکاران', to: 'coach:athletes' }, { label: who.name, to: 'coach:athlete?id=' + who.id }, 'تغذیه'],
      badges: editing ? [{ label: 'در حال ویرایش', tone: 'info', icon: 'edit' }] : [],
      viewing: !editing,
      editing,
      saving,
      two: 2,
      startEdit: () => this.setState({ draft: JSON.parse(JSON.stringify(plan)) }),
      cancelEdit: () => this.setState({ draft: null }),
      saveEdit: async () => {
        this.setState({ saving: true });
        try {
          const saved = await remote.saveNutritionPlan(who.id, toApiPlan(draft));
          this.setState({ plan: toDesignPlan(saved, this.props.logs), draft: null, saving: false });
          toast('برنامه تغذیه ذخیره شد', who.name.split(' ')[0] + ' در اپ نسخه جدید را می‌بیند.');
        } catch (e) {
          this.setState({ saving: false });
          toast('ذخیره نشد', faError(e), 'error');
        }
      },
      kcalCheck: Math.abs(diff) <= 50 ? 'ماکروها با کالری هدف هماهنگ است' : 'ماکروها ' + fa(macroKcal) + ' kcal می‌شود (' + (diff > 0 ? fa(diff) + '+' : fa(-diff) + '−') + ')',
      targets: [
        ['kcal', 'کالری', 'kcal'],
        ['p', 'پروتئین', 'g'],
        ['c', 'کربوهیدرات', 'g'],
        ['f', 'چربی', 'g'],
        ['w', 'آب', 'L'],
      ].map(([k, label, unit]) => ({
        label,
        unit,
        value: cur.t[k],
        set: (v) =>
          editing &&
          upd((d) => {
            d.t[k] = v;
          }),
      })),
      meals: mealRows.filter((m) => m.shown),
      day,
      dayTabs: [{ id: 'all', label: 'همه وعده‌ها' }, ...WEEK.map((d) => ({ id: d, label: DAY_FA[d] + (d === weekday(new Date()) ? ' (امروز)' : '') }))],
      setDay: (d) => this.setState({ day: d }),
      dayTitle: day === 'all' ? 'میانگین کالری روزانه' : 'کالری کل ' + DAY_FA[day],
      emptyDay: !mealRows.some((m) => m.shown),
      dayTotalFa: fa(dayTotal) + ' kcal',
      dayCheck:
        'هدف ' +
        fa(kcal) +
        ' kcal · ' +
        (Math.abs(dayTotal - kcal) <= 50 ? 'هماهنگ با هدف' : dayTotal > kcal ? fa(dayTotal - kcal) + ' kcal بیشتر از هدف' : fa(kcal - dayTotal) + ' kcal کمتر از هدف'),
      addMeal: () => {
        const nm = { id: Date.now(), meal: '', time: '', st: 'unlogged', days: day === 'all' ? [] : [day], foods: [{ id: Date.now() + 1, name: '', g: '', k100: '' }] };
        if (editing) upd((d) => d.meals.push(nm));
        else this.setState({ draft: { ...JSON.parse(JSON.stringify(plan)), meals: [...plan.meals, nm] } });
      },
      todaySub:
        'امروز: ' + fa(plan.meals.filter((m) => m.st !== 'unlogged').length) + ' از ' + fa(plan.meals.filter((m) => servedOn(m, weekday(new Date()))).length) + ' وعده ثبت شده',
      adhTarget: 80,
      chartH: 160,
      chartW: 360,
      legend: [
        { label: 'رعایت شد', color: 'success', shape: 'bar' },
        { label: 'تا حدی', color: 'warning', shape: 'bar' },
        { label: 'رد شد', color: 'error', shape: 'bar' },
      ],
      copyOpen: copy,
      openCopy: () => this.setState({ copy: true }),
      closeCopy: () => this.setState({ copy: false, pick: [] }),
      copyList: ATH.map(([id, name, goal]) => ({
        name,
        desc: goal,
        on: pick.includes(id),
        toggle: () => this.setState({ pick: pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id] }),
      })),
      copyNone: pick.length === 0,
      copyLabel: 'کپی برای ' + fa(pick.length) + ' ورزشکار',
      doCopy: async () => {
        const n = ATH.filter((a) => pick.includes(a[0])).map((a) => a[1]);
        try {
          await Promise.all(pick.map((aid) => remote.saveNutritionPlan(aid, toApiPlan(plan, false))));
        } catch (e) {
          return toast('کپی نشد', faError(e), 'error');
        }
        this.setState({ copy: false, pick: [] });
        toast('برنامه کپی شد', n.join('، '));
      },
      supps: (cur.supps || []).map((x, k) => ({
        ...x,
        set: (key) => (e) =>
          upd((d) => {
            d.supps[k][key] = ev(e);
          }),
        remove: () =>
          upd((d) => {
            d.supps.splice(k, 1);
          }),
      })),
      addSupp: () => {
        const add = (d) => (d.supps = [...(d.supps || []), { name: '', dose: '', timing: '' }]);
        if (editing) upd(add);
        else {
          const d = JSON.parse(JSON.stringify(plan));
          add(d);
          this.setState({ draft: d });
        }
      },
      newFood: this.state.newFood,
      closeNewFood: () => this.setState({ newFood: null }),
      savedNewFood: (food) => {
        const nf = this.state.newFood;
        this.setState({ newFood: null });
        if (nf) mealRows[nf.i]?.foods[nf.j]?.pick(food);
      },
      ...this.liveStats(plan, en),
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="nutrition" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
        overlays={
          <>
            {v.copyOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal
                    title="کپی برنامه تغذیه"
                    description="اهداف و وعده‌ها برای ورزشکاران انتخاب‌شده کپی می‌شود. برنامه فعلی آن‌ها جایگزین خواهد شد."
                    primaryLabel={v.copyLabel}
                    primaryDisabled={v.copyNone}
                    secondaryLabel="انصراف"
                    onPrimary={v.doCopy}
                    onClose={v.closeCopy}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(v.copyList || []).map((c: any, $index: number) => (
                        <Fragment key={$index}>
                          <Checkbox label={c?.name} description={c?.desc} checked={c?.on} onChange={c?.toggle} />
                        </Fragment>
                      ))}
                    </div>
                  </Modal>
                </div>
              </>
            ) : null}
            {v.newFood ? <CustomFoodModal name={v.newFood.name} onSaved={v.savedNewFood} onClose={v.closeNewFood} /> : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title={'تغذیه · ' + v.whoName} subtitle={v.headerSub} back={v.whoName} backTo={v.whoTo} badges={v.badges}>
            <Button variant="secondary" icon="copy" onClick={v.openCopy}>
              کپی برنامه برای…
            </Button>
            <NutritionTemplateButtons athleteId={v.whoId} athleteName={v.whoName} onApplied={() => window.location.reload()} />
            {v.viewing ? (
              <>
                <ProgramPdfButtons athleteId={v.whoId} name={v.whoName} />
                <Button variant="primary" icon="edit" onClick={v.startEdit}>
                  ویرایش برنامه
                </Button>
              </>
            ) : null}
            {v.editing ? (
              <>
                <Button variant="ghost" onClick={v.cancelEdit}>
                  انصراف
                </Button>
                <Button variant="primary" icon="save" loading={v.saving} onClick={v.saveEdit}>
                  ذخیره
                </Button>
              </>
            ) : null}
          </PageHeader>
          {this.props.athletes?.length > 1 ? <AthleteSwitcher athletes={this.props.athletes} current={this.props.athlete?.id} route="coach:nutrition" /> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>اهداف روزانه</h3>
                  <div style={{ flex: '1' }}></div>
                  <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.kcalCheck}</p>
                </div>
                <div className="bl-two-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  {(v.targets || []).map((t: any, $index: number) => (
                    <Fragment key={$index}>
                      <TextField label={t?.label} value={t?.value} suffix={t?.unit} disabled={v.viewing} onChange={t?.set} />
                    </Fragment>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <Tabs variant="pill" value={v.day} tabs={v.dayTabs} onChange={v.setDay} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    هر روز هفته می‌تواند منوی خودش را داشته باشد. وعده‌ای که روزش مشخص نشده، هر روز نمایش داده می‌شود.
                  </span>
                </div>
                {v.emptyDay ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>برای این روز وعده‌ای تعریف نشده. با «افزودن وعده» منوی این روز را بسازید.</p>
                ) : null}
                {(v.meals || []).map((m: any, $index: number) => (
                  <Fragment key={$index}>
                    <article
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        minWidth: '0',
                      }}
                    >
                      {v.viewing ? (
                        <>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>{m?.meal}</span>
                            <span style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)' }}>{m?.time}</span>
                            <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-secondary)' }}>{m?.daysLabel}</span>
                            <div style={{ flex: '1' }}></div>
                            <Badge tone={m?.tone} icon={m?.icon} size="sm">
                              {m?.stLabel}
                            </Badge>
                          </div>
                        </>
                      ) : null}
                      {v.editing ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 32px', gap: '8px', alignItems: 'end' }}>
                            <TextField label="وعده" value={m?.meal} placeholder="مثلاً میان‌وعده" onChange={m?.setMeal} size="sm" />
                            <TextField label="ساعت" value={m?.time} placeholder="۰۷:۳۰" onChange={m?.setTime} size="sm" />
                            <button
                              className="hv-danger-soft"
                              type="button"
                              onClick={m?.remove}
                              title="حذف وعده"
                              style={{
                                width: '32px',
                                height: '32px',
                                border: '0',
                                borderRadius: '6px',
                                background: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '18px',
                              }}
                            >
                              ×
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>روزها:</span>
                            {(m?.dayChips || []).map((c: any) => (
                              <button
                                key={c.d}
                                type="button"
                                title={c.title}
                                aria-pressed={c.on}
                                onClick={c.toggle}
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 15,
                                  border: '1px solid ' + (c.on ? 'var(--brand-primary)' : 'var(--border)'),
                                  background: c.on ? 'var(--brand-primary)' : 'var(--surface)',
                                  color: c.on ? 'var(--brand-on-primary, #fff)' : 'var(--text-secondary)',
                                  font: "600 12px/1 'Vazirmatn',sans-serif",
                                  cursor: 'pointer',
                                }}
                              >
                                {c.label}
                              </button>
                            ))}
                            <div style={{ flex: 1 }} />
                            <Button size="sm" variant="ghost" icon="copy" onClick={m?.duplicate}>
                              {v.day === 'all' ? 'تکثیر وعده' : 'نسخه جدا برای این روز'}
                            </Button>
                          </div>
                        </>
                      ) : null}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          border: '1px solid var(--border-subtle, var(--border))',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          className="bl-foodrow"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,1fr) 190px 110px 120px 32px',
                            gap: '12px',
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: 'var(--surface-sunken)',
                          }}
                        >
                          <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)', fontWeight: '500' }}>غذا</span>
                          <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)', fontWeight: '500' }}>مقدار</span>
                          <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)', fontWeight: '500' }}>کالری در ۱۰۰ گرم</span>
                          <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)', fontWeight: '500' }}>کالری · پروتئین</span>
                          <span></span>
                        </div>
                        {(m?.foods || []).map((f: any, $index: number) => (
                          <Fragment key={$index}>
                            <div
                              className="bl-foodrow"
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0,1fr) 190px 110px 120px 32px',
                                gap: '12px',
                                alignItems: 'center',
                                minHeight: '44px',
                                padding: '4px 12px',
                                borderTop: '1px solid var(--border-subtle, var(--border))',
                              }}
                            >
                              {v.viewing ? (
                                <>
                                  <span style={{ fontSize: '14px', lineHeight: '22px', minWidth: '0', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <img src={foodIcon(f?.name || '')} alt="" width={24} height={24} loading="lazy" />
                                    {f?.name}
                                  </span>
                                  <span style={{ font: "400 14px/22px 'Vazirmatn',sans-serif", color: 'var(--text-secondary)' }}>{f?.gFa}</span>
                                  <span style={{ font: "400 14px/22px 'Vazirmatn',sans-serif", color: 'var(--text-secondary)' }}>{f?.k100Fa}</span>
                                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ font: "600 14px/20px 'Vazirmatn',sans-serif" }}>{f?.kcalFa + ' kcal'}</span>
                                    <span style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-muted)' }}>{f?.pFa}</span>
                                  </span>
                                  <span></span>
                                </>
                              ) : null}
                              {v.editing ? (
                                <>
                                  <FoodNameInput value={f?.name} onChange={(v) => f?.setName(v)} onPick={f?.pick} onCreate={f?.create} />
                                  {f?.bank ? (
                                    <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
                                      <input value={f?.qty} onChange={f?.setQty} inputMode="decimal" aria-label="تعداد" style={{ ...inputStyle, width: 64, flex: '0 0 64px' }} />
                                      <select value={f?.unit} onChange={f?.setUnit} aria-label="واحد" style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '0 6px' }}>
                                        {(f?.unitOpts || []).map((u: string) => (
                                          <option key={u} value={u}>
                                            {u}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <input value={f?.g} onChange={f?.setG} inputMode="decimal" placeholder="گرم" aria-label="گرم" style={inputStyle} />
                                  )}
                                  {f?.bank ? (
                                    <span style={{ display: 'flex', flexDirection: 'column', fontSize: 12, lineHeight: '16px', color: 'var(--text-secondary)' }}>
                                      <span>{f?.k100Fa + ' kcal / ۱۰۰g'}</span>
                                      <span style={{ color: 'var(--text-muted)' }}>{'= ' + f?.g + ' گرم'}</span>
                                    </span>
                                  ) : (
                                    <input value={f?.k100} onChange={f?.setK} inputMode="decimal" placeholder="کالری ۱۰۰g" aria-label="کالری در ۱۰۰ گرم" style={inputStyle} />
                                  )}
                                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ font: "600 14px/20px 'Vazirmatn',sans-serif" }}>{f?.kcalFa + ' kcal'}</span>
                                    <span style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-muted)' }}>{f?.pFa}</span>
                                  </span>
                                  <button
                                    className="hv-danger-soft"
                                    type="button"
                                    onClick={f?.remove}
                                    title="حذف غذا"
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
                                </>
                              ) : null}
                            </div>
                          </Fragment>
                        ))}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,1fr) 100px 32px',
                            gap: '12px',
                            alignItems: 'center',
                            minHeight: '44px',
                            padding: '4px 12px',
                            borderTop: '1px solid var(--border)',
                            background: 'var(--surface-sunken)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', minWidth: '0' }}>
                            {v.editing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={m?.addFood}
                                  style={{
                                    border: '0',
                                    background: 'none',
                                    padding: '4px 0',
                                    color: 'var(--brand-primary-text)',
                                    font: "600 13px/20px 'Vazirmatn',sans-serif",
                                    cursor: 'pointer',
                                  }}
                                >
                                  + افزودن غذا
                                </button>
                              </>
                            ) : null}
                            {v.viewing ? (
                              <>
                                <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '600' }}>
                                  {'جمع '}
                                  {m?.meal}
                                </span>
                              </>
                            ) : null}
                          </div>
                          <span style={{ font: "700 15px/22px 'Vazirmatn',sans-serif", whiteSpace: 'nowrap' }}>{m?.totalFa}</span>
                          <span></span>
                        </div>
                      </div>
                    </article>
                  </Fragment>
                ))}
                <div
                  style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '14px 20px', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary-subtle)' }}
                >
                  <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: '600' }}>{v.dayTitle}</span>
                  <div style={{ flex: '1' }}></div>
                  <span style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--text-secondary)' }}>{v.dayCheck}</span>
                  <span style={{ font: "700 18px/26px 'Vazirmatn',sans-serif", whiteSpace: 'nowrap' }}>{v.dayTotalFa}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Button variant="secondary" icon="plus" onClick={v.addMeal}>
                  افزودن وعده
                </Button>
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>ورزشکار هر وعده را «رعایت شد»، «تا حدی» یا «رد شد» علامت می‌زند.</p>
              </div>
              <Card title="مکمل‌ها" subtitle="در اپ شاگرد و فایل PDF برنامه نمایش داده می‌شود">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!v.supps.length ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>مکملی تعیین نشده.</span> : null}
                  {v.supps.map((x: any, k: number) =>
                    v.editing ? (
                      <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr) 32px', gap: 8, alignItems: 'center' }}>
                        <input value={x.name} onChange={x.set('name')} placeholder="نام، مثلاً کراتین" aria-label="نام مکمل" style={inputStyle} />
                        <input value={x.dose} onChange={x.set('dose')} placeholder="مقدار، مثلاً ۵ گرم" aria-label="مقدار مکمل" style={inputStyle} />
                        <input value={x.timing} onChange={x.set('timing')} placeholder="زمان، مثلاً بعد از تمرین" aria-label="زمان مصرف" style={inputStyle} />
                        <button
                          type="button"
                          title="حذف مکمل"
                          onClick={x.remove}
                          style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 14 }}>
                        <strong>{x.name}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{[x.dose, x.timing].filter(Boolean).join(' · ')}</span>
                      </div>
                    ),
                  )}
                  <div>
                    <Button size="sm" variant="ghost" icon="plus" onClick={v.addSupp}>
                      افزودن مکمل
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <Card title="پایبندی" subtitle={v.todaySub}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }}>
                  <ProgressBar label="وعده‌های رعایت‌شده، ۷ روز" value={v.adh} valueLabel={faS(v.adh) + '٪'} target={v.adhTarget} />
                  <BarChart labels={v.chartLabels} stacked height={v.chartH} width={v.chartW} series={v.series} target={v.chartTarget} />
                  <ChartLegend items={v.legend} />
                </div>
              </Card>
              <Card title="امروز تا این لحظه" subtitle="از وعده‌های رعایت‌شده">
                <MacroSummary items={v.today} />
              </Card>
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
