// Ported from design handoff: project/C13 Coach Create Athlete.dc.html
import { Button, Checkbox, PageHeader, Select, SensitiveSection, Sidebar, TextField, TopBar } from '@/ds';
import { SPORTS } from '@/data/exercises';
import { PanelLayout } from '@/app/PanelLayout';
import { go, href } from '@/lib/nav';
import { api, faError } from '@/data/api';
import { EX_CATS, EX_EQUIP } from '@/data/exercises';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import type { Gender, Goal } from '@/data/types';
import { faDate } from '@/lib/format';
import { toast } from '@/lib/toast';
import { panelUser, useSessionUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Data container: the coach's templates for the program picker and the exercise library. */
export default function CoachCreateAthletePage(props: { brand?: string }) {
  const programs = useQuery('programs', () => api.programs.list());
  const exercises = useQuery('exercises', api.exercises.list);
  const user = useSessionUser();
  const wait = pending(programs, exercises);
  if (wait) return wait;
  return <CoachCreateAthlete {...props} programs={programs.data} exercises={exercises.data} appName={user?.branding?.appName ?? ''} />;
}

/** Next three Saturdays as ISO dates (start options). */
function saturdays(): Array<{ value: string; label: string }> {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return [0, 7, 14].map((off) => {
    const x = new Date(d);
    x.setDate(d.getDate() + off);
    const iso = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    return { value: iso, label: faDate(x, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
  });
}

export class CoachCreateAthlete extends Screen {
  state: ScreenState = {
    name: '',
    email: '',
    phone: '',
    gender: null,
    goal: null,
    program: null,
    start: saturdays()[0].value,
    tried: false,
    saving: false,
    picked: [],
    exQ: '',
    customName: '',
    savedId: null,
  };
  renderVals() {
    const { name, email, program, start, tried, saving, picked, exQ, customName } = this.state;
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const lib = this.props.exercises.map((e) => ({ id: e.id, name: e.name, meta: [EX_CATS[e.cat] || e.cat, EX_EQUIP[e.equip] || e.equip].filter(Boolean).join(' · ') }));
    const togglePick = (id) => this.setState((st) => ({ picked: st.picked.includes(id) ? st.picked.filter((x) => x !== id) : [...st.picked, id] }));
    const shown = lib.filter((e) => !exQ.trim() || (e.name + ' ' + e.meta).includes(exQ.trim()));
    const bad = { name: !name.trim(), email: !/^\S+@\S+\.\S+$/.test(email) };
    const first = name.trim().split(/\s+/)[0] || 'ورزشکار';
    const programs = [
      { value: 'custom', label: 'برنامه شخصی — ساخت در برنامه‌ساز' },
      ...this.props.programs.filter((p) => p.kind === 'template').map((p) => ({ value: p.id, label: p.name + ' (نسخه ' + fa(p.version) + ')' })),
    ];
    const starts = saturdays();
    const prog = programs.find((p) => p.value === program);
    const st = starts.find((s) => s.value === start);
    /** Saves the athlete (optionally inviting by email) and returns to the list. */
    const submit = async (invite: boolean) => {
      if (bad.name || (invite && bad.email)) return this.setState({ tried: true });
      this.setState({ saving: invite ? 'invite' : 'save' });
      const { phone, gender, goal, savedId } = this.state;
      // Already saved as "invited" by copying the invite link — don't create a duplicate.
      if (!savedId)
        try {
          await api.athletes.create({
            name: name.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            gender: (gender as Gender) || undefined,
            goal: (goal as Goal) || undefined,
            sport: this.state.sport || 'fitness',
            programId: program && program !== 'custom' ? program : undefined,
            startDate: start,
            invite: invite ? 'email' : false,
          });
        } catch (e) {
          this.setState({ saving: false });
          return toast('ذخیره نشد', faError(e), 'error');
        }
      go(
        'coach:athletes',
        invite
          ? { title: 'دعوت‌نامه ارسال شد', desc: name.trim() + ' به ' + this.props.appName + ' دعوت شد.' }
          : { title: 'ورزشکار ذخیره شد', desc: name.trim() + ' بدون دعوت اضافه شد. هر زمان می‌توانید دعوت بفرستید.' },
      );
    };
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'ورزشکاران', to: 'coach:athletes' }, 'افزودن ورزشکار'],
      appName: this.props.appName,
      setName: (v) => this.setState({ name: v }),
      setEmail: (v) => this.setState({ email: v }),
      nameErr: tried && bad.name ? 'نام ورزشکار را وارد کنید.' : undefined,
      emailErr: tried && bad.email ? 'برای ارسال دعوت، یک ایمیل معتبر وارد کنید.' : undefined,
      genders: [
        { value: 'f', label: 'زن' },
        { value: 'm', label: 'مرد' },
        { value: 'x', label: 'ترجیح می‌دهم نگویم' },
      ],
      sports: SPORTS.map(([value, label]) => ({ value, label })),
      sport: this.state.sport || 'fitness',
      setSport: (v) => this.setState({ sport: v }),
      goals: [
        { value: 'loss', label: 'کاهش چربی' },
        { value: 'gain', label: 'عضله‌سازی' },
        { value: 'str', label: 'قدرت' },
        { value: 'gen', label: 'آمادگی عمومی' },
      ],
      setGoal: (v) => this.setState({ goal: v }),
      setGender: (v) => this.setState({ gender: v }),
      setPhone: (v) => this.setState({ phone: v }),
      healthNote: 'فعلاً اختیاری است. فقط برای ' + first + ' و شما قابل مشاهده است؛ هر مشاهده و ویرایش ثبت می‌شود.',
      programs,
      setProgram: (v) => {
        if (v === 'custom') {
          try {
            sessionStorage.setItem('bl-builder-return', JSON.stringify({ to: 'coach:create-athlete', label: 'بازگشت به افزودن ورزشکار', athlete: name.trim() || null }));
            sessionStorage.setItem(
              'bl-new-program',
              JSON.stringify({ name: 'برنامه اختصاصی ' + (name.trim() || 'ورزشکار'), weeks: 4, sessions: 3, saveAs: 'one', athlete: name.trim() || null }),
            );
          } catch (e) {}
          go('coach:program-builder');
          return;
        }
        this.setState({ program: v });
      },
      isCustom: program === 'custom',
      customPh: 'مثلاً برنامه اختصاصی ' + first,
      setCustomName: (v) => this.setState({ customName: v }),
      setExQ: (v) => this.setState({ exQ: v }),
      pickedLabel: picked.length ? fa(picked.length) + ' حرکت انتخاب شد' : 'هنوز حرکتی انتخاب نشده',
      exEmpty: shown.length === 0,
      exList: shown.map((e) => {
        const on = picked.includes(e.id);
        return {
          ...e,
          toggle: () => togglePick(e.id),
          bg: on ? 'var(--brand-primary-subtle)' : 'transparent',
          border: on ? 'var(--brand-primary)' : 'var(--border-strong, var(--border))',
          fill: on ? 'var(--brand-primary)' : 'var(--surface)',
          mark: on ? '✓' : '',
        };
      }),
      starts,
      startValue: start,
      setStart: (v) => this.setState({ start: v }),
      copyNote:
        program === 'custom'
          ? 'این برنامه فقط برای ' + first + ' ساخته می‌شود و قالبی ایجاد نمی‌کند. برنامه اختیاری است؛ می‌توانید بعداً هم اختصاص دهید.'
          : prog
            ? first + ' نسخه اختصاصی خودش را از «' + prog.label + '» می‌گیرد. تغییر آن هرگز روی قالب یا ورزشکاران دیگر اثر ندارد.'
            : 'می‌توانید برنامه را بعداً از پروفایل ورزشکار اختصاص دهید.',
      invitePreview:
        panelUser({ name: 'مربی‌تان', role: '' }).name +
        ' شما را به ' +
        this.props.appName +
        ' دعوت کرده است. اپ را نصب کنید و با ' +
        (email.trim() || 'ایمیل خود') +
        ' وارد شوید' +
        (prog ? ' تا ' + (program === 'custom' ? '«' + (customName.trim() || 'برنامه اختصاصی شما') + '»' : 'برنامه‌تان') + ' را از ' + st.label + ' ببینید.' : '.'),
      savingInvite: saving === 'invite',
      savingOnly: saving === 'save',
      inviteHref: href('m:invite'),
      saveOnly: () => submit(false),
      saveInvite: () => submit(true),
      inviteUrl: this.state.liveUrl || 'لینک پس از «کپی لینک» ساخته می‌شود',
      copyLabel: this.state.copied ? 'کپی شد' : 'کپی لینک',
      copyIcon: this.state.copied ? 'check' : 'copy',
      copyInvite: async () => {
        if (bad.name) return this.setState({ tried: true });
        {
          if (bad.email) return this.setState({ tried: true });
          try {
            let url: string | null | undefined;
            if (!this.state.savedId) {
              const a = await api.athletes.create({
                name: name.trim(),
                email: email.trim(),
                sport: this.state.sport || 'fitness',
                programId: program && program !== 'custom' ? program : undefined,
                startDate: start,
                invite: 'link',
              } as Parameters<typeof api.athletes.create>[0]);
              url = (a as { inviteLink?: { url: string | null } }).inviteLink?.url;
              this.setState({ savedId: a.id });
            } else url = (await api.auth.inviteLink({ kind: 'athlete', id: this.state.savedId }, { send: false })).url;
            if (url) {
              this.setState({ liveUrl: url });
              navigator.clipboard?.writeText(url).catch(() => {});
            }
          } catch (e) {
            return toast('لینک ساخته نشد', faError(e), 'error');
          }
          this.setState({ copied: true });
          return toast('لینک دعوت کپی شد', name.trim() + ' در حالت «دعوت‌شده» ذخیره شد. لینک را مستقیم برای ورزشکار بفرستید.');
        }
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
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title="افزودن ورزشکار" subtitle={'یک دعوت‌نامه برای اپ ' + v.appName + ' دریافت می‌کند.'} back="ورزشکاران" backTo="coach:athletes" />
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
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>حساب</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  <TextField label="نام و نام خانوادگی" placeholder="مثلاً ساناز احمدی" onChange={v.setName} error={v.nameErr} />
                  <TextField label="ایمیل" placeholder="name@example.com" hint="دعوت‌نامه به این آدرس ارسال می‌شود." onChange={v.setEmail} error={v.emailErr} />
                  <TextField label="تلفن" optional placeholder="۰۹۱۲ ..." dir="ltr" inputMode="tel" onChange={v.setPhone} />
                </div>
              </div>
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
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>اطلاعات شخصی</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  <TextField label="تاریخ تولد" placeholder="مثلاً ۱۳۸۰/۰۴/۱۳" />
                  <Select label="جنسیت" placeholder="انتخاب کنید" options={v.genders} onChange={v.setGender} />
                  <Select label="رشته" value={v.sport} options={v.sports} onChange={v.setSport} />
                  <TextField label="قد" placeholder="۱۶۶" suffix="cm" />
                  <TextField label="وزن" placeholder="۶۳٫۵" suffix="kg" />
                  <Select label="هدف" placeholder="انتخاب کنید" options={v.goals} onChange={v.setGoal} />
                </div>
              </div>
              <SensitiveSection title="اطلاعات سلامت" accessNote={v.healthNote}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                    <TextField label="آسیب‌ها" optional placeholder="مثلاً جراحی زانو ۱۴۰۱" />
                    <TextField label="داروها" optional placeholder="مثلاً ندارد" />
                    <TextField label="حساسیت‌ها" optional placeholder="مثلاً لاکتوز" />
                    <TextField label="محدودیت‌های جسمی" optional placeholder="مثلاً پرهیز از پرش" />
                  </div>
                  <Checkbox
                    label="از ورزشکار بخواهید پروفایل سلامت را در اپ کامل کند"
                    description="توصیه می‌شود. ورزشکار جزئیات را به‌صورت خصوصی اضافه می‌کند؛ پس از ذخیره شما هم می‌بینید."
                    checked
                  />
                </div>
              </SensitiveSection>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Button variant="ghost" to="coach:athletes">
                  انصراف
                </Button>
                <Button variant="secondary" loading={v.savingOnly} onClick={v.saveOnly}>
                  ذخیره بدون دعوت
                </Button>
                <Button variant="primary" icon="send" loading={v.savingInvite} onClick={v.saveInvite}>
                  ذخیره و ارسال دعوت
                </Button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
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
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>اختصاص برنامه</h3>
                <Select label="برنامه" optional placeholder="بدون برنامه" options={v.programs} onChange={v.setProgram} />
                <Select label="تاریخ شروع" value={v.startValue} options={v.starts} onChange={v.setStart} />
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)', textWrap: 'pretty' }}>{v.copyNote}</p>
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
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>پیش‌نمایش دعوت‌نامه</h3>
                <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)', textWrap: 'pretty' }}>{v.invitePreview}</p>
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>
                  {'ارسال از '}
                  <span dir="ltr" style={{ fontFamily: 'var(--font-mono)' }}>
                    no-reply@indow.ir
                  </span>
                </p>
                <div style={{ height: '1px', background: 'var(--border)' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '500' }}>یا لینک را خودتان بفرستید</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div
                      dir="ltr"
                      style={{
                        flex: '1',
                        minWidth: '0',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-sunken)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {v.inviteUrl}
                    </div>
                    <Button variant="secondary" size="sm" icon={v.copyIcon} onClick={v.copyInvite}>
                      {v.copyLabel}
                    </Button>
                  </div>
                  <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>
                    مثلاً در واتس‌اپ یا تلگرام. لینک ۷ روز و یک بار معتبر است و با کپی، ورزشکار در حالت «دعوت‌شده» ذخیره می‌شود.
                  </span>
                </div>
                <a href={v.inviteHref} style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '500' }}>
                  دیدن تجربه شاگرد از دعوت
                </a>
              </div>
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
