// Devices signed in to this account (sign-in sessions). Sign a lost phone out from here; it stops getting
// notifications too. Signing in is never limited.
import { faDigits, faTime } from '@baseline/core';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { signOut } from '../api/auth';
import { faError, http } from '../api/http';
import { useNav } from '../navigation/types';
import { Badge, Button, EmptyState, ListGroup, ListRow, MobileHeader, Modal, Screen, toast, Txt } from '../ui';

interface Row {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? 'امروز ' + faTime(d) : days === 1 ? 'دیروز' : faDigits(days) + ' روز پیش';
};

export function DevicesScreen() {
  const nav = useNav();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ask, setAsk] = useState<Row | 'others' | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    http
      .get<Row[]>('/auth/sessions/')
      .then(setRows)
      .catch((e) => toast('بارگذاری نشد', faError(e), 'error'));
  }, []);
  useEffect(load, [load]);

  const confirm = async () => {
    if (!ask) return;
    setBusy(true);
    try {
      if (ask === 'others') await http.post('/auth/sessions/end-others/');
      else await http.del(`/auth/sessions/${ask.id}/`);
      if (ask !== 'others' && ask.current) return void signOut();
      toast('خارج شد', ask === 'others' ? 'دستگاه‌های دیگر از حسابت خارج شدند.' : ask.device);
      load();
    } catch (e) {
      toast('انجام نشد', faError(e), 'error');
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };
  const others = (rows || []).filter((r) => !r.current).length;
  return (
    <Screen gap={14} header={<MobileHeader title="دستگاه‌ها" back="پروفایل" onBack={() => nav.goBack()} />}>
      <Txt size={13} lh={22} color="text-secondary">
        دستگاه‌هایی که با حسابت وارد شده‌اند. اگر دستگاهی را نمی‌شناسی یا گوشی‌ات گم شده، از آن خارج شو.
      </Txt>
      {rows && !rows.length ? <EmptyState icon="lock" title="دستگاهی ثبت نشده" /> : null}
      {rows?.length ? (
        <ListGroup>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              icon={r.current ? 'check-circle' : 'circle'}
              iconColor={r.current ? 'success' : 'text-muted'}
              title={r.device}
              subtitle={'آخرین فعالیت ' + when(r.lastSeenAt) + (r.ip ? ' · ' + r.ip : '')}
              value={r.current ? undefined : 'خروج'}
              onPress={() => setAsk(r)}
            />
          ))}
        </ListGroup>
      ) : null}
      {rows?.some((r) => r.current) ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Badge tone="success" size="sm">
            ✓ = همین دستگاه
          </Badge>
        </View>
      ) : null}
      {others ? (
        <Button variant="secondary" icon="log-out" onPress={() => setAsk('others')}>
          {'خروج از ' + faDigits(others) + ' دستگاه دیگر'}
        </Button>
      ) : null}
      <Modal
        open={!!ask}
        title={ask === 'others' ? 'خروج از دستگاه‌های دیگر؟' : ask?.current ? 'از همین دستگاه خارج می‌شوی؟' : 'خروج از «' + (ask?.device || '') + '»؟'}
        description={ask === 'others' ? 'همه دستگاه‌ها به‌جز همین گوشی از حسابت خارج می‌شوند.' : 'روی آن دستگاه باید دوباره با رمز وارد شوی و تا آن موقع اعلانی نمی‌گیرد.'}
        primaryLabel="خروج"
        secondaryLabel="انصراف"
        loading={busy}
        onPrimary={() => void confirm()}
        onClose={() => setAsk(null)}
      />
    </Screen>
  );
}
