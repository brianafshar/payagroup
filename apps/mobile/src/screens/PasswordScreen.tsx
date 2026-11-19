import { useState } from 'react';
import { View } from 'react-native';
import { changePassword, signOut } from '../api/auth';
import { LIVE } from '../api/config';
import { ApiError, faError } from '../api/http';
import { session } from '../data/athlete';
import { useNav } from '../navigation/types';
import { Banner, Button, Footer, Icon, MobileHeader, Screen, TextField, toast, Txt } from '../ui';

/** Change password: from the profile, or forced right after signing in with an emailed temporary password. */
export function PasswordScreen() {
  const nav = useNav();
  const { mustChangePassword: forced } = session.use();
  const [f, setF] = useState({ cur: '', pw: '', pw2: '' });
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [curErr, setCurErr] = useState('');
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const okLen = f.pw.length >= 8;
  const okNum = /[0-9۰-۹]/.test(f.pw);
  const match = !!f.pw && f.pw === f.pw2;

  const save = async () => {
    setTried(true);
    setErr('');
    setCurErr('');
    if (!f.cur || !(okLen && okNum) || !match) return;
    setLoading(true);
    try {
      if (LIVE) await changePassword(f.cur, f.pw);
      toast('رمز عبور تغییر کرد', 'از دستگاه‌های دیگر خارج شدی.');
      if (!forced && nav.canGoBack()) nav.goBack();
    } catch (e) {
      if (e instanceof ApiError && e.fields.currentPassword) setCurErr('رمز فعلی درست نیست.');
      else setErr(e instanceof ApiError && e.fields.newPassword ? e.fields.newPassword : faError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      header={forced ? <MobileHeader title="رمز جدید بساز" /> : <MobileHeader title="تغییر رمز عبور" back="پروفایل" onBack={() => nav.goBack()} />}
      footer={
        <Footer gap={8}>
          <Button size="lg" fullWidth loading={loading} onPress={() => void save()}>
            ذخیره رمز جدید
          </Button>
          {forced ? (
            <Button variant="ghost" fullWidth onPress={() => void signOut()}>
              خروج از حساب
            </Button>
          ) : null}
        </Footer>
      }
    >
      {forced ? <Banner tone="warning" icon="key" title="رمز موقت" description="با رمزی که به ایمیلت فرستاده شد وارد شدی. برای ادامه یک رمز دلخواه برای خودت بگذار." /> : null}
      {err ? <Banner tone="error" title={err} /> : null}
      <TextField
        label={forced ? 'رمز موقت (از ایمیل)' : 'رمز فعلی'}
        type="password"
        size="lg"
        value={f.cur}
        onChange={(v) => {
          set('cur')(v);
          setCurErr('');
        }}
        error={curErr || (tried && !f.cur ? 'رمز فعلی را وارد کن.' : undefined)}
      />
      <TextField
        label="رمز جدید"
        type="password"
        size="lg"
        placeholder="حداقل ۸ کاراکتر"
        value={f.pw}
        onChange={set('pw')}
        error={tried && !(okLen && okNum) ? 'رمز باید حداقل ۸ کاراکتر و یک عدد داشته باشد.' : undefined}
      />
      <View style={{ gap: 4 }}>
        {(
          [
            [okLen, 'حداقل ۸ کاراکتر'],
            [okNum, 'حداقل یک عدد'],
          ] as const
        ).map(([ok, label]) => (
          <View key={label} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name={ok ? 'check-circle' : 'circle'} size={14} color={ok ? 'success' : 'text-muted'} />
            <Txt size={12} lh={18} color={ok ? 'text-primary' : 'text-muted'}>
              {label}
            </Txt>
          </View>
        ))}
      </View>
      <TextField label="تکرار رمز جدید" type="password" size="lg" value={f.pw2} onChange={set('pw2')} error={tried && !match ? 'تکرار رمز یکسان نیست.' : undefined} />
    </Screen>
  );
}
