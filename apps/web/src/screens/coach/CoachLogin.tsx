// Ported from design handoff: project/C09 Coach Login.dc.html
import { type CSSProperties } from 'react';
import { landingPath, stepError, submitOtp, submitPassword } from '@/app/auth';
import { lastUsername } from '@/data/session';
import { Button, Checkbox, IndowLogo, TextField } from '@/ds';
import { navigate } from '@/lib/nav';
import { Screen, type ScreenState } from '../Screen';

export default class CoachLogin extends Screen {
  state: ScreenState = { email: lastUsername(), pw: '', tried: false, loading: false, remember: true, mfaToken: null, otp: '', err: null };
  renderVals() {
    const { email, pw, tried } = this.state;
    const emailBad = !email.trim();
    return {
      brand: this.props.brand ?? 'brand',
      loading: this.state.loading,
      setEmail: (v) => this.setState({ email: v }),
      setPw: (v) => this.setState({ pw: v }),
      emailError: tried && emailBad ? 'نام کاربری را وارد کنید.' : undefined,
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
            <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)' }}>شاگردها، برنامه‌ها و پیشرفت را مدیریت کنید.</p>
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
              <TextField label="نام کاربری" placeholder="نام کاربری" dir="ltr" value={this.state.email} onChange={v.setEmail} error={v.emailError} />
              <TextField label="رمز عبور" placeholder="رمز عبور خود را وارد کنید" type="password" onChange={v.setPw} error={v.pwError} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <Checkbox label="من را به خاطر بسپار" checked={v.remember} onChange={v.setRemember} />
              </div>
              <div style={{ display: 'flex', flexDirection: "column" ,gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <Button variant="primary" size="lg" fullWidth loading={v.loading} type="submit">
                    ورود
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
      </div>
    );
  }
}
