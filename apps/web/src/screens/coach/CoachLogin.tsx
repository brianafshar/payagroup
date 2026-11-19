// Ported from design handoff: project/C09 Coach Login.dc.html
import { type CSSProperties } from 'react';
import { landingPath, stepError, submitOtp, submitPassword } from '@/app/auth';
import { api, faError } from '@/data/api';
import { Button, Checkbox, IndowLogo, Modal, TextField } from '@/ds';
import { navigate } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { Screen, type ScreenState } from '../Screen';

export default class CoachLogin extends Screen {
  state: ScreenState = { email: '', pw: '', tried: false, loading: false, remember: true, mfaToken: null, otp: '', err: null };
  renderVals() {
    const { email, pw, tried } = this.state;
    const emailBad = !/^\S+@\S+\.\S+$/.test(email);
    return {
      brand: this.props.brand ?? 'brand',
      loading: this.state.loading,
      setEmail: (v) => this.setState({ email: v }),
      setPw: (v) => this.setState({ pw: v }),
      emailError: tried && emailBad ? 'یک ایمیل معتبر وارد کنید.' : undefined,
      pwError: this.props.showError
        ? 'رمز عبور درست نیست. دوباره تلاش کنید یا آن را بازنشانی کنید.'
        : this.state.err && !this.state.mfaToken
          ? this.state.err
          : tried && !pw
            ? 'رمز عبور را وارد کنید.'
            : undefined,
      setRemember: (on) => this.setState({ remember: on }),
      mfa: !!this.state.mfaToken,
      setOtp: (v) => this.setState({ otp: v, err: null }),
      otpError: this.state.mfaToken && this.state.err ? this.state.err : undefined,
      verify: async () => {
        if (!this.state.otp.trim()) return this.setState({ err: 'کد ۶ رقمی را وارد کنید.' });
        this.setState({ loading: true });
        const r = await submitOtp(this.state.mfaToken, this.state.otp);
        if ('done' in r) return navigate(landingPath(r.done));
        const error = stepError(r);
        this.setState({ loading: false, err: error, ...(error.includes('دوباره وارد') ? { mfaToken: null } : {}) });
      },
      back: (e) => {
        e.preventDefault();
        this.setState({ mfaToken: null, otp: '', err: null, loading: false });
      },
      fpOpen: !!this.state.fp,
      fpForm: this.state.fp === 'form',
      fpTitle: this.state.fp === 'sent' ? 'رمز جدید ارسال شد' : 'بازیابی رمز عبور',
      fpDesc:
        this.state.fp === 'sent'
          ? 'اگر ' +
            this.state.fpEmail.trim() +
            ' ثبت شده باشد، تا چند دقیقه یک رمز جدید به آن ایمیل می‌رسد. پوشه اسپم را هم بررسی کنید. بعد از ورود، رمز دلخواه خودتان را بگذارید.'
          : 'ایمیل حسابتان را وارد کنید تا یک رمز جدید برایتان ایمیل شود. رمز فعلی دیگر کار نمی‌کند.',
      fpPrimary: this.state.fp === 'sent' ? 'متوجه شدم' : 'ارسال رمز جدید',
      fpSecondary: this.state.fp === 'sent' ? undefined : 'انصراف',
      fpEmail: this.state.fpEmail || '',
      setFpEmail: (v) => this.setState({ fpEmail: v, fpTried: false }),
      fpErr:
        this.state.fpTried && !/^\S+@\S+\.\S+$/.test((this.state.fpEmail || '').trim())
          ? (this.state.fpEmail || '').trim()
            ? 'این ایمیل معتبر نیست.'
            : 'ایمیل را وارد کنید.'
          : undefined,
      fpSubmit: async () => {
        if (this.state.fp === 'sent') return this.setState({ fp: null });
        if (!/^\S+@\S+\.\S+$/.test((this.state.fpEmail || '').trim())) return this.setState({ fpTried: true });
        // Self-service only ever emails the new password — it is never shown here.
        try {
          await api.auth.requestReset(this.state.fpEmail.trim());
        } catch (e) {
          return toast('ارسال نشد', faError(e), 'error');
        }
        this.setState({ fp: 'sent' });
      },
      fpClose: () => this.setState({ fp: null }),
      forgot: (e) => {
        e.preventDefault();
        this.setState({ fp: 'form', fpTried: false, fpEmail: this.state.email || '' });
      },
      // #79: real pages, not toasts.
      privacy: (e) => {
        e.preventDefault();
        navigate('/privacy');
      },
      help: (e) => {
        e.preventDefault();
        navigate('/help');
      },
      signIn: async () => {
        if (emailBad || !pw) return this.setState({ tried: true });
        this.setState({ loading: true, err: null });
        const r = await submitPassword(email, pw, 'coach', this.state.remember);
        if ('done' in r) return navigate(landingPath(r.done));
        if ('mfaToken' in r) return this.setState({ loading: false, mfaToken: r.mfaToken, otp: '' });
        this.setState({ loading: false, err: stepError(r) });
      },
      guestSignIn: async () => {
        this.setState({ loading: true, err: null });
        const r = await submitPassword("guest@gmail.com", "guest123", 'coach', this.state.remember);
        if ('done' in r) return navigate(landingPath(r.done));
        if ('mfaToken' in r) return this.setState({ loading: false, mfaToken: r.mfaToken, otp: '' });
        this.setState({ loading: false, err: stepError(r) });
      },

    };
  }

  render() {
    const v = this.vals();
    return (
      <div
        data-theme={v.brand}
        dir="rtl"
        style={
          {
            width: '100%',
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#0a0a0a',
            backgroundImage:
              'linear-gradient(135deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.6) 55%, #0a0a0a 90%), repeating-linear-gradient(45deg, transparent 0 38px, rgba(255,154,31,0.45) 38px 40px)',
            color: 'var(--text-primary)',
            fontFamily: "'Vazirmatn',var(--font-sans)",
            '--font-sans': "'Vazirmatn',system-ui,sans-serif",
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            padding: '24px 16px',
          } as CSSProperties
        }
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 'clamp(20px, 6vw, 40px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
            <IndowLogo height={40} />
            <span style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)' }}>فضای کاری مربی</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h2 style={{ margin: '0', fontSize: '20px', lineHeight: '32px', fontWeight: '600' }}>ورود به فضای کاری مربی</h2>
            <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)' }}>ورزشکاران، برنامه‌ها و پیشرفت را مدیریت کنید.</p>
          </div>
          {v.mfa ? (
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              onSubmit={(e) => {
                e.preventDefault();
                v.verify();
              }}
            >
              <p style={{ margin: 0, fontSize: 14, lineHeight: '24px', color: 'var(--text-secondary)' }}>کد ۶ رقمی اپ احراز هویت (یا یکی از کدهای بازیابی) را وارد کنید.</p>
              <TextField key="otp" label="کد تأیید" placeholder="۱۲۳ ۴۵۶" dir="ltr" inputMode="numeric" icon="shield" onChange={v.setOtp} error={v.otpError} />
              <Button variant="primary" size="lg" fullWidth loading={v.loading} type="submit">
                تأیید و ورود
              </Button>
              <a href="#" onClick={v.back} style={{ fontSize: '14px', lineHeight: '22px', fontWeight: '500' }}>
                بازگشت
              </a>
            </form>
          ) : (
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              onSubmit={(e) => {
                e.preventDefault();
                v.signIn();
              }}
            >
              <TextField label="ایمیل" placeholder="name@example.com" type="email" dir="ltr" onChange={v.setEmail} error={v.emailError} />
              <TextField label="رمز عبور" placeholder="رمز عبور خود را وارد کنید" type="password" onChange={v.setPw} error={v.pwError} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <Checkbox label="من را به خاطر بسپار" checked={v.remember} onChange={v.setRemember} />
                <div style={{ flex: '1' }}></div>
                <a href="#" onClick={v.forgot} style={{ fontSize: '14px', lineHeight: '22px', fontWeight: '500' }}>
                  رمز عبور را فراموش کرده‌اید؟
                </a>
              </div>
              <div style={{ display: 'flex', flexDirection: "column" ,gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <Button variant="primary" size="lg" fullWidth loading={v.loading} type="submit">
                    ورود
                  </Button>
                </div>
                <div style={{ flex: 1 }}>
                  <Button variant="secondary" size="lg" fullWidth loading={v.loading} type="button" onClick={v.guestSignIn}>
                    ورود به عنوان مهمان
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px', lineHeight: '18px', color: '#a3aab5' }}>
          <span>·</span>
          <a href="/privacy" onClick={v.privacy} style={{ color: '#c9ced6' }}>
            حریم خصوصی
          </a>
          <span>·</span>
          <a href="/help" onClick={v.help} style={{ color: '#c9ced6' }}>
            راهنما
          </a>
        </div>
        {v.fpOpen ? (
          <>
            <div style={{ position: 'absolute', inset: '0' }}>
              <Modal title={v.fpTitle} description={v.fpDesc} primaryLabel={v.fpPrimary} secondaryLabel={v.fpSecondary} onPrimary={v.fpSubmit} onClose={v.fpClose}>
                {v.fpForm ? (
                  <>
                    <TextField label="ایمیل" type="email" inputMode="email" placeholder="name@example.com" value={v.fpEmail} onChange={v.setFpEmail} error={v.fpErr} />
                  </>
                ) : null}
              </Modal>
            </div>
          </>
        ) : null}
      </div>
    );
  }
}
