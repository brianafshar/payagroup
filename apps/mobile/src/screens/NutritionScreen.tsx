// Design: project/M40 Athlete Nutrition.dc.html
import { faDigits, faNumber, faJoin } from '@baseline/core';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { LIVE } from '../api/config';
import { MEALS, nutrition, nutritionTotals, TARGETS } from '../data/athlete';
import { setMealStatus, setWater } from '../data/live';
import { todayLabel } from '../lib';
import { useNav } from '../navigation/types';
import { useTheme } from '../theme';
import { EmptyState, Icon, MacroSummary, MealCard, MobileHeader, NumberStepper, Screen, Surface, Tag, Txt } from '../ui';

const DAY_FA: Record<string, string> = { sat: 'شنبه', sun: 'یکشنبه', mon: 'دوشنبه', tue: 'سه‌شنبه', wed: 'چهارشنبه', thu: 'پنجشنبه', fri: 'جمعه' };
const CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const todayCode = () => CODES[new Date().getDay()];
/** The seven weekdays starting today: امروز، فردا، then the names. */
const upcoming = () => Array.from({ length: 7 }, (_, i) => CODES[(new Date().getDay() + i) % 7]);
export const tomorrowCode = () => CODES[(new Date().getDay() + 1) % 7];

export function NutritionScreen() {
  const nav = useNav();
  const { st, water, week, updated, supps } = nutrition.use();
  const { c } = useTheme();
  // Today's meals are logged above; the menu ahead starts on tomorrow.
  const [day, setDay] = useState(tomorrowCode());
  const [openMeal, setOpenMeal] = useState<string | null>(null);
  const menu = week?.find((w) => w.day === day);
  const hasMenu = !!week?.some((w) => w.meals.length);
  // When every day has the same menu, say so instead of making it look different.
  const same = !!week && new Set(week.map((w) => w.meals.map((m) => m.meal).join('|'))).size === 1;
  const sum = nutritionTotals(st);
  const logged = st.filter((x) => x !== 'unlogged').length;
  return (
    <Screen gap={14} header={<MobileHeader large eyebrow={todayLabel()} title="تغذیه" actions={[{ icon: 'chat', label: 'گفتگو با مربی', onPress: () => nav.navigate('Chat') }]} />}>
      {LIVE && !MEALS.length ? (
        <EmptyState icon="utensils" title="هنوز برنامه غذایی نداری" description="وقتی مربی برنامه غذایی‌ات را بنویسد، وعده‌ها اینجا نمایش داده می‌شوند." />
      ) : null}
      <Surface gap={6}>
        <Txt size={12} lh={18} color="text-muted">
          {faDigits(logged) + ' از ' + faDigits(MEALS.length) + ' وعده ثبت شده'}
        </Txt>
        <MacroSummary
          items={[
            { label: 'کالری', value: sum[0], target: TARGETS.kcal, unit: 'kcal' },
            { label: 'پروتئین', value: sum[1], target: TARGETS.protein, unit: 'g' },
            { label: 'کربوهیدرات', value: sum[2], target: TARGETS.carbs, unit: 'g' },
            { label: 'چربی', value: sum[3], target: TARGETS.fat, unit: 'g' },
          ]}
        />
      </Surface>
      <Surface padding={14} gap={10}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="droplet" size={16} />
          <Txt size={14} lh={22} w={600} style={{ flex: 1 }}>
            آب
          </Txt>
          <Txt size={12} lh={18} color="text-muted">
            {'هدف ' + faNumber(TARGETS.waterL) + ' لیتر'}
          </Txt>
        </View>
        <NumberStepper value={water} step={0.25} min={0} unit="L" size="md" onChange={setWater} />
      </Surface>
      {MEALS.map((m, i) => (
        <MealCard
          key={m.meal}
          meal={m.meal}
          time={m.time}
          items={m.items}
          macros={faJoin([faDigits(m.k[0]) + ' کالری', 'پروتئین ' + faDigits(m.k[1]) + ' گرم'])}
          status={st[i]}
          onChange={(v) => void setMealStatus(i, v)}
        />
      ))}
      {supps?.length ? (
        <Surface padding={14} gap={8}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="zap" size={16} />
            <Txt size={14} lh={22} w={600}>
              مکمل‌ها
            </Txt>
          </View>
          {supps.map((x, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline', borderTopWidth: i ? 1 : 0, borderTopColor: c['border-subtle'], paddingTop: i ? 8 : 0 }}>
              <Txt size={14} lh={22} w={600}>
                {x.name}
              </Txt>
              <Txt size={13} lh={20} color="text-secondary" style={{ flex: 1 }}>
                {faJoin([x.dose, x.timing])}
              </Txt>
            </View>
          ))}
        </Surface>
      ) : null}
      {hasMenu && menu ? (
        <Surface padding={14} gap={10}>
          <Txt size={14} lh={22} w={600}>
            منوی روزهای بعد
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {upcoming().map((d, i) => (
              <Tag
                key={d}
                selected={d === day}
                onPress={() => {
                  setDay(d);
                  setOpenMeal(null);
                }}
              >
                {i === 0 ? 'امروز' : i === 1 ? 'فردا' : DAY_FA[d]}
              </Tag>
            ))}
          </ScrollView>
          <Txt size={12} lh={18} color="text-muted">
            {faJoin([
              DAY_FA[day] + (day === todayCode() ? ' (امروز)' : day === tomorrowCode() ? ' (فردا)' : ''),
              faDigits(menu.meals.length) + ' وعده',
              faNumber(menu.meals.reduce((a, m) => a + m.kcal, 0)) + ' کالری',
              same ? 'منوی همه روزها یکی است' : '',
            ])}
          </Txt>
          {menu.meals.length ? (
            menu.meals.map((m) => {
              const key = day + m.meal + m.time;
              const open = openMeal === key;
              return (
                <View key={key} style={{ borderTopWidth: 1, borderTopColor: c['border-subtle'], paddingTop: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    disabled={!m.foods?.length}
                    onPress={() => setOpenMeal(open ? null : key)}
                    style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt size={14} lh={22} w={500}>
                        {m.meal}
                      </Txt>
                      <Txt size={12} lh={18} color="text-muted">
                        {faJoin([m.time, faNumber(m.kcal) + ' کالری', m.protein ? 'پروتئین ' + faDigits(m.protein) + ' گرم' : ''])}
                      </Txt>
                    </View>
                    {m.foods?.length ? <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="text-muted" /> : null}
                  </Pressable>
                  {open
                    ? m.foods?.map((f, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 8, paddingTop: 6, paddingStart: 10 }}>
                          <Txt size={13} lh={20} color="text-secondary" style={{ flex: 1 }}>
                            {f.label || f.name}
                          </Txt>
                          <Txt size={12} lh={20} color="text-muted">
                            {faJoin([!f.label && f.grams ? faDigits(f.grams) + ' گرم' : '', f.kcal ? faDigits(f.kcal) + ' کالری' : ''])}
                          </Txt>
                        </View>
                      ))
                    : null}
                </View>
              );
            })
          ) : (
            <Txt size={12} lh={18} color="text-muted">
              برای این روز وعده‌ای تعریف نشده.
            </Txt>
          )}
        </Surface>
      ) : null}
      <Txt size={12} lh={18} color="text-muted" align="center">
        {'برنامه غذایی توسط مربی تنظیم شده' + (updated ? ' · آخرین تغییر ' + new Date(updated).toLocaleDateString('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' }) : '')}
      </Txt>
    </Screen>
  );
}
