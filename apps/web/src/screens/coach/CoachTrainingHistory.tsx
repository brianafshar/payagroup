// Ported from design handoff: project/C23 Coach Training History.dc.html
import { Fragment } from 'react';
import { Badge, Button, Card, EmptyState, Icon, PageHeader, Sidebar, Table, TextField, TopBar, ValueDisplay } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { href, param } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { downloadCsv } from '@/lib/csv';
import { fromJalali, JALALI_MONTHS, toJalali } from '@baseline/core';
import { api, faError, remote } from '@/data/api';
import { NoAthletePage, pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { faTime } from '@/lib/format';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** The current Jalali month: first/last Gregorian dates and its Saturday-first weekday offset. */
function jalaliMonth() {
  const { jy, jm } = toJalali(new Date());
  const first = fromJalali(jy, jm, 1, 12);
  const next = jm === 12 ? fromJalali(jy + 1, 1, 1, 12) : fromJalali(jy, jm + 1, 1, 12);
  const days = Math.round((next.getTime() - first.getTime()) / 86400000);
  const last = new Date(first);
  last.setDate(first.getDate() + days - 1);
  return { jy, jm, first, last, days, offset: (first.getDay() + 1) % 7 };
}

/** Data container: the athlete in `?id=` (or the first one), this Jalali month's calendar and logs. */
export default function CoachTrainingHistoryPage(props: { brand?: string }) {
  const athletes = useQuery('athletes', () => api.athletes.list());
  const id = param('id') || athletes.data?.[0]?.id || '';
  const m = jalaliMonth();
  const cal = useQuery('calendar:' + id, () => (id ? remote.athleteCalendar(id, isoOf(m.first), isoOf(m.last)) : Promise.resolve([])));
  // This month's sessions (calendar details) and the latest six (recent list); the full history only on export.
  const monthLogs = useQuery('workouts:' + id + ':month', () => (id ? remote.workouts(id, { from: isoOf(m.first), to: isoOf(m.last) }) : Promise.resolve([])));
  const recent = useQuery('workouts:' + id + ':recent', () => (id ? remote.recentWorkouts(id, 6) : Promise.resolve({ count: 0, results: [] })));
  const exercises = useQuery('exercises', api.exercises.list);
  const wait = pending(athletes, cal, monthLogs, recent, exercises);
  if (wait) return wait;
  if (!id) return <NoAthletePage active="athletes" title="سابقه تمرین" />;
  return (
    <CoachTrainingHistory
      key={id}
      {...props}
      athlete={athletes.data?.find((a) => a.id === id)}
      month={m}
      calendar={cal.data}
      logs={monthLogs.data}
      recent={recent.data?.results}
      total={recent.data?.count ?? 0}
      exercises={exercises.data}
    />
  );
}

class CoachTrainingHistory extends Screen {
  state: ScreenState = { day: toJalali(new Date()).jd, draft: '' };

  /** Live: one day of the month → the design's session panel. */
  liveSession(d: number) {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (x) => '۰۱۲۳۴۵۶۷۸۹'[x])
        .replace('.', '٫');
    const { month, calendar, logs, exercises, athlete } = this.props;
    const row = calendar[d - 1] || { status: 'rest' };
    const log = logs.find((l) => l.id === row.workoutId) || this.props.recent.find((l) => l.id === row.workoutId);
    const wdn = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const dateLbl = wdn[(d + month.offset - 1) % 7] + ' ' + fa(d) + ' ' + JALALI_MONTHS[month.jm - 1];
    const st = row.status;
    // #89: everything the day asked for and whether it was logged; a day with nothing prescribed is rest.
    const MARK = {
      done: ['check-circle', 'success', 'ثبت شد'],
      missing: ['x-circle', 'error', 'ثبت نشد'],
      planned: ['clock', 'muted', 'پیش رو'],
      none: ['minus', 'muted', 'در برنامه نیست'],
    };
    const TRAIN = {
      rest: ['moon', 'success', 'استراحت · انجام شد'],
      completed: ['check-circle', 'success', 'انجام شد'],
      partial: ['circle-half', 'warning', 'ناقص'],
      missed: ['x-circle', 'error', 'از دست رفته'],
      planned: ['clock', 'muted', 'پیش رو'],
      'in-progress': ['activity', 'brand-primary-text', 'در حال انجام'],
    };
    const checks = [
      ['تمرین', TRAIN[st] || TRAIN.planned],
      ['تغذیه', MARK[row.nutrition] || MARK.none],
      ['ریکاوری', MARK[row.recovery] || MARK.none],
      ['اندازه‌گیری', MARK[row.measure] || MARK.none],
    ].map(([label, [icon, tone, text]]) => ({ label, icon, color: tone === 'muted' ? 'var(--text-muted)' : 'var(--' + tone + ')', text }));
    const missing = row.missing?.length ? 'انجام نشد: ' + row.missing.join('، ') : '';
    const base = {
      title: st === 'rest' ? 'روز استراحت' : row.focus || 'جلسه تمرین',
      status: st,
      feedback: log?.coachFeedback || [],
      workoutId: log?.id,
      checks,
      missing,
    };
    const weekLbl = row.week ? ' · هفته ' + fa(row.week) : '';
    if (!log) {
      const empty = {
        rest: ['moon', 'استراحت (انجام شد)', 'تمرینی برای این روز در برنامه نیست؛ استراحت هم بخشی از برنامه است.'],
        planned: ['calendar', 'هنوز انجام نشده', 'این جلسه در آینده است. می‌توانید از برنامه‌ساز آن را تغییر دهید.'],
        missed: ['x-circle', 'جلسه انجام نشد', (athlete?.name.split(' ')[0] || 'ورزشکار') + ' این جلسه را ثبت نکرده است.'],
      }[st] || ['calendar', 'ثبت نشده', ''];
      return { ...base, sub: dateLbl + weekLbl, hasData: false, empty: true, emptyIcon: empty[0], emptyTitle: empty[1], emptyDesc: empty[2], hasNote: false, noFeedback: true };
    }
    const name = (eid) => exercises.find((e) => e.id === String(eid))?.name || 'حرکت';
    const done = log.sets.filter((x) => x.done);
    const rows = done.map((x, i) => ({
      id: String(i),
      e: name(x.exerciseId),
      s: fa(x.index + 1),
      w: (x.actualValue ?? x.targetValue) != null ? fa(x.actualValue ?? x.targetValue) + ' ' + x.unit : '—',
      r: fa(x.actualReps || x.targetReps || '—'),
      p: '',
      highlight: x.isPr,
    }));
    const pr = done.find((x) => x.isPr);
    const live = st === 'in-progress';
    return {
      ...base,
      sub: dateLbl + weekLbl + (log.startedAt ? ' · شروع ' + faTime(new Date(log.startedAt)) : ''),
      hasData: true,
      empty: false,
      dur: log.durationMin ? fa(log.durationMin) : '—',
      durUnit: 'دقیقه',
      sets: fa(done.length),
      setsOf: '/ ' + fa(log.sets.length),
      hr: log.avgHr ? fa(log.avgHr) : '—',
      noHr: !log.avgHr,
      rpe: log.rpe ? fa(log.rpe) : '—',
      noRpe: !log.rpe || live,
      rows,
      hasPr: !!pr,
      pr: pr
        ? 'ست ' + fa(pr.index + 1) + ' ' + name(pr.exerciseId) + ' رکورد جدید است (' + fa(pr.actualValue ?? pr.targetValue) + ' kg × ' + fa(pr.actualReps || pr.targetReps) + ').'
        : '',
      hasNote: !!log.athleteNote,
      note: log.athleteNote,
    };
  }

  renderVals() {
    const fa = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    const COL = {
      completed: 'var(--success, #2e7d32)',
      partial: 'var(--warning, #ed8a00)',
      missed: 'var(--error, #c62828)',
      'in-progress': 'var(--brand-primary)',
      planned: 'var(--border)',
      rest: 'color-mix(in srgb, var(--success, #2e7d32) 40%, transparent)',
    };
    return this.liveVals(fa, COL);
  }

  /** Values for the whole screen (calendar, recent sessions, feedback). */
  liveVals(fa, COL) {
    const { day, draft } = this.state;
    const { month, calendar, logs, athlete } = this.props;
    const s = this.liveSession(day);
    const today = toJalali(new Date()).jd;
    const cells = [...Array(month.offset).fill(null), ...Array.from({ length: month.days }, (_, i) => i + 1)];
    const done = calendar.filter((r) => r.status === 'completed').length;
    const planned = calendar.filter((r, i) => i + 1 <= today && r.status !== 'rest').length;
    const recent = this.props.recent;
    const total = this.props.total;
    const dayOf = (iso) => calendar.findIndex((r) => r.date === iso) + 1;
    const first = athlete?.name.split(' ')[0] || 'ورزشکار';
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'ورزشکاران', to: 'coach:athletes' }, { label: athlete?.name || '—', to: 'coach:athlete?id=' + athlete?.id }, 'سابقه تمرین'],
      headerBack: athlete?.name || 'ورزشکاران',
      headerBackTo: athlete ? 'coach:athlete?id=' + athlete.id : 'coach:athletes',
      headerSub:
        (athlete?.name || '') +
        ' · ' +
        fa(total) +
        ' جلسه ثبت‌شده' +
        (athlete?.stats?.adherencePct != null ? ' · ' + fa(athlete.stats.adherencePct) + '٪ انجام در ۳۰ روز اخیر' : ''),
      exportCsv: () => {
        void remote.workouts(athlete.id).then((all) => {
          downloadCsv(
            'history-' + athlete.id + '.csv',
            ['date', 'status', 'focus', 'duration_min', 'rpe'],
            all.map((l) => [l.date, l.status, l.focus, l.durationMin ?? '', l.rpe ?? '']),
          );
          toast('خروجی آماده شد', fa(all.length) + ' جلسه');
        });
      },
      monthStat: fa(done) + ' از ' + fa(planned) + ' جلسه انجام شد · ' + JALALI_MONTHS[month.jm - 1],
      weekdays: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
      cal: cells.map((d) => {
        if (!d) return { blank: true, vis: 'hidden', n: '', dot: 'transparent', border: '0', bg: 'none', fg: 'inherit', cursor: 'default', pick: null, title: '' };
        const st = calendar[d - 1]?.status || 'rest';
        const on = d === day;
        return {
          blank: false,
          vis: 'visible',
          n: fa(d),
          dot: COL[st],
          title: fa(d) + ' ' + JALALI_MONTHS[month.jm - 1] + (calendar[d - 1]?.missing?.length ? ' · انجام نشد: ' + calendar[d - 1].missing.join('، ') : ''),
          border: on ? '2px solid var(--brand-primary)' : d === today ? '1px solid var(--brand-primary)' : '1px solid transparent',
          bg: on ? 'var(--brand-primary-subtle)' : 'var(--surface-sunken)',
          fg: st === 'planned' ? 'var(--text-muted)' : 'var(--text-primary)',
          cursor: 'pointer',
          pick: () => this.setState({ day: d, draft: '' }),
        };
      }),
      legend: [
        { t: 'انجام شد', c: COL.completed },
        { t: 'ناقص', c: COL.partial },
        { t: 'از دست رفته', c: COL.missed },
        { t: 'استراحت', c: COL.rest },
        { t: 'در حال انجام', c: COL['in-progress'] },
        { t: 'برنامه‌ریزی‌شده', c: COL.planned },
      ],
      recent: recent.map((l) => {
        const d = dayOf(l.date);
        return {
          title: l.focus || 'جلسه تمرین',
          sub: new Date(l.date + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }),
          status: l.status,
          dot: COL[l.status] || COL.planned,
          bg: d && d === day ? 'var(--brand-primary-subtle)' : 'transparent',
          pick: () => (d ? this.setState({ day: d, draft: '' }) : toast('خارج از این ماه', 'این جلسه در ماه دیگری است.', 'info')),
        };
      }),
      s,
      cols: [
        { key: 'e', label: 'حرکت' },
        { key: 's', label: 'ست' },
        { key: 'w', label: 'وزنه' },
        { key: 'r', label: 'تکرار' },
        { key: 'p', label: 'RPE' },
      ],
      recordsHref: href('coach:records') + (athlete ? '?id=' + athlete.id : ''),
      draft,
      setDraft: (v) => this.setState({ draft: v }),
      noDraft: !draft.trim() || !s.workoutId,
      send: async () => {
        if (!draft.trim() || !s.workoutId) return;
        try {
          await remote.feedback(s.workoutId, draft.trim());
        } catch (e) {
          return toast('ارسال نشد', faError(e), 'error');
        }
        // The field is uncontrolled: a new key clears it (#62).
        this.setState((st) => ({ draft: '', fbKey: (st.fbKey || 0) + 1 }));
        toast('بازخورد ارسال شد', first + ' در اعلان‌های اپ و روی همین جلسه آن را می‌بیند.');
      },
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="athletes" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader back={v.headerBack} backTo={v.headerBackTo} title="سابقه تمرین" subtitle={v.headerSub}>
            <Button variant="secondary" icon="download" onClick={v.exportCsv}>
              خروجی CSV
            </Button>
          </PageHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minWidth: '0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: '600' }}>مهر ۱۴۰۵</span>
                  <div style={{ flex: '1' }}></div>
                  <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.monthStat}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: '4px', textAlign: 'center' }}>
                  {(v.weekdays || []).map((wd: any, $index: number) => (
                    <Fragment key={$index}>
                      <span style={{ fontSize: '11px', lineHeight: '16px', color: 'var(--text-muted)', paddingBottom: '4px' }}>{wd}</span>
                    </Fragment>
                  ))}
                  {(v.cal || []).map((c: any, $index: number) => (
                    <Fragment key={$index}>
                      <button
                        type="button"
                        onClick={c?.pick}
                        disabled={c?.blank}
                        title={c?.title}
                        style={{
                          aspectRatio: '1',
                          border: c?.border,
                          borderRadius: '8px',
                          background: c?.bg,
                          color: c?.fg,
                          cursor: c?.cursor,
                          font: "500 13px/1 'Vazirmatn',sans-serif",
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          padding: '0',
                          visibility: c?.vis,
                        }}
                      >
                        <span>{c?.n}</span>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c?.dot }}></span>
                      </button>
                    </Fragment>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {(v.legend || []).map((l: any, $index: number) => (
                    <Fragment key={$index}>
                      <span style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '11px', lineHeight: '16px', color: 'var(--text-secondary)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l?.c }}></span>
                        {l?.t}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </div>
              <Card title="جلسات اخیر" padding="none">
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                  {(v.recent || []).map((r: any, $index: number) => (
                    <Fragment key={$index}>
                      <button
                        className="hv-sunken"
                        type="button"
                        onClick={r?.pick}
                        style={{
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          padding: '12px 16px',
                          border: '0',
                          borderTop: '1px solid var(--border-subtle)',
                          background: r?.bg,
                          cursor: 'pointer',
                          textAlign: 'right',
                          fontFamily: "'Vazirmatn',sans-serif",
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: '0', background: r?.dot }}></span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                          <span style={{ fontSize: '14px', lineHeight: '22px', fontWeight: '500' }}>{r?.title}</span>
                          <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{r?.sub}</span>
                        </span>
                        <Badge status={r?.status} size="sm" />
                      </button>
                    </Fragment>
                  ))}
                </div>
              </Card>
            </div>
            <div style={{ gridColumn: 'span 2', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minWidth: '0',
                }}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '0' }}>
                    <h2 style={{ margin: '0', fontSize: '20px', lineHeight: '28px', fontWeight: '600' }}>{v.s?.title}</h2>
                    <p style={{ margin: '0', fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)' }}>{v.s?.sub}</p>
                  </div>
                  <div style={{ flex: '1' }}></div>
                  <Badge status={v.s?.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '8px' }}>
                  {(v.s?.checks || []).map((c: any) => (
                    <div
                      key={c.label}
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-sunken)',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ color: c.color, display: 'flex' }}>
                        <Icon name={c.icon} size={18} />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{c.label}</span>
                        <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: 600 }}>{c.text}</span>
                      </span>
                    </div>
                  ))}
                </div>
                {v.s?.missing ? <p style={{ margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--error)' }}>{v.s.missing}</p> : null}
                {v.s?.hasData ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                      <ValueDisplay label="مدت" icon="clock" value={v.s?.dur} unit={v.s?.durUnit} />
                      <ValueDisplay label="ست‌ها" icon="check-circle" value={v.s?.sets} unit={v.s?.setsOf} />
                      <ValueDisplay label="میانگین ضربان" icon="heart" value={v.s?.hr} unit="bpm" notRecorded={v.s?.noHr} />
                      <ValueDisplay label="RPE جلسه" icon="gauge" value={v.s?.rpe} notRecorded={v.s?.noRpe} />
                    </div>
                    <Table caption="ست‌های ثبت‌شده" columns={v.cols} rows={v.s?.rows} dense />
                    {v.s?.hasPr ? (
                      <>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Badge tone="record" icon="trophy" size="sm">
                            رکورد
                          </Badge>
                          <p style={{ margin: '0', fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)' }}>{v.s?.pr}</p>
                          <a href={v.recordsHref} style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '500' }}>
                            همه رکوردها
                          </a>
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
                {v.s?.empty ? (
                  <>
                    <EmptyState icon={v.s?.emptyIcon} title={v.s?.emptyTitle} description={v.s?.emptyDesc} />
                  </>
                ) : null}
                <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
                {v.s?.hasNote ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0' }}>
                      <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '600' }}>یادداشت ورزشکار</span>
                      <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)' }}>{v.s?.note}</p>
                    </div>
                  </>
                ) : null}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                  <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '600' }}>بازخورد مربی</span>
                  {(v.s?.feedback || []).map((f: any, $index: number) => (
                    <Fragment key={$index}>
                      <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--brand-primary-subtle)', fontSize: '14px', lineHeight: '22px' }}>
                        {f}
                      </div>
                    </Fragment>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ flex: '1', minWidth: '0' }}>
                      <TextField key={'fb' + (this.state.fbKey || 0)} placeholder="مثلاً عالی بود، هفته بعد ست آخر را ۷۰ کیلو بزن" value={v.draft} onChange={v.setDraft} />
                    </div>
                    <Button variant="primary" icon="send" disabled={v.noDraft} onClick={v.send}>
                      ارسال
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
