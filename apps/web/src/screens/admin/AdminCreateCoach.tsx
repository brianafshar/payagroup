// Ported from design handoff: project/A04 Admin Create Coach.dc.html
import { Banner, Button, Checkbox, PageHeader, Select, Sidebar, StepIndicator, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { api, ApiError, faError } from '@/data/api';
import { SPORTS } from '@/data/exercises';
import { toast } from '@/lib/toast';
import { go } from '@/lib/nav';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

export default class AdminCreateCoach extends Screen {
  state: ScreenState = {
    sport: 'fitness',
    name: '',
    email: '',
    password: '',
    isHead: false,
    phone: '',
    app: '',
    cap: '',
    tried: false,
    dur: '60',
    days: '',
    remind: '2',
    saving: false,
    emailTaken: false,
    phoneErr: '',
  };
  renderVals() {
    const { name, email, password, isHead, phone, app, cap, tried, dur, days, remind, saving, emailTaken, phoneErr } = this.state;
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const en = (v) =>
      +String(v || '')
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/\D/g, '') || 0;
    const nDays = dur === 'custom' ? en(days) : +dur;
    const limited = dur !== 'none';
    const pd = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toLocaleDateString('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const daysBad = dur === 'custom' && !(nDays >= 1 && nDays <= 1095);
    const bad = { name: !name.trim(), email: !/^[A-Za-z0-9_.-]{3,40}$/.test(email.trim()), pw: password.length < 8 };
    /** Step 1 creates the coach as a draft; branding (step 2) and activation (step 3) complete it. */
    const create = async (then: 'branding' | 'list') => {
      if (bad.name || bad.email || bad.pw || daysBad) return this.setState({ tried: true });
      this.setState({ saving: then });
      try {
        const created = await api.coaches.create({
          name: name.trim(),
          username: email.trim(),
          password,
          isHead,
          phone: String(phone || '').replace(/\s/g, ''),
          appName: app.trim() || name.trim(),
          sport: this.state.sport,
          athleteCap: en(cap) || null,
          durationDays: limited ? nDays : null,
          reminderDays: +remind as 1 | 2 | 3 | 7,
          sendInvite: false,
        });
        if (then === 'branding') go('admin:branding?id=' + created.id);
        else go('admin:coaches', { title: 'پیش‌نویس ذخیره شد', desc: 'می‌توانید بعداً از فهرست مربیان ادامه دهید.' });
      } catch (e) {
        const taken = e instanceof ApiError && e.code === 'conflict';
        const badPhone = e instanceof ApiError && !!e.fields.phone;
        this.setState({ saving: false, tried: true, emailTaken: taken, phoneErr: badPhone ? 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.' : '' });
        // Anything else (permission, network, validation) must not fail silently.
        if (!taken && !badPhone)
          toast('مربی ساخته نشد', e instanceof ApiError && e.status === 403 ? 'برای ایجاد مربی، مجوز «ایجاد، فعال‌سازی و غیرفعال‌سازی مربیان» لازم است.' : faError(e), 'error');
      }
    };
    return {
      setName: (v) => this.setState({ name: v }),
      setEmail: (v) => this.setState({ email: v, emailTaken: false }),
      setPassword: (v) => this.setState({ password: v }),
      setHead: (v) => this.setState({ isHead: v }),
      pwErr: tried && bad.pw ? 'رمز عبور حداقل ۸ نویسه باشد.' : undefined,
      setPhone: (v) => this.setState({ phone: v, phoneErr: '' }),
      phoneErr: phoneErr || undefined,
      setApp: (v) => this.setState({ app: v }),
      setCap: (v) => this.setState({ cap: v }),
      saving,
      nameErr: tried && bad.name ? 'نام مربی را وارد کنید.' : undefined,
      emailErr: tried && bad.email ? 'نام کاربری: حروف انگلیسی، عدد و _ . - (حداقل ۳ نویسه).' : emailTaken ? 'این نام کاربری قبلاً ثبت شده است.' : undefined,
      saveDraft: () => create('list'),
      next: () => create('branding'),
      dur,
      setDur: (v) => this.setState({ dur: v }),
      isCustom: dur === 'custom',
      limited,
      days,
      setDays: (v) => this.setState({ days: v }),
      daysErr: tried && daysBad ? 'عددی بین ۱ تا ۱۰۹۵ روز وارد کنید.' : undefined,
      durOpts: [
        { value: 'none', label: 'نامحدود' },
        { value: '30', label: '۳۰ روز' },
        { value: '60', label: '۶۰ روز' },
        { value: '90', label: '۹۰ روز' },
        { value: '180', label: '۱۸۰ روز' },
        { value: '365', label: '۱ سال' },
        { value: 'custom', label: 'سفارشی…' },
      ],
      durHint: !limited ? 'حساب تا زمانی که دستی غیرفعال نکنید فعال می‌ماند.' : nDays > 0 ? 'از روز فعال‌سازی · پایان ' + pd(nDays) : 'از روز فعال‌سازی شمارش می‌شود.',
      remind,
      setRemind: (v) => this.setState({ remind: v }),
      remindOpts: [
        { value: '1', label: '۱ روز قبل' },
        { value: '2', label: '۲ روز قبل' },
        { value: '3', label: '۳ روز قبل' },
        { value: '7', label: '۷ روز قبل' },
      ],
      expTitle: nDays > 0 ? 'غیرفعال‌سازی خودکار در ' + pd(nDays) : 'غیرفعال‌سازی خودکار',
      expDesc:
        'مربی ' +
        fa(remind) +
        ' روز قبل از پایان، اعلان «' +
        fa(remind) +
        ' روز دیگر حساب شما غیرفعال می‌شود» را در پنل و ایمیل دریافت می‌کند. پس از پایان، ورود مربی و ورزشکارانش بسته می‌شود ولی داده‌ها حفظ می‌شوند و با تمدید برمی‌گردند.',
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'سینا توکلی', role: 'مدیر ارشد' }),
      crumbs: [{ label: 'مربیان', to: 'admin:coaches' }, 'مربی جدید'],
      step: 1,
      steps: ['حساب', 'برندینگ', 'بازبینی و فعال‌سازی'],
      langs: [
        { value: 'fa', label: 'فارسی (راست‌به‌چپ)' },
        { value: 'en', label: 'English' },
      ],
      sports: SPORTS.map(([value, label]) => ({ value, label })),
      sport: this.state.sport,
      setSport: (v) => this.setState({ sport: v }),
      units: [{ value: 'metric', label: 'متریک (kg، cm، km)' }],
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="admin" active="coaches" brandSub="مدیریت پلتفرم" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search searchPlaceholder="جستجوی مربی، ورزشکار" />}
      >
        <div style={{ flex: '1 1 auto', padding: '32px 32px 48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PageHeader title="ایجاد مربی" subtitle="مربی یک فضای کاری اختصاصی و یک اپ برند‌شده برای ورزشکاران دریافت می‌کند." back="مربیان" backTo="admin:coaches" />
          <StepIndicator current={v.step} steps={v.steps} />
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
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>حساب مربی</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                <TextField label="نام و نام خانوادگی" placeholder="مثلاً کاوه نیک‌پور" onChange={v.setName} error={v.nameErr} />
                <TextField label="نام کاربری" placeholder="مثلاً head_coach" dir="ltr" onChange={v.setEmail} error={v.emailErr} hint="مربی با این نام کاربری وارد می‌شود." />
                <TextField label="رمز عبور" type="password" onChange={v.setPassword} error={v.pwErr} hint="حداقل ۸ نویسه؛ آن را به مربی بدهید." />
                <Checkbox label="سرمربی (مدیریت مربیان زیرمجموعه)" checked={v.isHead} onChange={v.setHead} />
                <TextField label="تلفن" optional placeholder="۰۹۱۲ ..." inputMode="tel" onChange={v.setPhone} error={v.phoneErr} />
                <Select label="زبان" value="fa" options={v.langs} />
              </div>
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>فضای کاری</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                <TextField label="نام کسب‌وکار یا اپ" placeholder="مثلاً Kova Athletics" hint="روی اپ ورزشکار و صفحه ورود نمایش داده می‌شود." onChange={v.setApp} />
                <Select label="رشته" value={v.sport} options={v.sports} onChange={v.setSport} />
                <TextField label="سقف تعداد ورزشکار" placeholder="۵۰" inputMode="numeric" hint="هر زمان قابل افزایش است." onChange={v.setCap} />
              </div>
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>مدت اعتبار حساب</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                <Select label="مدت فعال بودن" value={v.dur} options={v.durOpts} onChange={v.setDur} hint={v.durHint} />
                {v.isCustom ? (
                  <>
                    <TextField label="تعداد روز" value={v.days} suffix="روز" placeholder="مثلاً ۴۵" inputMode="numeric" onChange={v.setDays} error={v.daysErr} />
                  </>
                ) : null}
                {v.limited ? (
                  <>
                    <Select label="یادآوری به مربی" value={v.remind} options={v.remindOpts} onChange={v.setRemind} />
                  </>
                ) : null}
              </div>
              {v.limited ? (
                <>
                  <Banner tone="info" icon="bell" title={v.expTitle} description={v.expDesc} />
                </>
              ) : null}
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <Banner tone="info" icon="mail" title="دعوت‌نامه در مرحله ۳ ارسال می‌شود" description="تا زمانی که در مرحله ۳ دعوت‌نامه را نفرستید، مربی نمی‌تواند وارد شود." />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Button variant="ghost" to="admin:coaches">
                  انصراف
                </Button>
                <Button variant="secondary" loading={v.saving === 'list'} onClick={v.saveDraft}>
                  ذخیره پیش‌نویس
                </Button>
                <Button variant="primary" iconRight="arrow-left" loading={v.saving === 'branding'} onClick={v.next}>
                  ادامه به برندینگ
                </Button>
              </div>
            </div>
            <div
              style={{
                minWidth: '0',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>مراحل بعدی</h3>
              <ul
                style={{
                  margin: '0',
                  paddingInlineStart: '18px',
                  fontSize: '14px',
                  lineHeight: '24px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <li>مرحله ۲: لوگو را بارگذاری و رنگ‌های برند را انتخاب کنید. ترکیب‌های رنگی ناخوانا خودکار اصلاح می‌شوند.</li>
                <li>مرحله ۳: بازبینی و فعال‌سازی. با فعال‌سازی، ایمیل دعوت ارسال می‌شود.</li>
                <li>هر زمان می‌توانید مربی را غیرفعال کنید؛ داده‌هایش حفظ می‌شود.</li>
              </ul>
              <Banner tone="info" description="مدیران حساب‌ها و برندینگ را مدیریت می‌کنند و به اطلاعات سلامت ورزشکاران دسترسی ندارند." />
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
