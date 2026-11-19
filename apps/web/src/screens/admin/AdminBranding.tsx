// Ported from design handoff: project/A07 Admin Branding.dc.html
import { createRef, useEffect, type CSSProperties } from 'react';
import {
  Banner,
  BottomNav,
  BrandColorField,
  BrandMark,
  Button,
  FileUpload,
  MetricCard,
  MobileHeader,
  PageHeader,
  SegmentedControl,
  Sidebar,
  StepIndicator,
  Tabs,
  TextField,
  TopBar,
  WorkoutCard,
} from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { go, param } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { api, faError } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import type { Coach } from '@/data/types';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/**
 * Data container: the coach in `?id=`; the screen starts from their saved branding.
 * Branding belongs to one coach, so without an id (sidebar link) it sends you to pick a coach.
 */
export default function AdminBrandingPage(props: { brand?: string }) {
  const id = param('id') || '';
  const coach = useQuery('coach:' + id, () => (id ? api.coaches.get(id) : Promise.resolve(undefined)));
  useEffect(() => {
    if (id) return;
    toast('یک مربی انتخاب کنید', 'برندینگ هر مربی از صفحه جزئیات همان مربی ویرایش می‌شود.', 'info');
    go('admin:coaches');
  }, [id]);
  const wait = id ? pending(coach) : null;
  if (!id || wait) return wait;
  return <AdminBranding key={coach.data?.id} {...props} coach={coach.data} />;
}

class AdminBranding extends Screen {
  state: ScreenState = {
    primary: this.props.coach.branding.primary,
    secondary: this.props.coach.branding.secondary,
    name: this.props.coach.branding.appName,
    logo: this.props.coach.branding.logoUrl ? 'done' : 'idle',
    logoSrc: this.props.coach.branding.logoUrl || null,
    logoName: this.props.coach.branding.logoUrl ? 'logo' : '',
    logoMeta: '',
    logoFile: null,
    logoRemoved: false,
    view: 'app',
    saving: false,
    rk: 0,
  };
  fileRef = createRef<HTMLInputElement>();
  lum(hex) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  ratio(a, b) {
    const x = this.lum(a),
      y = this.lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  darken(hex, target) {
    let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (let k = 0; k < 40 && this.ratio('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''), '#FFFFFF') < target; k++) {
      r = Math.round(r * 0.93);
      g = Math.round(g * 0.93);
      b = Math.round(b * 0.93);
    }
    return ('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')).toUpperCase();
  }
  renderVals() {
    const { primary, secondary, name, logo, view, saving } = this.state;
    const fa = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const r = (n) => n.toFixed(2).replace(/\.?0+$/, '') + ':1';
    const whiteR = this.ratio(primary, '#FFFFFF'),
      inkR = this.ratio(primary, '#111418');
    const whiteOk = whiteR >= 4.5;
    const onPrimary = whiteOk ? '#FFFFFF' : '#111418';
    const textOk = this.ratio(primary, '#FFFFFF') >= 4.5;
    const primaryText = textOk ? primary : this.darken(primary, 4.5);
    const initials = (
      name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2) || 'A'
    ).toUpperCase();
    const primaryChecks = whiteOk
      ? [
          { label: 'متن سفید روی این رنگ', ratio: r(whiteR), status: 'pass' },
          { label: 'لینک‌ها، تب‌ها و فوکوس', ratio: r(whiteR), status: 'pass' },
        ]
      : [
          { label: 'متن سفید روی این رنگ', ratio: r(whiteR), status: 'fail' },
          { label: 'متن دکمه به جوهری #111418 تغییر کرد', ratio: r(inkR), status: 'fixed' },
          { label: 'لینک‌ها، تب‌ها و فوکوس به ' + primaryText + ' تیره شدند', ratio: r(this.ratio(primaryText, '#FFFFFF')), status: 'fixed' },
        ];
    const secR = this.ratio(secondary, '#FFFFFF');
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'سینا توکلی', role: 'مدیر ارشد' }),
      coachUser: { name: (this.props.coach as Coach).name, role: 'سرمربی' },
      crumbs: [{ label: 'مربیان', to: 'admin:coaches' }, { label: this.props.coach.name, to: 'admin:coach?id=' + this.props.coach.id }, 'برندینگ'],
      pageTitle: 'برندینگ · ' + (name.trim() || 'بدون نام'),
      step: 2,
      steps: ['حساب', 'برندینگ', 'بازبینی و فعال‌سازی'],
      logoState: logo,
      initials,
      appName: name.trim() || 'بدون نام',
      noLogo: logo !== 'done',
      logoSrc: logo === 'done' ? this.state.logoSrc : undefined,
      logoName: this.state.logoName,
      logoMeta: this.state.logoMeta,
      fileRef: this.fileRef,
      onFile: (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) return toast('حجم فایل زیاد است', 'حداکثر ۲ مگابایت', 'error');
        this.setState({ logo: 'uploading' });
        const rd = new FileReader();
        rd.onload = () => {
          const kb = Math.max(1, Math.round(f.size / 1024));
          this.setState({
            logo: 'done',
            logoFile: f,
            logoSrc: rd.result,
            logoName: f.name,
            logoMeta: (f.type.split('/')[1] || '').replace('svg+xml', 'SVG').toUpperCase() + ' · ' + fa(kb) + ' KB',
          });
          toast('لوگو بارگذاری شد');
        };
        rd.readAsDataURL(f);
      },
      removeLogo: () => {
        this.setState({ logo: 'idle', logoSrc: null, logoFile: null, logoRemoved: true });
        toast('لوگو حذف شد', 'لوگوی پیش‌فرض (حروف اول نام اپ) استفاده می‌شود.');
      },
      uploadLogo: () => this.fileRef.current && this.fileRef.current.click(),
      setName: (v) => this.setState({ name: v.slice(0, 24) }),
      nameErr: name.trim() ? undefined : 'نام اپ را وارد کنید.',
      setPrimary: (v) => this.setState({ primary: v.toUpperCase() }),
      setSecondary: (v) => this.setState({ secondary: v.toUpperCase() }),
      primary,
      secondary,
      onPrimary,
      primaryText,
      primaryChecks,
      autoFixed: !whiteOk,
      secondaryChecks: [{ label: 'فقط به‌عنوان نوار تأکیدی', ratio: r(secR), status: secR >= 3 ? 'pass' : 'fixed' }],
      reset: () => {
        window.location.reload();
      },
      views: [
        { value: 'app', label: 'اپ ورزشکار' },
        { value: 'web', label: 'وب مربی' },
      ],
      setView: (v) => this.setState({ view: v }),
      isApp: view === 'app',
      isWeb: view === 'web',
      actions: [{ icon: 'chat', label: 'گفتگو', locked: true }],
      ex: 5,
      zero: 0,
      total: 17,
      pillTabs: [
        { id: 'a', label: 'این هفته' },
        { id: 'b', label: 'رکوردها' },
      ],
      webTabs: [
        { id: 'w', label: 'این هفته' },
        { id: 'n', label: 'نیاز به توجه' },
        { id: 'p', label: 'رکوردها' },
      ],
      ctaPreview: () => toast('این فقط پیش‌نمایش است', 'دکمه‌ها در اپ واقعی مربی فعال می‌شوند.'),
      saving,
      finish: async () => {
        if (!name.trim()) return toast('نام اپ خالی است', 'قبل از ادامه، نام اپ را وارد کنید.', 'error');
        this.setState({ saving: true });
        const coach: Coach = this.props.coach;
        const fd = new FormData();
        fd.append('appName', name.trim());
        fd.append('initials', initials);
        fd.append('primary', primary);
        fd.append('secondary', secondary);
        if (this.state.logoFile) fd.append('logo', this.state.logoFile);
        else if (this.state.logoRemoved) fd.append('removeLogo', 'true');
        try {
          await api.coaches.update(coach.id, fd);
          // While the coach is still being set up, continue to step 3 (review & activation).
          if (coach.status === 'draft' || coach.status === 'invited') go('admin:activate-coach?id=' + coach.id, { title: 'برندینگ ذخیره شد', desc: 'رنگ اصلی ' + primary });
          else go('admin:coach?id=' + coach.id, { title: 'برندینگ ذخیره شد', desc: 'رنگ اصلی ' + primary });
        } catch (e) {
          this.setState({ saving: false });
          toast('ذخیره نشد', faError(e), 'error');
        }
      },
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
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title={v.pageTitle} subtitle="مرحله ۲ از ۳ · ظاهر اپ ورزشکار و فضای کاری مربی" back="مربیان" backTo="admin:coaches" />
          <StepIndicator current={v.step} steps={v.steps} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div
              style={{
                minWidth: '0',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <FileUpload
                  label="لوگو"
                  optional
                  state={v.logoState}
                  fileName={v.logoName}
                  fileMeta={v.logoMeta}
                  previewInitials={v.initials}
                  previewSrc={v.logoSrc}
                  hint="SVG یا PNG مربعی، حداقل ۵۱۲ پیکسل · حداکثر ۲ مگابایت"
                  onRemove={v.removeLogo}
                  onReplace={v.uploadLogo}
                  onBrowse={v.uploadLogo}
                />
                {v.noLogo ? (
                  <>
                    <div
                      style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)' }}
                    >
                      <BrandMark initials={v.initials} variant="mark" size="sm" />
                      <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-secondary)' }}>
                        لوگوی پیش‌فرض: حروف اول نام اپ روی رنگ اصلی. هر زمان می‌توانید لوگوی اختصاصی بارگذاری کنید.
                      </span>
                    </div>
                  </>
                ) : null}
                <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" ref={v.fileRef} onChange={v.onFile} style={{ display: 'none' }} />
              </div>
              <TextField
                label="نام اپ"
                value={this.state.name}
                placeholder="مثلاً Kova Athletics"
                onChange={v.setName}
                error={v.nameErr}
                hint="حداکثر ۲۴ نویسه. زیر لوگو و در صفحه ورود نمایش داده می‌شود."
              />
              <BrandColorField label="رنگ اصلی" value={this.state.primary} onChange={v.setPrimary} checks={v.primaryChecks} />
              {v.autoFixed ? (
                <>
                  <Banner
                    tone="info"
                    title="اصلاح خودکار"
                    description="رنگ اصلی روی دکمه‌ها و لوگو باقی می‌ماند. متن‌ها و خطوط از سایه تیره‌تر استفاده می‌کنند تا همه صفحه‌ها خوانا بمانند. مربی لازم نیست کاری انجام دهد."
                  />
                </>
              ) : null}
              <BrandColorField label="رنگ ثانویه" value={this.state.secondary} onChange={v.setSecondary} checks={v.secondaryChecks} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Button variant="ghost" icon="arrow-right" to="admin:create-coach">
                  بازگشت
                </Button>
                <Button variant="secondary" onClick={v.reset}>
                  بازنشانی رنگ‌ها
                </Button>
                <Button variant="primary" iconRight="arrow-left" loading={v.saving} onClick={v.finish}>
                  ادامه به بازبینی
                </Button>
              </div>
            </div>
            <div style={{ minWidth: '0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>پیش‌نمایش زنده</h3>
                <SegmentedControl options={v.views} value="app" onChange={v.setView} size="sm" />
              </div>
              <div
                data-theme="kova"
                style={
                  {
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '24px',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-md)',
                    '--brand-primary': v.primary,
                    '--brand-primary-hover': v.primary,
                    '--brand-primary-pressed': v.primary,
                    '--on-brand-primary': v.onPrimary,
                    '--brand-primary-text': v.primaryText,
                    '--brand-secondary': v.secondary,
                    '--brand-secondary-text': v.secondary,
                    '--focus-ring': v.primaryText,
                  } as CSSProperties
                }
              >
                {v.isApp ? (
                  <>
                    <div
                      style={{
                        width: '360px',
                        border: '1px solid var(--border)',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        background: 'var(--background)',
                        boxShadow: 'var(--shadow-2)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <MobileHeader brand={v.appName} brandInitials={v.initials} brandSrc={v.logoSrc} large eyebrow="سه‌شنبه، ۱ مهر" title="صبح بخیر، ندا" actions={v.actions} />
                      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <WorkoutCard
                          variant="hero"
                          eyebrow="تمرین امروز"
                          title="پایین‌تنه B"
                          subtitle="هفته ۲ · روز ۳"
                          exercises={v.ex}
                          status="not-started"
                          setsDone={v.zero}
                          setsTotal={v.total}
                          ctaLabel="شروع تمرین"
                          onCta={v.ctaPreview}
                        />
                        <Tabs variant="pill" value="a" tabs={v.pillTabs} />
                      </div>
                      <BottomNav active="home" />
                    </div>
                  </>
                ) : null}
                {v.isWeb ? (
                  <>
                    <div
                      style={{
                        width: '100%',
                        height: '470px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        background: 'var(--background)',
                        boxShadow: 'var(--shadow-2)',
                        display: 'flex',
                      }}
                    >
                      <div style={{ width: '190px', flexShrink: '0', height: '100%', overflow: 'hidden' }}>
                        <div style={{ height: '100%' }}>
                          <Sidebar
                            app="coach"
                            active="dashboard"
                            brandName={v.appName}
                            brandInitials={v.initials}
                            brandSrc={v.logoSrc}
                            brandSub="فضای کاری مربی"
                            user={v.coachUser}
                          />
                        </div>
                      </div>
                      <div style={{ flex: '1 1 0', minWidth: '0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <h4 style={{ margin: '0', fontSize: '18px', lineHeight: '28px', fontWeight: '600' }}>{'سلام، ' + v.coachUser.name.split(' ')[0]}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px' }}>
                          <MetricCard label="ورزشکاران فعال" value="۰" caption="هنوز کسی دعوت نشده" icon="users" />
                          <MetricCard label="برنامه‌ها" value="۰" caption="اولین برنامه را بسازید" icon="clipboard" />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button variant="primary" icon="plus" size="sm" onClick={v.ctaPreview}>
                            دعوت ورزشکار
                          </Button>
                          <Button variant="secondary" size="sm" onClick={v.ctaPreview}>
                            ساخت برنامه
                          </Button>
                        </div>
                        <Tabs value="w" tabs={v.webTabs} />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>
                پیش‌نمایش از تم اصلاح‌شده استفاده می‌کند. رنگ نمودارها و وضعیت‌ها هرگز با برند تغییر نمی‌کند.
              </p>
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
