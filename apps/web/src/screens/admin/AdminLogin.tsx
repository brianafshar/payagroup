// Ported from design handoff: project/A01 Admin Login.dc.html
import { type CSSProperties } from 'react';
import { landingPath, stepError, submitOtp, submitPassword } from '@/app/auth';
import { api, faError } from '@/data/api';
import { Button, Checkbox, Icon, IndowLogo, TextField } from '@/ds';
import { navigate } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { Screen, type ScreenState } from '../Screen';

export default class AdminLogin extends Screen {
  state: ScreenState = { loading: false, email: '', pw: '', tried: false, remember: true, mfaToken: null, otp: '', err: null };
  renderVals() {
    const brand = this.props.brand ?? 'brand';
    const { email, pw, tried } = this.state;
    const emailBad = !email.trim();
    return {
      brand,
      loading: this.state.loading,
      setEmail: (v) => this.setState({ email: v }),
      setPw: (v) => this.setState({ pw: v }),
      emailError: tried && emailBad ? 'نام کاربری را وارد کنید.' : undefined,
      pwError: this.props.showError ? 'نام کاربری یا رمز عبور درست نیست. دوباره تلاش کنید.' : this.state.err ? this.state.err : tried && !pw ? 'رمز عبور را وارد کنید.' : undefined,
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
      iconSize: 16,
      forgot: async (e) => {
        e.preventDefault();
        if (emailBad) return this.setState({ tried: true });
        // Self-service only ever emails the new password.
        try {
          await api.auth.requestReset(email.trim());
        } catch (err) {
          return toast('ارسال نشد', faError(err), 'error');
        }
        toast('رمز جدید ارسال شد', 'اگر این ایمیل ثبت شده باشد، یک رمز جدید به آن ایمیل می‌شود. بعد از ورود، رمز دلخواه خودتان را بگذارید.');
      },
      signIn: async () => {
        if (emailBad || !pw) return this.setState({ tried: true });
        this.setState({ loading: true, err: null });
        const r = await submitPassword(email, pw, 'admin', this.state.remember);
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
          } as CSSProperties
        }
      >
        <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px, 5vw, 48px)', boxSizing: 'border-box' }}>
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 'clamp(20px, 6vw, 32px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box',
            }}
          >
            <IndowLogo height={36} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h2 style={{ margin: '0', fontSize: '20px', lineHeight: '32px', fontWeight: '600' }}>ورود به پنل مدیریت</h2>
              <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)' }}>با حساب مدیر indow وارد شوید.</p>
            </div>
            {v.mfa ? (
              <form
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
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
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  v.signIn();
                }}
              >
                <TextField label="نام کاربری" placeholder="نام کاربری" dir="ltr" onChange={v.setEmail} error={v.emailError} />
                <TextField label="رمز عبور" placeholder="رمز عبور خود را وارد کنید" type="password" onChange={v.setPw} error={v.pwError} />
                <Checkbox label="من را به خاطر بسپار" checked={v.remember} onChange={v.setRemember} />
                <Button variant="primary" size="lg" fullWidth loading={v.loading} type="submit">
                  ورود
                </Button>
                <a href="#" onClick={v.forgot} style={{ fontSize: '14px', lineHeight: '22px', fontWeight: '500' }}>
                  رمز عبور را فراموش کرده‌اید؟
                </a>
              </form>
            )}
            <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Icon name="shield" size={v.iconSize} color="text-muted" />
              <p style={{ margin: '0', fontSize: '12px', lineHeight: '20px', color: 'var(--text-muted)' }}>دسترسی مدیر نیازمند تأیید دومرحله‌ای است. همه ورودها ثبت می‌شوند.</p>
            </div>
            <a href="/coach/login" style={{ fontSize: '14px', lineHeight: '22px', fontWeight: '500' }}>
              مربی هستید؟ ورود به فضای کاری مربی
            </a>
          </div>
        </div>
      </div>
    );
  }
}
