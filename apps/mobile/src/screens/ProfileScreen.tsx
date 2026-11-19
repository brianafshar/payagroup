// Design: project/M45 Athlete Profile.dc.html
import { faDigits, fromJalali, toEnDigits, toJalali } from '@baseline/core';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { signOut } from '../api/auth';
import { LIVE, SITE_URL } from '../api/config';
import { ATHLETE, profile } from '../data/athlete';
import { saveProfile } from '../data/live';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { Avatar, Button, ListGroup, ListRow, MobileHeader, Modal, SegmentedControl, Screen, Switch, Tag, TextField, toast, Txt } from '../ui';

const MAX_PHOTO = 20 * 1024 * 1024; // the server downscales photos
const GOALS = [
  { value: 'gain', label: 'عضله‌سازی' },
  { value: 'loss', label: 'کاهش چربی' },
  { value: 'str', label: 'قدرت' },
  { value: 'gen', label: 'آمادگی عمومی' },
];
const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** ISO date → «۱۳۷۷/۰۵/۱۲». */
function toFaDate(iso: string | null): string {
  if (!iso) return '';
  const j = toJalali(new Date(iso + 'T12:00:00'));
  return faDigits(j.jy + '/' + String(j.jm).padStart(2, '0') + '/' + String(j.jd).padStart(2, '0'));
}

/** «۱۳۷۷/۵/۱۲» (Persian or Latin digits, / or -) → ISO, or null when it isn't a plausible birth date. */
function parseFaDate(v: string): string | null {
  const m = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(toEnDigits(v).trim());
  if (!m) return null;
  const [jy, jm, jd] = [+m[1], +m[2], +m[3]];
  if (jy < 1300 || jy > 1420 || jm < 1 || jm > 12 || jd < 1 || jd > (jm <= 6 ? 31 : 30)) return null;
  const d = fromJalali(jy, jm, jd, 12);
  const age = (Date.now() - d.getTime()) / (365.25 * 86400000);
  return age >= 5 && age <= 100 ? isoOf(d) : null;
}

/** Help and privacy pages on the coach's website (#79). */
function openSite(path: string) {
  if (!LIVE || !SITE_URL) return toast(path === '/help' ? 'راهنما' : 'حریم خصوصی', 'داده‌هایت فقط نزد تو و مربی‌ات می‌ماند.');
  void Linking.openURL(SITE_URL + path).catch(() => toast('باز نشد', SITE_URL + path, 'error'));
}

export function ProfileScreen() {
  const nav = useNav();
  const { c, preference, setPreference } = useTheme();
  const p = profile.use();
  const [edit, setEdit] = useState(false);
  const [dPhoto, setDPhoto] = useState<string | null>(null);
  const [dPhone, setDPhone] = useState('');
  const [dBirth, setDBirth] = useState('');
  const [dGoal, setDGoal] = useState('');
  const asset = useRef<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const digits = toEnDigits(dPhone).replace(/\D/g, '');
  const badPhone = edit && digits.length > 0 && !/^09\d{9}$/.test(digits);
  const birthIso = dBirth.trim() ? parseFaDate(dBirth) : null;
  const badBirth = edit && !!dBirth.trim() && !birthIso;
  const newAge = birthIso ? Math.floor((Date.now() - Date.parse(birthIso)) / (365.25 * 86400000)) : null;

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.fileSize && a.fileSize > MAX_PHOTO) return toast('حجم عکس زیاد است', 'حداکثر ۲۰ مگابایت', 'error');
    asset.current = a;
    setDPhoto(a.uri);
  };
  const save = async () => {
    if (badPhone || badBirth) return;
    setSaving(true);
    const info = {
      ...(birthIso !== ATHLETE.birthDate && (birthIso || !dBirth.trim()) ? { birthDate: birthIso } : {}),
      ...(dGoal && dGoal !== ATHLETE.goalKey ? { goal: dGoal } : {}),
    };
    const ok = await saveProfile(dPhoto ? { uri: dPhoto, mimeType: asset.current?.mimeType, fileName: asset.current?.fileName ?? undefined } : null, dPhone, info);
    setSaving(false);
    if (!ok) return;
    asset.current = null;
    setEdit(false);
    toast('ذخیره شد', 'اطلاعات شخصی به‌روز شد.');
  };

  return (
    <>
      <Screen gap={14} header={<MobileHeader large title="پروفایل" />}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={ATHLETE.name} uri={p.photo} size="xl" />
          <View style={{ gap: 2, minWidth: 0 }}>
            <Txt size={18} lh={28} w={700}>
              {ATHLETE.name}
            </Txt>
            <Txt size={13} lh={20} color="text-secondary">
              {faDigits(ATHLETE.age) + ' سال · ' + faDigits(ATHLETE.heightCm) + ' cm · ' + ATHLETE.goal}
            </Txt>
            <Txt size={12} lh={18} color="text-muted">
              {'مربی: ' + ATHLETE.coach}
            </Txt>
          </View>
        </View>
        <ListGroup>
          <ListRow
            icon="user"
            title="اطلاعات شخصی"
            subtitle="عکس، تاریخ تولد، هدف، شماره تلفن"
            onPress={() => {
              setDPhoto(p.photo);
              setDPhone(p.phone);
              setDBirth(toFaDate(ATHLETE.birthDate));
              setDGoal(ATHLETE.goalKey || '');
              setEdit(true);
            }}
          />
          <ListRow icon="shield" title="پروفایل سلامت" subtitle="خصوصی · فقط مربی می‌بیند" onPress={() => nav.navigate('Health')} />
          <ListRow icon="ruler" title="اندازه‌گیری بدن" subtitle="هر هفته، جمعه‌ها" onPress={() => nav.navigate('Measure')} />
          <ListRow
            icon="clipboard"
            title="برنامه من"
            subtitle={ATHLETE.programWeek ? ATHLETE.program + ' · هفته ' + faDigits(ATHLETE.programWeek) : ATHLETE.program}
            onPress={() => nav.navigate('Plan')}
          />
          <ListRow icon="chat" title="گفتگو با مربی" onPress={() => nav.navigate('Chat')} />
        </ListGroup>
        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surface }}>
          <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
            <Switch label="اعلان‌ها" description="یادآوری تمرین، چک‌این صبح و اندازه‌گیری" checked={p.notif} onChange={(v) => profile.set({ notif: v })} />
          </View>
          <View style={{ height: 1, backgroundColor: c['border-subtle'] }} />
          <View style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 8 }}>
            <Txt size={14} lh={20}>
              حالت نمایش
            </Txt>
            <SegmentedControl
              fullWidth
              label="حالت نمایش"
              value={preference}
              onChange={(v) => setPreference(v as 'light' | 'dark' | 'system')}
              options={[
                { value: 'light', label: 'روشن', icon: 'sun' },
                { value: 'dark', label: 'تیره', icon: 'moon' },
                { value: 'system', label: 'خودکار', icon: 'circle-half' },
              ]}
            />
          </View>
          <View style={{ height: 1, backgroundColor: c['border-subtle'] }} />
          <ListRow icon="scale" title="واحدها" value={p.metric ? 'kg · cm' : 'lb · in'} onPress={() => profile.set({ metric: !p.metric })} />
          <View style={{ height: 1, backgroundColor: c['border-subtle'] }} />
          <ListRow icon="help" title="راهنما" subtitle="شروع کار، نصب اپ، فراموشی رمز" onPress={() => openSite('/help')} />
          <ListRow icon="shield" title="حریم خصوصی" subtitle="چه اطلاعاتی نگه داشته می‌شود" onPress={() => openSite('/privacy')} />
          <View style={{ height: 1, backgroundColor: c['border-subtle'] }} />
          <ListRow icon="key" title="تغییر رمز عبور" onPress={() => nav.navigate('Password')} />
          {LIVE ? <ListRow icon="lock" title="دستگاه‌های واردشده" subtitle="خروج از گوشی یا مرورگر دیگر" onPress={() => nav.navigate('Devices')} /> : null}
          <View style={{ height: 1, backgroundColor: c['border-subtle'] }} />
          <ListRow icon="log-out" title="خروج از حساب" danger chevron={false} onPress={() => void signOut()} />
        </View>
      </Screen>
      <Modal
        open={edit}
        title="اطلاعات شخصی"
        primaryLabel="ذخیره"
        secondaryLabel="انصراف"
        primaryDisabled={badPhone || badBirth || saving}
        onPrimary={() => void save()}
        onClose={() => setEdit(false)}
      >
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={ATHLETE.name} uri={dPhoto} size="xl" />
          <View style={{ gap: 6, minWidth: 0, flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button variant="secondary" size="sm" icon="upload" onPress={pickPhoto}>
                {dPhoto ? 'تغییر عکس' : 'آپلود عکس'}
              </Button>
              {dPhoto ? (
                <Button variant="ghost" size="sm" onPress={() => setDPhoto(null)}>
                  حذف
                </Button>
              ) : null}
            </View>
            <Txt size={12} lh={18} color="text-muted">
              JPG یا PNG · حداکثر ۲۰ مگابایت
            </Txt>
          </View>
        </View>
        <TextField label="نام و نام خانوادگی" value={ATHLETE.name} placeholder="نام کامل" readOnly />
        <TextField
          label="تاریخ تولد"
          value={dBirth}
          placeholder="۱۳۷۰/۰۱/۰۱"
          onChange={setDBirth}
          ltr
          hint={badBirth ? undefined : newAge != null ? 'سن: ' + faDigits(newAge) + ' سال' : 'به تاریخ شمسی، مثلاً ۱۳۷۷/۰۵/۱۲'}
          error={badBirth ? 'تاریخ را به شکل سال/ماه/روز شمسی بنویس، مثلاً ۱۳۷۷/۰۵/۱۲' : undefined}
        />
        <View style={{ gap: 6 }}>
          <Txt size={13} lh={20} w={500}>
            هدف
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {GOALS.map((g) => (
              <Tag key={g.value} selected={dGoal === g.value} onPress={() => setDGoal(g.value)}>
                {g.label}
              </Tag>
            ))}
          </View>
        </View>
        <TextField label="مربی" value={ATHLETE.coach || 'ثبت نشده'} readOnly />
        <TextField
          label="شماره تلفن"
          ltr
          type="tel"
          value={dPhone}
          placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
          onChange={setDPhone}
          hint={badPhone ? undefined : 'برای یادآوری‌ها و بازیابی حساب'}
          error={badPhone ? 'شماره باید ۱۱ رقم و با ۰۹ شروع شود' : undefined}
        />
      </Modal>
    </>
  );
}
