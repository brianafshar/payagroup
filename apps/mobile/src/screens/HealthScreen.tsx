// Design: project/M46 Athlete Health Profile.dc.html
import { useState } from 'react';
import { View } from 'react-native';
import { ATHLETE, health, HEALTH_FIELDS, type HealthKey } from '../data/athlete';
import { saveHealth } from '../data/live';
import { useNav } from '../navigation/types';
import { Banner, Button, DescriptionList, Footer, MobileHeader, Screen, SensitiveSection, Surface, TextField, toast } from '../ui';

/** Private health profile — visible only to the athlete and their coach (never to admins). */
export function HealthScreen() {
  const nav = useNav();
  const { v, updated } = health.use();
  const [draft, setDraft] = useState<Record<HealthKey, string> | null>(null);
  const save = async () => {
    if (!draft || !(await saveHealth(draft))) return;
    setDraft(null);
    toast('ذخیره شد', 'مربی‌ات از تغییر مطلع می‌شود.');
  };
  return (
    <Screen
      gap={14}
      header={<MobileHeader title="پروفایل سلامت" back="پروفایل" onBack={() => nav.goBack()} />}
      footer={
        <Footer row gap={8}>
          {!draft ? (
            <Button variant="secondary" size="lg" fullWidth icon="edit" onPress={() => setDraft({ ...v })} style={{ flex: 1 }}>
              ویرایش اطلاعات سلامت
            </Button>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" size="lg" fullWidth onPress={() => setDraft(null)}>
                  انصراف
                </Button>
              </View>
              <View style={{ flex: 2 }}>
                <Button size="lg" fullWidth onPress={save}>
                  ذخیره
                </Button>
              </View>
            </>
          )}
        </Footer>
      }
    >
      {!draft ? (
        <>
          <SensitiveSection
            title="اطلاعات سلامت تو"
            accessNote={'فقط تو و مربی‌ات ' + ATHLETE.coach + ' این را می‌بینید. هر بار مشاهده ثبت می‌شود.'}
            footer={'آخرین به‌روزرسانی توسط تو · ' + updated}
          >
            <DescriptionList items={HEALTH_FIELDS.map(([k, label]) => ({ label, value: v[k] }))} />
          </SensitiveSection>
          <Banner tone="info" title="چرا مربی می‌پرسد" description="تا حرکات و وزنه‌ها را برایت ایمن تنظیم کند. فقط چیزی را بنویس که راحتی به اشتراک بگذاری." />
        </>
      ) : (
        <Surface>
          {HEALTH_FIELDS.map(([k, label, ph]) => (
            <TextField key={k} label={label} value={draft[k]} placeholder={ph} optional onChange={(x) => setDraft((d) => (d ? { ...d, [k]: x } : d))} />
          ))}
        </Surface>
      )}
    </Screen>
  );
}
