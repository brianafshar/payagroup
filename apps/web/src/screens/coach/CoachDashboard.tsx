// Ported from design handoff: project/C10 Coach Dashboard.dc.html
import { Fragment } from 'react';
import { AttentionItem, Banner, Button, Card, EmptyState, ListRow, MetricCard, PageHeader, Sidebar, StatusBreakdown, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { api, faError, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { currentUser, panelUser } from '@/data/session';
import { faDate, faDigits, faLastSeen } from '@/lib/format';
import { pending } from '@/app/pending';
import { Screen, type ScreenState } from '../Screen';

/** Data container: the coach's dashboard. */
export default function CoachDashboardPage(props: { brand?: string }) {
  const d = useQuery('coach-dashboard', remote.coachDashboard);
  const wait = pending(d);
  if (wait) return wait;
  return <CoachDashboard {...props} live={d.data} />;
}

const REASON: Record<string, string> = { missed: 'تمرین از دست رفت', down: 'افت عملکرد', soreness: 'کوفتگی شدید', nutrition: 'پایبندی پایین به تغذیه', pr: 'رکورد شخصی جدید' };
const fa1 = (n: number) => faDigits(String(Math.round(n * 10) / 10)).replace('.', '٫');

function attentionDetail(a): string {
  switch (a.flag) {
    case 'pr':
      return a.exercise ? `${a.exercise} · ${a.type} · ${fa1(a.value)} کیلوگرم${a.previous ? ` (قبلی ${fa1(a.previous)})` : ''}` : 'رکورد جدید ثبت شد';
    case 'missed':
      return `${faDigits(a.flagValue)} جلسه در ۷ روز گذشته انجام نشد`;
    case 'soreness':
      return `گزارش کوفتگی ${faDigits(a.flagValue)} از ۱۰`;
    case 'nutrition':
      return `${faDigits(a.flagValue)}٪ وعده‌ها در ۷ روز گذشته رعایت شد`;
    case 'down':
      return `تغییر قدرت ${fa1(a.flagValue)}٪ در ۳۰ روز`;
    default:
      return '';
  }
}

class CoachDashboard extends Screen {
  state: ScreenState = {};

  live() {
    const d = this.props.live;
    const t = d.today;
    return {
      title: 'سلام، ' + (currentUser()?.name.split(' ')[0] ?? ''),
      subtitle: faDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + faDigits(t.scheduled) + ' تمرین برای امروز برنامه‌ریزی شده',
      exp: d.account.warn
        ? {
            title: faDigits(d.account.daysLeft) + ' روز دیگر حساب شما غیرفعال می‌شود',
            desc:
              'اعتبار حساب ' +
              faDate(new Date(d.account.expiresAt)) +
              ' به پایان می‌رسد. پس از آن شما و ورزشکارانتان نمی‌توانید وارد شوید؛ داده‌ها حفظ می‌شوند و با تمدید برمی‌گردند.',
          }
        : null,
      metrics: {
        total: faDigits(d.athletes.total),
        totalCap: d.athletes.cap ? 'از سقف ' + faDigits(d.athletes.cap) : '',
        active: faDigits(d.athletes.trained7d),
        today: faDigits(t.completed + t.partial),
        todayOf: '/ ' + faDigits(t.scheduled),
        adh: d.adherencePct == null ? 'ثبت نشده' : faDigits(d.adherencePct),
      },
      attn: d.attention.map((a) => ({
        name: a.name,
        kind: a.flag,
        reason: REASON[a.flag] || a.flag,
        detail: attentionDetail(a),
        time: a.at ? faLastSeen(a.at, new Date(), false) : '',
        cta: a.flag === 'pr' ? 'مشاهده' : 'باز کردن',
        to: 'coach:athlete?id=' + a.athleteId,
      })),
      breakdown: [
        { status: 'completed', value: t.completed },
        { status: 'partial', value: t.partial },
        { status: 'missed', value: t.missed },
        { status: 'not-started', value: t.notStarted + t.inProgress },
      ],
      scheduled: faDigits(t.scheduled) + ' برنامه‌ریزی‌شده',
      ending: d.ending,
      invites: d.invites,
    };
  }

  renderVals() {
    const L = this.live();
    const expShow = !this.state.expHidden && !!L.exp;
    const attn = L.attn;
    return {
      expShow,
      hideExp: () => this.setState({ expHidden: true }),
      renew: async () => {
        try {
          await remote.requestRenewal();
        } catch (e) {
          return toast('ارسال نشد', faError(e), 'error');
        }
        this.setState({ expHidden: true });
        toast('درخواست تمدید ارسال شد', 'مدیر پلتفرم از طریق ایمیل با شما هماهنگ می‌کند.');
      },
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: ['داشبورد'],
      L,
      attn,
      noAttn: attn.length === 0,
      attnSub: faDigits(attn.length) + ' ورزشکار · به ترتیب فوریت',
      breakdown: L.breakdown,
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="dashboard" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader title={v.L.title} subtitle={v.L.subtitle}>
            <Button variant="secondary" icon="plus" to="coach:create-athlete">
              افزودن ورزشکار
            </Button>
            <Button variant="primary" icon="clipboard" to="coach:create-program">
              ایجاد برنامه
            </Button>
          </PageHeader>
          {v.expShow ? (
            <>
              <Banner
                tone="warning"
                icon="clock"
                title={v.L.exp.title}
                description={v.L.exp.desc}
                actionLabel="درخواست تمدید"
                onAction={v.renew}
                dismissible
                onDismiss={v.hideExp}
              />
            </>
          ) : null}
          <div className="bl-two-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <MetricCard label="کل ورزشکاران" value={v.L.metrics.total} caption={v.L.metrics.totalCap} icon="users" />
            <MetricCard label="ورزشکاران فعال" value={v.L.metrics.active} caption="تمرین در ۷ روز گذشته" icon="activity" />
            <MetricCard label="تمرین‌های امروز" value={v.L.metrics.today} unit={v.L.metrics.todayOf} caption="تا این لحظه انجام شده" icon="dumbbell" />
            <MetricCard label="نرخ انجام تمرین، ۳۰ روز" value={v.L.metrics.adh} unit={v.L.metrics.adh === 'ثبت نشده' ? undefined : '٪'} caption="میانگین ورزشکاران فعال" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0' }}>
              <Card title="نیازمند توجه شما" subtitle={v.attnSub} actionLabel="همه هشدارها" actionTo="coach:athletes">
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                  {(v.attn || []).map((a: any, $index: number) => (
                    <Fragment key={$index}>
                      <AttentionItem name={a?.name} kind={a?.kind} reason={a?.reason} detail={a?.detail} time={a?.time} actionLabel={a?.cta} to={a?.to || 'coach:athlete'} />
                    </Fragment>
                  ))}
                  {v.noAttn ? (
                    <>
                      <EmptyState icon="check-circle" title="همه چیز مرتب است" description="فعلاً ورزشکاری نیاز به پیگیری ندارد." compact />
                    </>
                  ) : null}
                </div>
              </Card>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <Card title="تمرین‌های امروز" subtitle={v.L.scheduled} actionLabel="مشاهده" actionTo="coach:athletes">
                <StatusBreakdown items={v.breakdown} />
              </Card>
              <Card title="پیش رو" padding="none">
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                  <>
                    {v.L.ending.map((e) => (
                      <ListRow
                        key={'e' + e.athleteId}
                        icon="calendar"
                        title={e.name}
                        subtitle={e.program + ' ' + faDate(new Date(e.ends), { weekday: 'long', day: 'numeric', month: 'long' }) + ' تمام می‌شود'}
                        badge="برنامه بعدی"
                        badgeTone="info"
                        to={'coach:athlete?id=' + e.athleteId}
                      />
                    ))}
                    {!v.L.ending.length ? <ListRow icon="check" title="موردی پیش رو نیست" chevron={false} /> : null}
                  </>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
