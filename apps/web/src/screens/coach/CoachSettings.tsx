// Ported from design handoff: project/C32 Coach Settings.dc.html
import { createElement, Fragment } from 'react';
import {
  Button,
  Card,
  Checkbox,
  DescriptionList,
  IconButton,
  Modal,
  NumberStepper,
  PageHeader,
  RadioGroup,
  SegmentedControl,
  Select,
  Sidebar,
  Switch,
  Tabs,
  Tag,
  TextField,
  TopBar,
} from '@/ds';
import { AppearanceSettings } from '@/app/AppearanceSettings';
import { ChangePasswordForm } from '@/app/ChangePasswordForm';
import { ChangeUsernameForm } from '@/app/ChangeUsernameForm';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { TwoFactorPanel } from '@/app/TwoFactorPanel';
import { faError, remote } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { go, navigate, param } from '@/lib/nav';
import { faDate, faLastSeen, setCalendar } from '@/lib/format';
import { logout, panelUser, refreshUser, useSessionUser } from '@/data/session';
import { Screen } from '../Screen';
import { TEST_CAT, TEST_UNIT } from './TestLogModal';

const faS = (v) => String(v ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
const enS = (v) => String(v ?? '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const FREQ_OF = { weekly: 'w1', monthly: 'm1' };

/** Data container: the coach's profile, preferences, tests and documents. */
export default function CoachSettingsPage(props: { brand?: string }) {
  const profile = useQuery('coach-profile', remote.coachProfile);
  const docs = useQuery('coach-docs', remote.documents);
  const me = useSessionUser();
  const wait = pending(profile, docs);
  if (wait) return wait;
  return <CoachSettings {...props} profile={profile.data} docs={docs.data} me={me} />;
}

/** Server data → the screen's settings object. */
function liveSettings(profile, docs, me, base) {
  const pref = profile.preferences || {};
  if (pref.p?.date) setCalendar(pref.p.date); // the saved calendar also applies on this device
  const n = profile.cadence === 'every-n-weeks' ? profile.cadenceWeeks || 2 : 6;
  const freq = profile.cadence === 'every-n-weeks' ? (n === 2 ? 'w2' : n === 3 ? 'w3' : 'custom') : FREQ_OF[profile.cadence] || 'w1';
  const resume = docs.find((d) => d.kind === 'resume');
  return {
    p: {
      ...base.p,
      ...(pref.p || {}),
      name: profile.name,
      phone: faS(me?.phone || ''),
      bio: profile.bio || '',
      photo: me?.photo || null,
      resume: resume ? { id: resume.id, name: resume.name, size: resume.size, url: resume.file } : null,
      certs: docs
        .filter((d) => d.kind === 'certificate')
        .map((d) => ({ id: d.id, name: d.name, ext: (d.name.split('.').pop() || '').toUpperCase().slice(0, 4), size: d.size, url: d.file })),
    },
    n: { ...base.n, ...(pref.n || {}) },
    tests: (profile.customTests || []).map((t) => ({
      id: String(t.id),
      sid: t.id,
      name: t.name,
      cat: t.category || 'other',
      unit: t.unit,
      dir: t.better === 'lower' ? 'down' : 'up',
      protocol: t.protocol || '',
    })),
    m: { ...base.m, ...(pref.m || {}), freq, n },
  };
}

class CoachSettings extends Screen {
  constructor(p) {
    super(p);
    // Defaults for preferences the coach hasn't saved yet.
    const defaults = {
      p: { wUnit: 'kg', lUnit: 'cm', date: 'j', years: '', city: '', specs: [], insta: '', site: '', showPublic: true },
      n: { miss: true, pr: true, sore: true, nut: false, daily: true },
      m: { freq: 'w1', n: 6, day: 'fr', remind: 'morning', req: ['w', 'f', 'wa'], applyAll: false },
    };
    const init = liveSettings(p.profile, p.docs, p.me, defaults);
    this.state = { tab: param('tab') || 'profile', s: init, saved: init, saving: false, draft: null };
  }

  /** Save everything to the API: account (name, phone), profile + preferences, cadence, tests. */
  async saveLive() {
    const { s, saved } = this.state;
    const P = s.p;
    const cadence =
      s.m.freq === 'm1'
        ? { cadence: 'monthly', cadenceWeeks: null }
        : s.m.freq === 'w1'
          ? { cadence: 'weekly', cadenceWeeks: null }
          : { cadence: 'every-n-weeks', cadenceWeeks: s.m.freq === 'w2' ? 2 : s.m.freq === 'w3' ? 3 : s.m.n };
    const { name, phone, bio, photo, resume, certs, ...rest } = P;
    await remote.updateMe({ name: name.trim(), phone: enS(phone).replace(/\s/g, '') });
    await remote.saveCoachProfile({
      name: name.trim(),
      bio,
      ...cadence,
      preferences: { p: rest, n: s.n, m: { day: s.m.day, remind: s.m.remind, req: s.m.req, applyAll: s.m.applyAll } },
    });
    const before = new Map<number, unknown>(saved.tests.filter((t) => t.sid).map((t) => [t.sid, t]));
    const body = (t) => ({ name: t.name, category: t.cat, unit: t.unit, better: t.dir === 'down' ? 'lower' : 'higher', protocol: t.protocol || '' });
    for (const t of s.tests) {
      if (!t.sid) await remote.addTest(body(t) as Parameters<typeof remote.addTest>[0]);
      else if (JSON.stringify(before.get(t.sid)) !== JSON.stringify(t)) await remote.updateTest(t.sid, body(t));
      before.delete(t.sid);
    }
    for (const sid of before.keys()) await remote.removeTest(Number(sid));
    await refreshUser();
  }
  renderVals() {
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const { tab, s, saved, saving, draft } = this.state;
    const set = (k, patch) => this.setState({ s: { ...s, [k]: Array.isArray(patch) ? patch : { ...s[k], ...patch } } });
    const CAT = TEST_CAT;
    const UNIT = TEST_UNIT;
    const DAYN = { sa: 'شنبه', su: 'یکشنبه', mo: 'دوشنبه', tu: 'سه‌شنبه', we: 'چهارشنبه', th: 'پنجشنبه', fr: 'جمعه' };
    const FREQ = { w1: 'هر هفته', w2: 'هر ۲ هفته', w3: 'هر ۳ هفته', m1: 'هر ماه', custom: 'سفارشی' };
    const FL = { w: 'وزن', f: 'چربی', m: 'عضله', ch: 'سینه', wa: 'کمر', ar: 'بازو', th: 'ران', hi: 'باسن', ca: 'ساق', ne: 'گردن' };
    const m = s.m,
      dirty = JSON.stringify(s) !== JSON.stringify(saved);
    const fl = m.freq === 'custom' ? 'هر ' + fa(m.n) + ' هفته' : FREQ[m.freq];
    const fsz = (b) => (b >= 1048576 ? fa((b / 1048576).toFixed(1)).replace('.', '٫') + ' مگابایت' : fa(Math.max(1, Math.round(b / 1024))) + ' کیلوبایت');
    const extOf = (n) => (String(n).split('.').pop() || '').toUpperCase().slice(0, 4);
    const SPEC = {
      hyp: 'هایپرتروفی',
      str: 'قدرتی',
      loss: 'کاهش وزن',
      func: 'فانکشنال',
      rehab: 'بازتوانی',
      women: 'بانوان',
      teen: 'نوجوانان',
      nutr: 'تغذیه ورزشی',
      run: 'دویدن',
      cross: 'کراس‌فیت',
    };
    const P = s.p,
      certs = P.certs || [];
    return {
      brand: this.props.brand ?? 'brand',
      hasPhoto: !!P.photo,
      noPhoto: !P.photo,
      avatarImg: P.photo ? createElement('img', { src: P.photo, alt: 'عکس پروفایل', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } }) : null,
      initials: (P.name || 'م')
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join(' '),
      photoBtn: P.photo ? 'تغییر عکس' : 'بارگذاری عکس',
      pickPhoto: (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 20 * 1048576) return toast('عکس بزرگ است', 'حداکثر ۲۰ مگابایت.', 'error');
        {
          const fd = new FormData();
          fd.append('photo', f);
          e.target.value = '';
          return void remote
            .updateMe(fd)
            .then((u) => {
              this.setState((st) => ({ s: { ...st.s, p: { ...st.s.p, photo: u.photo } }, saved: { ...st.saved, p: { ...st.saved.p, photo: u.photo } } }));
              void refreshUser();
              toast('عکس پروفایل ذخیره شد');
            })
            .catch((err) => toast('بارگذاری نشد', faError(err), 'error'));
        }
      },
      removePhoto: () =>
        void remote
          .updateMe({ removePhoto: true })
          .then(() => {
            this.setState((st) => ({ s: { ...st.s, p: { ...st.s.p, photo: null } }, saved: { ...st.saved, p: { ...st.saved.p, photo: null } } }));
            void refreshUser();
          })
          .catch((err) => toast('حذف نشد', faError(err), 'error')),
      setYears: (v) => set('p', { years: v }),
      setCity: (v) => set('p', { city: v }),
      setInsta: (v) => set('p', { insta: v }),
      setSite: (v) => set('p', { site: v }),
      setShowPublic: (v) => set('p', { showPublic: v }),
      specs: Object.keys(SPEC).map((k) => ({
        label: SPEC[k],
        on: (P.specs || []).includes(k),
        toggle: () => set('p', { specs: (P.specs || []).includes(k) ? P.specs.filter((x) => x !== k) : [...(P.specs || []), k] }),
      })),
      certs: certs.map((c, i) => ({
        name: c.name,
        ext: c.ext,
        meta: fsz(c.size) + ' · ' + (c.isNew ? 'امروز بارگذاری شد' : 'تأیید شده'),
        url: c.url,
        remove: () => {
          if (c.id) void remote.deleteDocument(c.id).catch((err) => toast('حذف نشد', faError(err), 'error'));
          set('p', { certs: certs.filter((_, j) => j !== i) });
        },
      })),
      pickCert: (e) => {
        const fs = [...(e.target.files || [])];
        if (!fs.length) return;
        {
          e.target.value = '';
          return void Promise.all(fs.map((f) => remote.uploadDocument('certificate', f as File)))
            .then((docs) => {
              const added = docs.map((d) => ({ id: d.id, name: d.name, ext: extOf(d.name), size: d.size, url: d.file, isNew: true }));
              this.setState((st) => ({
                s: { ...st.s, p: { ...st.s.p, certs: [...st.s.p.certs, ...added] } },
                saved: { ...st.saved, p: { ...st.saved.p, certs: [...st.saved.p.certs, ...added] } },
              }));
              toast(fa(fs.length) + ' مدرک اضافه شد');
            })
            .catch((err) => toast('بارگذاری نشد', faError(err), 'error'));
        }
      },
      hasResume: !!P.resume,
      noResume: !P.resume,
      resume: P.resume ? { name: P.resume.name, ext: extOf(P.resume.name), meta: fsz(P.resume.size) + ' · امروز بارگذاری شد' } : { name: '', ext: '', meta: '' },
      pickResume: (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 10 * 1048576) return toast('فایل بزرگ است', 'حداکثر ۱۰ مگابایت.', 'error');
        {
          e.target.value = '';
          return void remote
            .uploadDocument('resume', f)
            .then((d) => {
              const r = { id: d.id, name: d.name, size: d.size, url: d.file };
              this.setState((st) => ({ s: { ...st.s, p: { ...st.s.p, resume: r } }, saved: { ...st.saved, p: { ...st.saved.p, resume: r } } }));
              toast('رزومه بارگذاری شد');
            })
            .catch((err) => toast('بارگذاری نشد', faError(err), 'error'));
        }
      },
      removeResume: () => {
        if (P.resume?.id) void remote.deleteDocument(P.resume.id).catch((err) => toast('حذف نشد', faError(err), 'error'));
        set('p', { resume: null });
      },
      user: panelUser({ name: s.p.name || 'علی احمدی', role: 'سرمربی' }),
      crumbs: ['تنظیمات'],
      email: this.props.me?.email || '',
      badges: dirty ? [{ label: 'ذخیره‌نشده', tone: 'warning', icon: 'edit' }] : [],
      clean: !dirty,
      saving,
      save: async () => {
        this.setState({ saving: true });
        try {
          await this.saveLive();
        } catch (e) {
          this.setState({ saving: false });
          return toast('ذخیره نشد', faError(e), 'error');
        }
        this.setState({ saving: false, saved: s });
        toast('تنظیمات ذخیره شد');
      },
      tab,
      setTab: (v) => this.setState({ tab: v }),
      tabs: [
        { id: 'profile', label: 'پروفایل و فضای کاری' },
        { id: 'units', label: 'واحدها' },
        { id: 'appearance', label: 'ظاهر' },
        { id: 'tests', label: 'آزمون‌ها و شاخص‌ها', count: fa(s.tests.length) },
        { id: 'security', label: 'امنیت' },
      ],
      tProfile: tab === 'profile',
      tUnits: tab === 'units',
      tAppearance: tab === 'appearance',
      tTests: tab === 'tests',
      tSecurity: tab === 'security',
      n1: 1,
      n2: 2,
      p: s.p,
      setName: (v) => set('p', { name: v }),
      setPhone: (v) => set('p', { phone: v }),
      setBio: (v) => set('p', { bio: v }),
      langs: [{ value: 'fa', label: 'فارسی' }],
      brandItems: [
        { label: 'رنگ اصلی', value: '\u2066' + this.props.profile.branding.primary + '\u2069' },
        { label: 'نام اپ', value: this.props.profile.branding.appName },
      ],
      notifs: [
        ['miss', 'تمرین از دست رفته', 'وقتی ورزشکار جلسه برنامه‌ریزی‌شده را انجام ندهد'],
        ['pr', 'رکورد شخصی جدید', ''],
        ['sore', 'کوفتگی شدید', 'کوفتگی ۸ یا بیشتر، دو روز پشت سر هم'],
        ['nut', 'پایبندی پایین تغذیه', 'کمتر از ۶۰٪ در ۷ روز'],
        ['daily', 'ایمیل خلاصه روزانه ساعت ۷:۰۰', ''],
      ].map(([k, label, desc]) => ({ label, desc, on: !!s.n[k], toggle: (v) => set('n', { [k]: v }) })),
      wUnits: [
        { value: 'kg', label: 'کیلوگرم' },
        { value: 'lb', label: 'پوند' },
      ],
      lUnits: [
        { value: 'cm', label: 'سانتی‌متر' },
        { value: 'in', label: 'اینچ' },
      ],
      setWUnit: (v) => set('p', { wUnit: v }),
      setLUnit: (v) => set('p', { lUnit: v }),
      dateOpts: [
        { value: 'j', label: 'شمسی · ' + faDate(new Date(), undefined, 'j') },
        { value: 'h', label: 'قمری · ' + faDate(new Date(), undefined, 'h') },
        { value: 'g', label: 'میلادی · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) },
      ],
      setDate: (v) => {
        setCalendar(v); // dates across the panel switch right away
        set('p', { date: v });
      },
      tests: s.tests.map((t, i) => ({
        name: t.name,
        cat: CAT[t.cat] || '—',
        unit: UNIT[t.unit] || t.unit,
        dir: t.dir === 'down' ? 'کمتر' : 'بیشتر',
        custom: true,
        src: t.protocol ? 'روش اجرا: ' + (t.protocol.length > 90 ? t.protocol.slice(0, 90) + '…' : t.protocol) : 'تعریف‌شده توسط شما · بدون روش اجرا',
        edit: () => this.setState({ draft: { ...t, i } }),
        remove: () => {
          set(
            'tests',
            s.tests.filter((_, j) => j !== i),
          );
          toast('«' + t.name + '» حذف شد', 'نتایج ثبت‌شده قبلی حفظ می‌شوند.');
        },
      })),
      newTest: () => this.setState({ draft: { id: 'c' + Date.now(), name: '', cat: 'end', unit: 'km', dir: 'down', i: -1 } }),
      tOpen: !!draft,
      d: draft || {},
      tTitle: draft && draft.i >= 0 ? 'ویرایش آزمون' : 'آزمون جدید',
      tInvalid: !draft || !draft.name.trim(),
      dName: (v) => this.setState({ draft: { ...draft, name: v } }),
      dCat: (v) => this.setState({ draft: { ...draft, cat: v } }),
      dUnit: (v) => this.setState({ draft: { ...draft, unit: v, dir: ['s', 'min'].includes(v) ? 'down' : 'up' } }),
      dDir: (v) => this.setState({ draft: { ...draft, dir: v } }),
      catOpts: Object.keys(CAT).map((k) => ({ value: k, label: CAT[k] })),
      // Any unit the coach types is allowed too (e.g. «بار»، «سانتی‌متر پرش»).
      unitOpts: [...Object.keys(UNIT), ...(draft && draft.unit && !UNIT[draft.unit] ? [draft.unit] : [])].map((k) => ({ value: k, label: UNIT[k] || k })),
      dProtocol: (v) => this.setState({ draft: { ...draft, protocol: v } }),
      dCustomUnit: (v) => v.trim() && this.setState({ draft: { ...draft, unit: v.trim().slice(0, 16) } }),
      dirOpts: [
        { value: 'up', label: 'بیشتر بهتر است', description: 'مثل وزنه، مسافت یا ارتفاع' },
        { value: 'down', label: 'کمتر بهتر است', description: 'مثل زمان دویدن' },
      ],
      closeTest: () => this.setState({ draft: null }),
      saveTest: () => {
        const { i, ...t } = draft;
        t.name = t.name.trim();
        const list = [...s.tests];
        if (i >= 0) list[i] = t;
        else list.push(t);
        this.setState({ s: { ...s, tests: list }, draft: null });
      },
      freqOpts: Object.keys(FREQ).map((k) => ({ value: k, label: FREQ[k] })),
      m,
      setFreq: (v) => set('m', { freq: v }),
      isCustom: m.freq === 'custom',
      setN: (n: number) => set('m', { n }),
      dayOpts: Object.keys(DAYN).map((k) => ({ value: k, label: DAYN[k] })),
      setDay: (v) => set('m', { day: v }),
      remindOpts: [
        { value: 'eve', label: 'شب قبل' },
        { value: 'morning', label: 'صبح همان روز' },
        { value: 'both', label: 'هر دو' },
        { value: 'off', label: 'بدون یادآوری' },
      ],
      setRemind: (v) => set('m', { remind: v }),
      reqChips: Object.keys(FL).map((k) => ({
        label: FL[k],
        on: m.req.includes(k),
        toggle: () => set('m', { req: m.req.includes(k) ? m.req.filter((x) => x !== k) : [...m.req, k] }),
      })),
      applyDesc: 'زمان‌بندی ورزشکاران فعلی هم جایگزین می‌شود، مگر آن‌هایی که جداگانه تنظیم کرده‌اید.',
      setApplyAll: (v) => set('m', { applyAll: v }),
      measureSummary:
        'ورزشکاران جدید ' +
        fl +
        '، ' +
        DAYN[m.day] +
        '، ' +
        fa(m.req.length) +
        ' شاخص اجباری را در اپ ثبت می‌کنند' +
        (m.remind === 'off' ? ' و یادآوری نمی‌گیرند.' : ' و ' + { eve: 'شب قبل', morning: 'صبح همان روز', both: 'شب قبل و صبح همان روز' }[m.remind] + ' یادآوری می‌گیرند.'),
      secItems: [
        { label: 'نام کاربری', value: this.props.me?.username || '—' },
        { label: 'آخرین ورود', value: this.props.me?.lastLogin ? faLastSeen(this.props.me.lastLogin) : '—' },
      ],
            signOut: async () => {
        await logout();
        go('coach:login');
      },
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="settings" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
        overlays={
          <>
            {v.tOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal
                    title={v.tTitle}
                    description="نتایج این آزمون در تحلیل‌ها و رکوردهای شخصی حساب می‌شود."
                    primaryLabel="ذخیره"
                    primaryDisabled={v.tInvalid}
                    secondaryLabel="انصراف"
                    onPrimary={v.saveTest}
                    onClose={v.closeTest}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <TextField label="نام آزمون" value={v.d?.name} placeholder="مثلاً دوی ۳ کیلومتر" onChange={v.dName} />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px' }}>
                        <Select label="دسته" value={v.d?.cat} options={v.catOpts} onChange={v.dCat} />
                        <Select label="واحد" value={v.d?.unit} options={v.unitOpts} onChange={v.dUnit} />
                      </div>
                      <TextField label="یا واحد دلخواه" optional placeholder="مثلاً وات، سطح، امتیاز" onChange={v.dCustomUnit} />
                      <RadioGroup label="کدام بهتر است؟" value={v.d?.dir} options={v.dirOpts} onChange={v.dDir} />
                      <TextField
                        label="روش اجرا (پروتکل)"
                        optional
                        multiline
                        value={v.d?.protocol}
                        placeholder="مثلاً ۱۰ دقیقه گرم کردن، سپس ۳ کیلومتر با حداکثر توان روی پیست. زمان کل ثبت شود."
                        onChange={v.dProtocol}
                      />
                    </div>
                  </Modal>
                </div>
              </>
            ) : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="تنظیمات" subtitle="پروفایل، نام کاربری و رمز، واحدها، ظاهر و آزمون‌ها" badges={v.badges}>
            <Button variant="primary" icon="save" disabled={v.clean} loading={v.saving} onClick={v.save}>
              ذخیره تغییرات
            </Button>
          </PageHeader>
          <Tabs value={v.tab} tabs={v.tabs} onChange={v.setTab} />
          {v.tProfile ? (
            <div
              style={{
                maxWidth: '560px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>پروفایل</h3>
              <TextField label="نام و نام خانوادگی" value={v.p?.name} placeholder="مثلاً علی احمدی" onChange={v.setName} />
              <TextField label="شماره موبایل" value={v.p?.phone} dir="ltr" placeholder="۰۹۱۲ ۰۰۰ ۰۰۰۰" onChange={v.setPhone} />
            </div>
          ) : null}
          {v.tUnits ? (
            <>
              <div
                style={{
                  maxWidth: '560px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>واحدها و قالب‌ها</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: '500' }}>واحد وزن</span>
                  <SegmentedControl options={v.wUnits} value={v.p?.wUnit} label="واحد وزن" fullWidth onChange={v.setWUnit} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: '500' }}>واحد طول</span>
                  <SegmentedControl options={v.lUnits} value={v.p?.lUnit} label="واحد طول" fullWidth onChange={v.setLUnit} />
                </div>
                <Select label="قالب تاریخ" value={v.p?.date} options={v.dateOpts} onChange={v.setDate} />
              </div>
            </>
          ) : null}
          {v.tAppearance ? <AppearanceSettings /> : null}
          {v.tTests ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                <div
                  style={{
                    gridColumn: 'span 2',
                    minWidth: '0',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                      <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>آزمون‌ها و شاخص‌ها</h3>
                      <span style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)' }}>در «ثبت آزمون» صفحه‌های تحلیل و اپ ورزشکار نمایش داده می‌شوند.</span>
                    </div>
                    <Button variant="secondary" icon="plus" onClick={v.newTest}>
                      آزمون جدید
                    </Button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) 100px minmax(0,1fr) 80px',
                      gap: '12px',
                      padding: '8px 24px',
                      background: 'var(--surface-sunken)',
                      fontSize: '12px',
                      lineHeight: '18px',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>آزمون</span>
                    <span>دسته</span>
                    <span>واحد</span>
                    <span>بهتر است</span>
                    <span></span>
                  </div>
                  {(v.tests || []).map((t: any, $index: number) => (
                    <Fragment key={$index}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr) 100px minmax(0,1fr) 80px',
                          gap: '12px',
                          alignItems: 'center',
                          padding: '12px 24px',
                          borderTop: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                          <span style={{ fontSize: '14px', lineHeight: '22px', fontWeight: '500' }}>{t?.name}</span>
                          <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{t?.src}</span>
                        </div>
                        <span style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--text-secondary)' }}>{t?.cat}</span>
                        <span style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--text-secondary)' }}>{t?.unit}</span>
                        <span style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--text-secondary)' }}>{t?.dir}</span>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <IconButton icon="edit" label="ویرایش" size="sm" onClick={t?.edit} />
                          {t?.custom ? (
                            <>
                              <IconButton icon="trash" label="حذف" size="sm" onClick={t?.remove} />
                            </>
                          ) : null}
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </div>
                <Card title="جهت «بهتر»">
                  <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)', textWrap: 'pretty' }}>
                    برای زمان‌ها (مثل دوی ۵ کیلومتر) «کمتر بهتر است» را انتخاب کنید تا کاهش عدد، سبز و پیشرفت نشان داده شود. برای وزنه، مسافت و ارتفاع پرش «بیشتر بهتر است».
                  </p>
                </Card>
              </div>
            </>
          ) : null}
          {v.tSecurity ? (
            <>
              <div
                style={{
                  maxWidth: '560px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>امنیت</h3>
                <DescriptionList columns={v.n1} items={v.secItems} />
                <TwoFactorPanel />
                <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>تغییر نام کاربری</h4>
                <ChangeUsernameForm />
                <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>تغییر رمز عبور</h4>
                <ChangePasswordForm />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Button variant="ghost" icon="log-out" onClick={v.signOut}>
                    خروج از حساب
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </PanelLayout>
    );
  }
}
