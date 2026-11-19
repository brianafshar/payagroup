// Design: project/M34 Athlete Login.dc.html
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forgotPassword, signIn as liveSignIn } from '../api/auth';
import { LIVE } from '../api/config';
import { faError } from '../api/http';
import { session } from '../data/athlete';
import { EMAIL } from '../lib';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { Banner, BRAND, BrandMark, Button, KEYBOARD_BEHAVIOR, LoginBackdrop, Modal, TextField, Txt } from '../ui';

export function LoginScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [fp, setFp] = useState<null | 'form' | 'sent'>(null);
  const [fpEmail, setFpEmail] = useState('');
  const [fpTried, setFpTried] = useState(false);
  const bad = !EMAIL.test(email.trim());
  const fpOk = EMAIL.test(fpEmail.trim());

  const signIn = () => {
    if (bad || !pw) return setTried(true);
    setLoading(true);
    setErr('');
    if (!LIVE) return void setTimeout(() => session.set({ signedIn: true }), 700);
    liveSignIn(email, pw).catch((e) => {
      setLoading(false);
      setErr(faError(e));
    });
  };
  // Forgot password emails a new password — it is never shown on screen.
  const fpSubmit = async () => {
    if (fp === 'sent') return setFp(null);
    if (!fpOk) return setFpTried(true);
    if (LIVE) {
      try {
        await forgotPassword(fpEmail);
      } catch (e) {
        setFp(null);
        return setErr(faError(e));
      }
    }
    setFp('sent');
  };

  return (
    <LoginBackdrop>
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center' }}>
            <BrandMark name={BRAND.name} initials={BRAND.initials} size="lg" inverse />
          </View>
          <View
            style={{
              width: '100%',
              maxWidth: 440,
              alignSelf: 'center',
              backgroundColor: c.surface,
              borderRadius: 24,
              paddingTop: 28,
              paddingHorizontal: 20,
              paddingBottom: 24,
              gap: 16,
            }}
          >
            <View style={{ gap: 4 }}>
              <Txt size={24} lh={36} w={700} accessibilityRole="header">
                خوش برگشتی
              </Txt>
              <Txt size={15} lh={24} color="text-secondary">
                وارد شو تا تمرین امروزت از طرف مربی را ببینی.
              </Txt>
            </View>
            {err ? <Banner tone="error" title={err} /> : null}
            <TextField
              label="ایمیل"
              placeholder="name@example.com"
              size="lg"
              type="email"
              ltr
              value={email}
              onChange={setEmail}
              error={tried && bad ? 'یک ایمیل معتبر وارد کنید.' : undefined}
            />
            <TextField
              label="رمز عبور"
              placeholder="رمز عبور خود را وارد کنید"
              size="lg"
              type="password"
              value={pw}
              onChange={setPw}
              error={tried && !pw ? 'رمز عبور را وارد کنید.' : undefined}
              onSubmitEditing={signIn}
            />
            <Button size="lg" fullWidth loading={loading} onPress={signIn}>
              ورود
            </Button>
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                setFp('form');
                setFpTried(false);
                setFpEmail(email);
              }}
              style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}
            >
              <Txt size={14} lh={22} w={500} color="brand-primary-text">
                رمز عبور را فراموش کرده‌اید؟
              </Txt>
            </Pressable>
            <Txt size={12} lh={20} color="text-muted" align="center">
              {'تازه وارد شده‌ای؟ '}
              <Txt size={12} lh={20} w={500} color="brand-primary-text" onPress={LIVE ? undefined : () => nav.navigate('Invite')} accessibilityRole={LIVE ? undefined : 'link'}>
                ایمیل دعوت مربی‌ات
              </Txt>
              {' را باز کن و رمز بساز.'}
            </Txt>
          </View>
          {/* The platform under the coach's own brand. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: 0.85 }} accessibilityLabel="ساخته‌شده با indow">
            <Txt size={11} lh={16} color="#bdbdbd">
              ساخته‌شده با
            </Txt>
            <Image source={require('../../assets/brand/wordmark-reversed.png')} style={{ width: 66, height: 16 }} resizeMode="contain" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        open={!!fp}
        title={fp === 'sent' ? 'رمز جدید ارسال شد' : 'بازیابی رمز عبور'}
        description={
          fp === 'sent'
            ? 'اگر ' + fpEmail.trim() + ' ثبت شده باشد، تا چند دقیقه یک رمز جدید به آن ایمیل می‌رسد. پوشه اسپم را هم بررسی کن.'
            : 'ایمیل حسابت را وارد کن تا یک رمز جدید برایت ایمیل شود. رمز فعلی دیگر کار نمی‌کند.'
        }
        primaryLabel={fp === 'sent' ? 'متوجه شدم' : 'ارسال رمز جدید'}
        secondaryLabel={fp === 'sent' ? undefined : 'انصراف'}
        onPrimary={fpSubmit}
        onClose={() => setFp(null)}
      >
        {fp === 'form' ? (
          <TextField
            label="ایمیل"
            type="email"
            ltr
            placeholder="name@example.com"
            value={fpEmail}
            onChange={(v) => {
              setFpEmail(v);
              setFpTried(false);
            }}
            error={fpTried && !fpOk ? (fpEmail.trim() ? 'این ایمیل معتبر نیست.' : 'ایمیل را وارد کن.') : undefined}
          />
        ) : null}
      </Modal>
    </LoginBackdrop>
  );
}
