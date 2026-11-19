// Design: project/M48 Athlete Invite.dc.html
import { fromJalali, parseFaNumber } from '@baseline/core';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { acceptInvite, enterApp, inviteInfo, type InviteInfo } from '../api/auth';
import { LIVE, SITE_URL } from '../api/config';
import { ApiError, faError, http } from '../api/http';
import { addMeasurement, ATHLETE, health, session } from '../data/athlete';
import { addMeasurements, saveHealth } from '../data/live';
import type { RootStackParamList } from '../navigation/types';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { Banner, BRAND, BrandMark, Button, Checkbox, Icon, KEYBOARD_BEHAVIOR, LoginBackdrop, Switch, TextField, toast, Txt } from '../ui';

type Step = 'mail' | 'accept' | 'basics' | 'health' | 'expired';

/** Email invite → accept (set password) → basics → health, or the expired-link state. */
export function InviteScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'Invite'>>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const token = route.params?.token;
  const [step, setStep] = useState<Step>(route.params?.step ?? (LIVE && token ? 'accept' : 'mail'));
  // Live: who the invite is for (null while loading). Without a token the screen shows the design preview.
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!LIVE || !token) return;
    inviteInfo(token)
      .then((i) => {
        setInfo(i);
        if (i.expired || i.used || i.kind !== 'athlete') setStep('expired');
      })
      .catch(() => setStep('expired'));
  }, [token]);
  const who = info ? { first: info.name.split(' ')[0], coach: info.coachName || '', email: info.email } : ATHLETE;
  const [f, setF] = useState({ pw: '', pw2: '', terms: false, dob: '', height: '', weight: '', fat: '', inj: '', cond: '', notif: true });
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const okLen = f.pw.length >= 8;
  const okNum = /[0-9۰-۹]/.test(f.pw);
  const match = !!f.pw && f.pw === f.pw2;
  const idx = ({ accept: 0, basics: 1, health: 2 } as Record<string, number | undefined>)[step];

  const activate = () => {
    if (!(okLen && okNum && match && f.terms)) return setTried(true);
    setLoading(true);
    setErr('');
    if (LIVE && token)
      return void acceptInvite(token, f.pw)
        .then(() => setStep('basics'))
        .catch((e) => {
          if (e instanceof ApiError && (e.code === 'invite_expired' || e.code === 'invite_unknown')) setStep('expired');
          else setErr(e instanceof ApiError && e.fields.password ? e.fields.password : faError(e));
        })
        .finally(() => setLoading(false));
    setTimeout(() => {
      setLoading(false);
      setStep('basics');
    }, 600);
  };
  /** Live: birth date (Jalali yyyy/mm/dd) goes to the athlete profile; height, weight and fat become the first measurement. */
  const saveBasics = async () => {
    const [jy, jm, jd] = f.dob.split(/[/-]/).map((x) => parseFaNumber(x) || 0);
    const body: Record<string, unknown> = {};
    if (jy > 1300 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31) {
      const d = fromJalali(jy, jm, jd, 12);
      body.birthDate = d.toISOString().slice(0, 10);
    }
    if (Object.keys(body).length) await http.patch('/me/athlete/', body).catch(() => {});
  };
  const finish = () => {
    const w = parseFaNumber(f.weight);
    const fat = parseFaNumber(f.fat);
    const h = parseFaNumber(f.height);
    if (LIVE && token) {
      setLoading(true);
      const extra = { ...(f.inj.trim() ? { inj: f.inj.trim() } : {}), ...(f.cond.trim() ? { cond: f.cond.trim() } : {}) };
      return void Promise.all([
        saveBasics(),
        addMeasurements({ ...(h && h > 50 && h < 260 ? { h } : {}), ...(w && w > 0 ? { w } : {}), ...(fat && fat > 0 ? { f: fat } : {}) }),
        Object.keys(extra).length ? saveHealth(extra) : null,
      ]).finally(() => {
        enterApp(true);
        toast('حسابت فعال شد', 'به ' + BRAND.name + ' خوش آمدی.');
      });
    }
    // Weight and fat become the first measurement; health notes go to the private health profile.
    if (w && w > 0) addMeasurement(fat && fat > 0 ? { w, f: fat } : { w });
    if (f.inj.trim() || f.cond.trim())
      health.set((s) => ({ v: { ...s.v, ...(f.inj.trim() ? { inj: f.inj.trim() } : {}), ...(f.cond.trim() ? { cond: f.cond.trim() } : {}) }, updated: 'امروز' }));
    setLoading(true);
    setTimeout(() => {
      session.set({ signedIn: true, onboarded: true });
      toast('حسابت فعال شد', 'برنامه «' + ATHLETE.program + '» آماده است.');
    }, 600);
  };
  const resend = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setResent(true);
    }, 700);
  };

  const heading = (t: string, sub: string, big = false) => (
    <View style={{ gap: 4 }}>
      <Txt size={big ? 24 : 22} lh={big ? 36 : 34} w={700} accessibilityRole="header">
        {t}
      </Txt>
      <Txt size={big ? 15 : 14} lh={big ? 24 : 22} color="text-secondary">
        {sub}
      </Txt>
    </View>
  );

  let sheet: ReactNode = null;
  if (step === 'accept')
    sheet = (
      <>
        {heading('خوش آمدی، ' + who.first, (who.coach ? 'مربی‌ات ' + who.coach + ' منتظرت است. ' : '') + 'یک رمز بساز تا وارد شوی.', true)}
        {err ? <Banner tone="error" title={err} /> : null}
        <TextField label="ایمیل" value={who.email} readOnly size="lg" ltr />
        <TextField
          label="رمز عبور"
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
        <TextField
          label="تکرار رمز عبور"
          type="password"
          size="lg"
          placeholder="رمز را دوباره وارد کنید"
          value={f.pw2}
          onChange={set('pw2')}
          error={tried && !match ? 'تکرار رمز یکسان نیست.' : undefined}
        />
        <Checkbox label="شرایط استفاده و حریم خصوصی را می‌پذیرم" checked={f.terms} onChange={set('terms')} error={tried && !f.terms ? 'برای ادامه باید بپذیری.' : undefined} />
        {LIVE && SITE_URL ? (
          <Txt size={12} lh={18} w={500} color="brand-primary-text" onPress={() => void Linking.openURL(SITE_URL + '/privacy')} accessibilityRole="link">
            خواندن حریم خصوصی
          </Txt>
        ) : null}
        <Button size="lg" fullWidth loading={loading} onPress={activate}>
          فعال‌سازی و ادامه
        </Button>
      </>
    );
  else if (step === 'basics')
    sheet = (
      <>
        {heading('کمی درباره خودت', 'مربی با این اطلاعات وزنه‌ها و برنامه را دقیق‌تر تنظیم می‌کند.')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {(
            [
              ['dob', 'تاریخ تولد', '۱۳۷۰/۰۱/۰۱', undefined, false, 'text'],
              ['height', 'قد', 'مثلاً ۱۷۵', 'cm', false, 'decimal'],
              ['weight', 'وزن فعلی', 'مثلاً ۷۵', 'kg', false, 'decimal'],
              ['fat', 'چربی بدن', 'اگر می‌دانی', '٪', true, 'decimal'],
            ] as const
          ).map(([k, label, ph, suffix, optional, type]) => (
            <View key={k} style={{ width: '47%', flexGrow: 1 }}>
              <TextField label={label} placeholder={ph} suffix={suffix} optional={optional} type={type} value={f[k]} onChange={set(k)} />
            </View>
          ))}
        </View>
        <Txt size={12} lh={18} color="text-muted">
          وزن و چربی به‌عنوان اولین اندازه‌گیری‌ات ثبت می‌شود.
        </Txt>
        <Button size="lg" fullWidth onPress={() => setStep('health')}>
          ادامه
        </Button>
        <Button variant="ghost" size="sm" fullWidth onPress={() => setStep('health')}>
          بعداً پر می‌کنم
        </Button>
      </>
    );
  else if (step === 'health')
    sheet = (
      <>
        {heading('سلامت و آسیب‌دیدگی', 'اختیاری و خصوصی؛ فقط تو و مربی‌ات می‌بینید.')}
        <TextField label="آسیب‌دیدگی‌ها" placeholder="آسیب فعلی یا قبلی" optional value={f.inj} onChange={set('inj')} />
        <TextField label="بیماری‌ها یا داروها" placeholder="مثلاً آسم، فشار خون" optional value={f.cond} onChange={set('cond')} />
        <Switch label="اعلان‌ها" description="یادآوری تمرین، چک‌این صبح و اندازه‌گیری" checked={f.notif} onChange={set('notif')} />
        <Button size="lg" fullWidth loading={loading} onPress={finish}>
          شروع کن
        </Button>
      </>
    );
  else if (step === 'expired')
    sheet = (
      <>
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c['surface-sunken'], alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="clock" size={28} />
          </View>
          <Txt size={22} lh={34} w={700} align="center" accessibilityRole="header">
            این لینک منقضی شده
          </Txt>
          <Txt size={14} lh={24} color="text-secondary" align="center">
            {LIVE && token
              ? 'لینک دعوت فقط ۷ روز و یک بار معتبر است. از مربی‌ات بخواه یک لینک تازه برایت بفرستد.'
              : 'لینک دعوت فقط ۷ روز و یک بار معتبر است. یک لینک تازه به ' + ATHLETE.email + ' می‌فرستیم.'}
          </Txt>
        </View>
        {LIVE && token ? null : !resent ? (
          <Button size="lg" fullWidth icon="mail" loading={loading} onPress={resend}>
            ارسال لینک جدید
          </Button>
        ) : (
          <>
            <Banner tone="success" title="لینک جدید ارسال شد" description="صندوق ورودی و پوشه اسپم را بررسی کن. مربی هم مطلع شد." />
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => {
                setStep('mail');
                setResent(false);
              }}
            >
              باز کردن ایمیل جدید
            </Button>
          </>
        )}
        <Pressable accessibilityRole="link" onPress={() => nav.navigate('Login')} style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
          <Txt size={13} lh={20} color="brand-primary-text">
            قبلاً حساب را فعال کرده‌ام · ورود
          </Txt>
        </Pressable>
      </>
    );

  return (
    <LoginBackdrop>
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + (step === 'mail' ? 48 : 24),
            paddingBottom: insets.bottom + 24,
            justifyContent: step === 'mail' ? 'flex-start' : 'center',
          }}
        >
          {step === 'mail' ? (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <Txt size={12} lh={18} color="#BDBDBD" align="center">
                پیش‌نمایش ایمیل دعوت · صندوق ورودی شاگرد
              </Txt>
              <View style={{ backgroundColor: c.surface, borderRadius: 8, overflow: 'hidden' }}>
                <View style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.border, gap: 2 }}>
                  <Txt size={14} lh={22} w={600}>
                    {ATHLETE.coach + ' شما را به ' + BRAND.name + ' دعوت کرده است'}
                  </Txt>
                  <Txt size={12} lh={18} color="text-muted" mono ltr>
                    {'no-reply@alifitness.app → ' + ATHLETE.email}
                  </Txt>
                </View>
                <View style={{ paddingVertical: 20, paddingHorizontal: 16, gap: 14 }}>
                  <BrandMark name={BRAND.name} initials={BRAND.initials} />
                  <Txt size={14} lh={24} color="text-secondary">
                    {'سلام ' + ATHLETE.first + '، من برنامه «' + ATHLETE.program + '» را برایت آماده کرده‌ام. برای شروع حسابت را فعال کن و رمز بساز.'}
                  </Txt>
                  <Button size="lg" fullWidth onPress={() => setStep('accept')}>
                    فعال‌سازی حساب
                  </Button>
                  <Txt size={12} lh={18} color="text-muted">
                    این لینک یک‌بارمصرف است و تا ۷ روز معتبر است.
                  </Txt>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStep('expired');
                  setResent(false);
                }}
                style={{ alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}
              >
                <Txt size={13} lh={20} w={500} color="#D6D6D6" style={{ textDecorationLine: 'underline' }}>
                  نمایش حالت لینک منقضی
                </Txt>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ alignItems: 'center', paddingHorizontal: 16, paddingBottom: 24 }}>
                <BrandMark name={BRAND.name} initials={BRAND.initials} size="lg" inverse />
              </View>
              <View style={{ paddingHorizontal: 16 }}>
                <View
                  style={{ width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: c.surface, borderRadius: 24, paddingVertical: 24, paddingHorizontal: 20, gap: 16 }}
                >
                  {idx != null ? (
                    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={'مرحله ' + (idx + 1) + ' از ۳'}>
                      {[0, 1, 2].map((i) => (
                        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= idx ? c['brand-primary'] : c.border }} />
                      ))}
                    </View>
                  ) : null}
                  {sheet}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LoginBackdrop>
  );
}
