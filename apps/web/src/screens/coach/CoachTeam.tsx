// Head coach (سرمربی): the coaches under them — add a coach (username + password), activate / deactivate.
import { useState } from 'react';
import { Badge, Button, EmptyState, Modal, Sidebar, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { faError, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import type { TeamCoach } from '@/data/remote';
import { panelUser, useSessionUser } from '@/data/session';
import { faDigits } from '@/lib/format';
import { toast } from '@/lib/toast';

function AddCoach({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [f, setF] = useState({ name: '', username: '', password: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name.trim() && /^[A-Za-z0-9_.-]{3,40}$/.test(f.username) && f.password.length >= 8;
  const save = async () => {
    setBusy(true);
    try {
      await remote.createTeamCoach({ name: f.name.trim(), username: f.username.trim(), password: f.password, phone: f.phone.trim() || undefined });
      toast('مربی اضافه شد', f.name.trim());
      onDone();
    } catch (e) {
      toast('مربی ساخته نشد', faError(e), 'error');
      setBusy(false);
    }
  };
  return (
    <Modal
      title="افزودن مربی"
      description="مربی با همین نام کاربری و رمز وارد می‌شود. کتابخانه حرکات و قالب‌های برنامه بین همهٔ مربیان مشترک است."
      primaryLabel="افزودن"
      primaryDisabled={!valid}
      loading={busy}
      onPrimary={save}
      secondaryLabel="انصراف"
      onSecondary={onClose}
      onClose={onClose}
    >
      <TextField label="نام و نام خانوادگی" onChange={set('name')} />
      <TextField label="نام کاربری" dir="ltr" hint="حروف انگلیسی، عدد و _ . - (حداقل ۳ نویسه)" onChange={set('username')} />
      <TextField label="رمز عبور" type="password" hint="حداقل ۸ نویسه" onChange={set('password')} />
      <TextField label="موبایل (اختیاری)" dir="ltr" inputMode="numeric" placeholder="09xxxxxxxxx" onChange={set('phone')} />
    </Modal>
  );
}

export default function CoachTeamPage(props: { brand?: string }) {
  const me = useSessionUser();
  const q = useQuery<TeamCoach[]>('team', () => remote.team());
  const [adding, setAdding] = useState(false);
  const toggle = async (c: TeamCoach) => {
    try {
      await remote.setTeamStatus(c.id, c.status === 'active' ? 'inactive' : 'active');
      q.refetch();
    } catch (e) {
      toast('تغییر وضعیت انجام نشد', faError(e), 'error');
    }
  };
  const list = q.data ?? [];
  return (
    <PanelLayout
      theme={props.brand ?? 'brand'}
      sidebar={<Sidebar app="coach" active="team" brandSub="فضای کاری سرمربی" user={panelUser({ name: 'سرمربی', role: 'سرمربی' })} />}
      topBar={<TopBar breadcrumbs={['تیم مربیان']} search />}
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, flex: 1 }}>تیم مربیان</h1>
          {me?.isHeadCoach ? (
            <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
              افزودن مربی
            </Button>
          ) : null}
        </div>
        {!me?.isHeadCoach ? <EmptyState icon="lock" title="فقط سرمربی به این بخش دسترسی دارد" /> : null}
        {me?.isHeadCoach && !q.loading && !list.length ? (
          <EmptyState icon="users" title="هنوز مربی‌ای اضافه نشده" description="مربیان زیرمجموعهٔ شما اینجا فهرست می‌شوند." actionLabel="افزودن مربی" onAction={() => setAdding(true)} />
        ) : null}
        {list.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right' }}>{c.username}</div>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{faDigits(c.athleteCount)} ورزشکار</span>
            <Badge tone={c.status === 'active' ? 'success' : 'neutral'}>{c.status === 'active' ? 'فعال' : 'غیرفعال'}</Badge>
            <Button variant="secondary" size="sm" onClick={() => void toggle(c)}>
              {c.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
            </Button>
          </div>
        ))}
      </div>
      {adding ? (
        <AddCoach
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            q.refetch();
          }}
        />
      ) : null}
    </PanelLayout>
  );
}
