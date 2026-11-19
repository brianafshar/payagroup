// Ported from design handoff: project/A08 Admin Access.dc.html
import { Fragment } from 'react';
import { Badge, Banner, Button, Card, Checkbox, DataTable, Icon, Modal, PageHeader, Select, Sidebar, Switch, Tabs, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { ShareLinkModal } from '@/app/modals/ShareLinkModal';
import { api, faError, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import type { Admin } from '@/data/types';
import { daysUntil, faDigits, faLastSeen } from '@/lib/format';
import { toast } from '@/lib/toast';
import { currentUser, panelUser } from '@/data/session';
import { pending } from '@/app/pending';
import { Screen } from '../Screen';

const isMe = (a: { id: string }) => a.id === String(currentUser()?.id);

function lastActivity(a: Admin): string {
  if (a.pending) {
    const d = a.invitedAt ? -daysUntil(a.invitedAt) : 0;
    return d <= 0 ? 'همین حالا دعوت شد' : faDigits(d) + ' روز پیش دعوت شد';
  }
  if (isMe(a)) return 'اکنون';
  return faLastSeen(a.lastLoginAt, new Date(), false);
}

/** Data container: admin users, the saved permission matrix and the security policy. */
export default function AdminAccessPage(props: { brand?: string }) {
  const admins = useQuery('admins', api.admins.list);
  const settings = useQuery('platform-settings', remote.platformSettings);
  const wait = pending(admins, settings);
  if (wait) return wait;
  return <AdminAccess {...props} admins={admins.data} settings={settings.data} />;
}

const toBits = (p: Record<string, boolean[]>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.map((x) => (x ? 1 : 0))]));
const toBools = (p: Record<string, number[]>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.map(Boolean)]));
const MONTH_DAYS = { '12': 365, '24': 730, '36': 1095 };

class AdminAccess extends Screen {
  constructor(p) {
    super(p);
    const base = toBits(p.settings.permissions);
    this.state = {
      tab: 'roles',
      perm: base,
      saved: base,
      invite: false,
      invEmail: '',
      invName: '',
      invRole: 'sp',
      tried: false,
      link: null,
    };
  }

  async saveSecurity(data: Record<string, unknown>, msg: string) {
    try {
      await remote.savePlatformSettings(data);
    } catch (e) {
      return toast('ذخیره نشد', faError(e), 'error');
    }
    toast(msg);
  }

  renderVals() {
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const { tab, perm, saved, invite, invEmail, invName, invRole, tried } = this.state;
    const admins = (this.props.admins as Admin[]).map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role === 'super' ? 'sa' : 'sp',
      mfa: a.twoFactor,
      pending: a.pending,
      l: lastActivity(a),
    }));
    const T = (a: string, b?: string) => toast(a, b);
    const ROLE = { sa: 'مدیر ارشد', sp: 'مدیر پشتیبانی' };
    const Y = { label: 'مجاز', tone: 'success', icon: 'check' },
      N = { label: 'بدون دسترسی', tone: 'neutral', icon: 'minus' },
      O = { label: 'داده خود', tone: 'info', icon: 'user' };
    const rows: Array<[string, string, typeof Y, typeof Y]> = [
      ['cm', 'ایجاد، فعال‌سازی و غیرفعال‌سازی مربیان', N, N],
      ['br', 'پیکربندی برندینگ مربی', N, N],
      ['ath', 'مدیریت حساب ورزشکاران', O, N],
      ['health', 'مشاهده اطلاعات سلامت', O, O],
      ['prog', 'ایجاد برنامه و حرکت', Y, N],
      ['log', 'ثبت تمرین، تغذیه و ریکاوری', N, O],
      ['rep', 'مشاهده گزارش‌ها و آمار پلتفرم', N, N],
      ['audit', 'مشاهده گزارش رویدادها', N, N],
      ['adm', 'مدیریت کاربران مدیر', N, N],
    ];
    const dirty = JSON.stringify(perm) !== JSON.stringify(saved);
    // Changing admins, permissions or the security policy needs «مدیریت کاربران مدیر»; everyone else reads.
    const manage = !!saved.adm?.[currentUser()?.adminRole === 'super' ? 0 : 1];
    const ro = (b) => ({ edit: false, ro: true, ...b });
    const emailOk = /^\S+@\S+\.\S+$/.test(invEmail.trim());
    const dup = admins.some((a) => a.email.toLowerCase() === invEmail.trim().toLowerCase());
    const ON = { label: 'دومرحله‌ای فعال', tone: 'success', icon: 'shield' },
      WAIT = { label: 'در انتظار راه‌اندازی', tone: 'warning', icon: 'alert-triangle' };
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'سینا توکلی', role: 'مدیر ارشد' }),
      crumbs: ['دسترسی و نقش‌ها'],
      tab,
      setTab: (v) => this.setState({ tab: v }),
      isUsers: tab === 'users',
      isRoles: tab === 'roles',
      isSecurity: tab === 'security',
      tabs: [
        { id: 'users', label: 'کاربران مدیر', count: fa(admins.length) },
        { id: 'roles', label: 'نقش‌ها و مجوزها' },
        { id: 'security', label: 'امنیت' },
      ],
      roleHeads: [
        { label: 'مدیر ارشد', locked: false },
        { label: 'مدیر پشتیبانی', locked: false },
        { label: 'مربی', locked: true },
        { label: 'ورزشکار', locked: true },
      ],
      perm: rows.map(([k, cap, co, at]) => {
        const pr = perm[k];
        const cell = (idx) => {
          if (!pr) return ro(N);
          if (idx === 0 && k === 'adm') return ro(Y);
          if (!manage) return ro(pr[idx] ? Y : N);
          return {
            edit: true,
            ro: false,
            on: !!pr[idx],
            aria: cap + ' · ' + (idx ? 'مدیر پشتیبانی' : 'مدیر ارشد'),
            toggle: () =>
              this.setState((s) => {
                const n = { ...s.perm, [k]: [...s.perm[k]] };
                n[k][idx] = n[k][idx] ? 0 : 1;
                return { perm: n };
              }),
          };
        };
        return { cap, cells: [cell(0), cell(1), ro(co), ro(at)] };
      }),
      dirty,
      manage,
      resetPerm: () => this.setState({ perm: saved }),
      savePerm: async () => {
        try {
          await remote.savePlatformSettings({ permissions: toBools(perm) });
        } catch (e) {
          return toast('ذخیره نشد', faError(e), 'error');
        }
        this.setState({ saved: perm });
        T('مجوزها ذخیره شد', 'از همین حالا اعمال می‌شود.');
      },
      usersSub: fa(admins.filter((a) => !a.pending).length) + ' فعال · ' + fa(admins.filter((a) => a.pending).length) + ' دعوت در انتظار',
      adminCols: [
        { key: 'a', label: 'مدیر', type: 'person' },
        { key: 'r', label: 'نقش', type: 'badge' },
        { key: 'f', label: 'تأیید دومرحله‌ای', type: 'badge' },
        { key: 'l', label: 'آخرین فعالیت' },
        { key: 'x', label: '', type: 'actions', width: 48 },
      ],
      admins: admins.map((a) => {
        const me = isMe(a);
        const acts = [];
        if (manage && !me)
          acts.push({
            label: a.role === 'sa' ? 'تغییر به مدیر پشتیبانی' : 'تغییر به مدیر ارشد',
            icon: 'key',
            onClick: () =>
              api.admins.setRole(a.id, a.role === 'sa' ? 'support' : 'super').then(
                () => T('نقش تغییر کرد', a.name || a.email),
                (e) => toast('انجام نشد', faError(e), 'error'),
              ),
          });
        if (manage && a.pending)
          acts.push({
            label: 'لینک دعوت',
            icon: 'link',
            onClick: () => this.setState({ link: { kind: 'invite', id: a.id, name: a.name || a.email, email: a.email, inviteKind: 'admin' } }),
          });
        else if (manage && a.mfa && !me)
          acts.push({
            label: 'بازنشانی تأیید دومرحله‌ای',
            icon: 'shield',
            onClick: () =>
              remote.resetTwoFactor(a.id).then(
                () => T('تأیید دومرحله‌ای بازنشانی شد', a.email + ' در ورود بعدی دوباره آن را راه‌اندازی می‌کند.'),
                (e) => toast('انجام نشد', faError(e), 'error'),
              ),
          });
        if (manage && !me) {
          acts.push({ divider: true });
          acts.push({
            label: a.pending ? 'لغو دعوت' : 'حذف دسترسی',
            icon: 'trash',
            destructive: true,
            onClick: () =>
              api.admins.remove(a.id).then(
                () => T(a.pending ? 'دعوت لغو شد' : 'دسترسی حذف شد', a.email),
                (e) => toast('انجام نشد', faError(e), 'error'),
              ),
          });
        }
        return {
          id: a.id,
          a: { name: a.name || a.email, sub: a.email },
          r: { label: ROLE[a.role], tone: a.role === 'sa' ? 'brand' : 'neutral', icon: a.role === 'sa' ? 'key' : 'user' },
          f: a.mfa ? ON : WAIT,
          l: a.l,
          x: '',
          actions: acts,
        };
      }),
      inviteOpen: invite,
      openInvite: () => this.setState({ invite: true, invEmail: '', invName: '', invRole: 'sp', tried: false }),
      closeInvite: () => this.setState({ invite: false }),
      invEmail,
      setInvEmail: (v) => this.setState({ invEmail: v, tried: true }),
      invName,
      setInvName: (v) => this.setState({ invName: v }),
      invRole,
      setInvRole: (v) => this.setState({ invRole: v }),
      roleOpts: [
        { value: 'sp', label: 'مدیر پشتیبانی' },
        { value: 'sa', label: 'مدیر ارشد' },
      ],
      invErr: tried && invEmail.trim() && !emailOk ? 'یک ایمیل معتبر وارد کنید.' : dup ? 'این ایمیل قبلاً دعوت شده است.' : undefined,
      inviteBad: !emailOk || dup,
      sendInvite: () => {
        if (!emailOk || dup) return;
        const e = invEmail.trim();
        api.admins.invite({ name: invName.trim(), email: e, role: invRole === 'sa' ? 'super' : 'support' }).then(
          () => {
            this.setState({ invite: false, tab: 'users' });
            T('دعوت‌نامه ارسال شد', 'لینک دعوت به ' + e + ' فرستاده شد.');
          },
          (err) => toast('دعوت ارسال نشد', faError(err), 'error'),
        );
      },
      sw1: (v) => this.saveSecurity({ requireAdmin2fa: v }, v ? 'تأیید دومرحله‌ای برای مدیران الزامی شد' : 'الزام تأیید دومرحله‌ای مدیران برداشته شد'),
      sw2: (v) => this.saveSecurity({ requireCoach2fa: v }, v ? 'تأیید دومرحله‌ای برای مربیان الزامی شد' : 'الزام تأیید دومرحله‌ای مربیان برداشته شد'),
      saved: () => T('تنظیمات ذخیره شد'),
      setTimeoutH: (h) => this.saveSecurity({ sessionTimeoutMinutes: Number(h) * 60 }, 'تنظیمات ذخیره شد'),
      setRetention: (m) => this.saveSecurity({ auditRetentionDays: MONTH_DAYS[m] ?? 730 }, 'تنظیمات ذخیره شد'),
      sec: {
        admin2fa: this.props.settings.requireAdmin2fa,
        coach2fa: this.props.settings.requireCoach2fa,
        timeout: String(Math.round(this.props.settings.sessionTimeoutMinutes / 60)),
        retention: String(Object.entries(MONTH_DAYS).find(([, d]) => d === this.props.settings.auditRetentionDays)?.[0] ?? '24'),
      },
      timeout: [
        { value: '1', label: '۱ ساعت' },
        { value: '4', label: '۴ ساعت' },
        { value: '8', label: '۸ ساعت' },
      ],
      retention: [
        { value: '12', label: '۱۲ ماه' },
        { value: '24', label: '۲۴ ماه' },
        { value: '36', label: '۳۶ ماه' },
      ],
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="admin" active="access" brandSub="مدیریت پلتفرم" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search searchPlaceholder="جستجوی مربی، ورزشکار" />}
        overlays={
          <>
            {v.inviteOpen ? (
              <>
                <div style={{ position: 'absolute', inset: '0' }}>
                  <Modal
                    title="دعوت مدیر"
                    description="لینک دعوت به این ایمیل فرستاده می‌شود و ۷ روز معتبر است. مدیر جدید باید تأیید دومرحله‌ای را فعال کند."
                    primaryLabel="ارسال دعوت"
                    primaryDisabled={v.inviteBad}
                    secondaryLabel="انصراف"
                    onPrimary={v.sendInvite}
                    onClose={v.closeInvite}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <TextField label="ایمیل" dir="ltr" required value={v.invEmail} placeholder="name@example.com" error={v.invErr} onChange={v.setInvEmail} />
                      <TextField label="نام" optional value={v.invName} placeholder="مثلاً هدی کریمی" onChange={v.setInvName} />
                      <Select label="نقش" value={v.invRole} options={v.roleOpts} onChange={v.setInvRole} />
                    </div>
                  </Modal>
                </div>
              </>
            ) : null}
            {this.state.link ? <ShareLinkModal target={this.state.link} onClose={() => this.setState({ link: null })} /> : null}
          </>
        }
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PageHeader title="دسترسی و نقش‌ها" subtitle="چه کسی در پلتفرم چه کاری می‌تواند انجام دهد">
            {v.manage ? (
              <Button variant="primary" icon="mail" onClick={v.openInvite}>
                دعوت مدیر
              </Button>
            ) : null}
          </PageHeader>
          {v.manage ? null : (
            <Banner tone="info" icon="key" title="فقط مشاهده" description="برای افزودن مدیر یا تغییر مجوزها و تنظیمات امنیتی، مجوز «مدیریت کاربران مدیر» لازم است." />
          )}
          <Tabs value={v.tab} tabs={v.tabs} onChange={v.setTab} />
          {v.isUsers ? (
            <>
              <Card title="کاربران مدیر" subtitle={v.usersSub} padding="none">
                <DataTable bare columns={v.adminCols} rows={v.admins} />
              </Card>
            </>
          ) : null}
          {v.isRoles ? (
            <>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '0',
                }}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1', minWidth: '0' }}>
                    <span style={{ fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>مجوزهای نقش‌ها</span>
                    <span style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)' }}>تیک بزنید تا مجوز داده شود. ستون‌های قفل‌دار توسط سیستم تعیین می‌شوند.</span>
                  </div>
                  {v.dirty ? (
                    <>
                      <Button variant="ghost" onClick={v.resetPerm}>
                        انصراف
                      </Button>
                      <Button variant="primary" icon="save" onClick={v.savePerm}>
                        ذخیره تغییرات
                      </Button>
                    </>
                  ) : null}
                </div>
                {/* Five columns don't fit a phone: the matrix scrolls sideways inside the card. */}
                <div className="bl-dt-scroll" style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: '720px' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1fr) repeat(4,150px)',
                        alignItems: 'center',
                        padding: '10px 20px',
                        background: 'var(--surface-sunken)',
                        fontSize: '12px',
                        lineHeight: '18px',
                        fontWeight: '600',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span>قابلیت</span>
                      {(v.roleHeads || []).map((r: any, $index: number) => (
                        <Fragment key={$index}>
                          <span style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                            {r?.label}
                            {r?.locked ? (
                              <>
                                <Icon name="lock" size="12" />
                              </>
                            ) : null}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                    {(v.perm || []).map((p: any, $index: number) => (
                      <Fragment key={$index}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0,1fr) repeat(4,150px)',
                            alignItems: 'center',
                            minHeight: '48px',
                            padding: '0 20px',
                            borderTop: '1px solid var(--border-subtle, var(--border))',
                          }}
                        >
                          <span style={{ fontSize: '14px', lineHeight: '22px' }}>{p?.cap}</span>
                          {(p?.cells || []).map((c: any, $index: number) => (
                            <Fragment key={$index}>
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                {c?.edit ? (
                                  <>
                                    <Checkbox checked={c?.on} onChange={c?.toggle} aria-label={c?.aria} />
                                  </>
                                ) : null}
                                {c?.ro ? (
                                  <>
                                    <Badge tone={c?.tone} icon={c?.icon} size="sm">
                                      {c?.label}
                                    </Badge>
                                  </>
                                ) : null}
                              </div>
                            </Fragment>
                          ))}
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>
                  اطلاعات سلامت ورزشکاران هرگز برای نقش‌های مدیر قابل فعال شدن نیست.
                </div>
              </div>
            </>
          ) : null}
          {v.isSecurity ? (
            <>
              <div style={{ maxWidth: '640px' }}>
                <Card title="امنیت">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '0' }}>
                    <Switch
                      onChange={v.sw1}
                      label="الزام تأیید دومرحله‌ای برای همه مدیران"
                      description="مدیرانی که آن را فعال نکرده‌اند هنگام ورود مسدود می‌شوند."
                      checked={v.sec.admin2fa}
                      disabled={!v.manage}
                    />
                    <Switch
                      onChange={v.sw2}
                      label="الزام تأیید دومرحله‌ای برای مربیان"
                      description="توصیه می‌شود. مربیان اطلاعات سلامت را می‌بینند."
                      checked={v.sec.coach2fa}
                      disabled={!v.manage}
                    />
                    <Select disabled={!v.manage} onChange={v.setTimeoutH} label="پایان نشست مدیر" value={v.sec.timeout} options={v.timeout} />
                    <Select disabled={!v.manage} onChange={v.setRetention} label="مدت نگهداری گزارش رویدادها" value={v.sec.retention} options={v.retention} />
                    <Button variant="secondary" icon="shield" to="account">
                      امنیت حساب من (ورود دومرحله‌ای، رمز)
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          ) : null}
        </div>
      </PanelLayout>
    );
  }
}
