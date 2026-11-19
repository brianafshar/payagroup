// Design: project/M42 Athlete Measurements.dc.html
import { faDigits, faJoin, faNumber, parseFaNumber } from '@baseline/core';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useState } from 'react';
import { View } from 'react-native';
import { MEASURE_HISTORY, measures, METRICS, type MetricKey } from '../data/athlete';
import { addMeasurements } from '../data/live';
import { useNav, type RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { Badge, Button, Footer, Icon, MobileHeader, Screen, SegmentedControl, Surface, TextField, toast, Txt } from '../ui';

/** Body measurements — the athlete is the primary source (the coach can also record, shown as such). */
export function MeasureScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Measure'>>();
  const [tab, setTab] = useState<'new' | 'hist'>(params?.tab ?? 'new');
  const [draft, setDraft] = useState<Partial<Record<MetricKey, string>>>({});
  const { extra } = measures.use();
  const vals = (Object.keys(draft) as MetricKey[]).filter((k) => (parseFaNumber(draft[k]) ?? 0) > 0);
  const all = [...extra, ...MEASURE_HISTORY];
  const save = async () => {
    const v: Partial<Record<MetricKey, number>> = {};
    vals.forEach((k) => (v[k] = parseFaNumber(draft[k]) as number));
    if (!(await addMeasurements(v))) return;
    setDraft({});
    setTab('hist');
    toast('اندازه‌گیری ثبت شد', 'مربی‌ات آن را در بخش ترکیب بدن می‌بیند.');
  };
  return (
    <Screen
      gap={tab === 'new' ? 14 : 10}
      header={
        <>
          <MobileHeader title="اندازه‌گیری بدن" back="پیشرفت" onBack={() => nav.goBack()} />
          <View style={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: c.background }}>
            <SegmentedControl
              fullWidth
              label="بخش"
              value={tab}
              onChange={(v) => setTab(v as 'new' | 'hist')}
              options={[
                { value: 'new', label: 'ثبت جدید' },
                { value: 'hist', label: 'سابقه' },
              ]}
            />
          </View>
        </>
      }
      footer={
        tab === 'new' ? (
          <Footer>
            <Button size="lg" fullWidth disabled={!vals.length} onPress={save}>
              {vals.length ? 'ثبت ' + faDigits(vals.length) + ' شاخص' : 'ثبت اندازه‌گیری'}
            </Button>
          </Footer>
        ) : undefined
      }
    >
      {tab === 'new' ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 8,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Icon name="calendar" size={18} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt size={13} lh={20} w={600}>
                برنامه مربی: هر هفته، جمعه‌ها
              </Txt>
              <Txt size={12} lh={18} color="text-muted">
                {extra.length ? 'اندازه‌گیری این هفته ثبت شد · بعدی جمعه آینده' : 'موعد این هفته: جمعه · یادآوری ۸ صبح'}
              </Txt>
            </View>
          </View>
          <Txt size={12} lh={18} color="text-muted">
            صبح، ناشتا و قبل از تمرین اندازه بگیر. هر فیلدی را نداری خالی بگذار.
          </Txt>
          <Surface style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {METRICS.map(([k, label, unit, last]) => (
              <View key={k} style={{ width: '47%', flexGrow: 1 }}>
                <TextField
                  label={label}
                  value={draft[k] ?? ''}
                  suffix={unit}
                  placeholder={'قبلی ' + faNumber(last)}
                  type="decimal"
                  size="sm"
                  onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
                />
              </View>
            ))}
          </Surface>
        </>
      ) : (
        all.map((h, i) => (
          <Surface key={i} padding={12} gap={6} style={{ paddingHorizontal: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Txt size={14} lh={22} w={600} style={{ flex: 1 }}>
                {h.date}
              </Txt>
              <Badge tone={h.by === 'a' ? 'neutral' : 'info'} icon={h.by === 'a' ? 'user' : 'shield'}>
                {h.by === 'a' ? 'ثبت توسط تو' : 'ثبت توسط مربی'}
              </Badge>
            </View>
            <Txt size={13} lh={20} color="text-secondary">
              {faJoin([
                h.v.w != null && 'وزن ' + faNumber(h.v.w) + ' kg',
                h.v.f != null && 'چربی ' + faNumber(h.v.f) + '٪',
                h.v.wa != null && 'کمر ' + faNumber(h.v.wa) + ' cm',
                faDigits(h.n) + ' از ' + faDigits(METRICS.length) + ' شاخص',
              ])}
            </Txt>
          </Surface>
        ))
      )}
    </Screen>
  );
}
