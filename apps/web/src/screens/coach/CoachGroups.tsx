// Broadcast groups in «گفتگو» (#81): the coach makes a group from their athletes and posts to it —
// text, photos, videos and files. Members read in the app and can't reply.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Checkbox, EmptyState, Icon, IconButton, Modal, SearchField, TextField } from '@/ds';
import { api, faError, remote } from '@/data/api';
import type { ChatGroup, GroupMessage } from '@/data/remote';
import type { Athlete } from '@/data/types';
import { subscribeRealtime } from '@/data/realtime';
import { confirmDialog } from '@/lib/confirm';
import { faDate, faDigits, faTime } from '@/lib/format';
import { toast } from '@/lib/toast';

const VIDEO = /\.(mp4|mov|webm|m4v)$/i;
const IMAGE = /\.(jpe?g|png|webp|gif)$/i;
const fileName = (url: string) => decodeURIComponent(url.split('?')[0].split('/').pop() || 'file');

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'امروز';
  if (d.toDateString() === y.toDateString()) return 'دیروز';
  return faDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Create a group or change its name and members. */
function GroupEditor({ group, athletes, onSaved, onClose }: { group: ChatGroup | null; athletes: Athlete[]; onSaved: (g: ChatGroup) => void; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? '');
  const [sel, setSel] = useState<number[]>(group?.members ?? []);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const list = athletes.filter((a) => a.status !== 'inactive' && (!q.trim() || a.name.includes(q.trim())));
  const all = list.length > 0 && list.every((a) => sel.includes(Number(a.id)));
  const toggle = (id: number, on: boolean) => setSel((s) => (on ? [...new Set([...s, id])] : s.filter((x) => x !== id)));
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await remote.saveGroup(group?.id ?? null, { name: name.trim(), members: sel }));
    } catch (e) {
      toast('گروه ذخیره نشد', faError(e), 'error');
      setBusy(false);
    }
  };
  return (
    <Modal
      title={group ? 'ویرایش گروه' : 'گروه جدید'}
      description="فقط شما در گروه پیام می‌گذارید؛ ورزشکاران پیام‌ها را در اپ می‌بینند ولی نمی‌توانند پاسخ بدهند."
      primaryLabel={group ? 'ذخیره' : 'ساخت گروه'}
      primaryDisabled={!name.trim() || !sel.length}
      loading={busy}
      secondaryLabel="انصراف"
      onPrimary={save}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextField label="نام گروه" placeholder="مثلاً تیم صبح" value={name} onChange={setName} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14, flex: 1 }}>اعضا</strong>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{faDigits(sel.length) + ' انتخاب شده'}</span>
        </div>
        <SearchField placeholder="جستجوی ورزشکار" size="sm" onChange={setQ} />
        {list.length ? (
          <Checkbox
            label="انتخاب همه"
            checked={all}
            indeterminate={!all && list.some((a) => sel.includes(Number(a.id)))}
            onChange={(on) => list.forEach((a) => toggle(Number(a.id), on))}
          />
        ) : null}
        <div role="group" aria-label="اعضای گروه" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto', paddingInlineEnd: 4 }}>
          {list.map((a) => (
            <Checkbox
              key={a.id}
              label={a.name}
              
              checked={sel.includes(Number(a.id))}
              onChange={(on) => toggle(Number(a.id), on)}
            />
          ))}
          {!list.length ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ورزشکاری پیدا نشد.</span> : null}
        </div>
      </div>
    </Modal>
  );
}

function Post({ m, onEdit, onDelete }: { m: GroupMessage; onEdit: () => void; onDelete: () => void }) {
  const url = m.attachment || '';
  const name = url ? fileName(url) : '';
  return (
    <div className="bl-msg-own" style={{ alignSelf: 'flex-start', maxWidth: 'min(520px, 85%)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--brand-primary-subtle)',
          borderRadius: '14px 14px 14px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          color: m.deleted ? 'var(--text-muted)' : 'var(--text-primary)',
        }}
      >
        {m.deleted ? <em style={{ fontSize: 14 }}>این پیام حذف شد</em> : null}
        {url && IMAGE.test(name) ? (
          <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
            <img src={url} alt={name} style={{ display: 'block', maxWidth: 260, maxHeight: 260, borderRadius: 8, objectFit: 'cover' }} />
          </a>
        ) : url && VIDEO.test(name) ? (
          <video
            src={url}
            controls
            preload="metadata"
            playsInline
            style={{ display: 'block', width: 280, maxWidth: '100%', maxHeight: 360, borderRadius: 8, background: '#000' }}
          />
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'inherit', textDecoration: 'none' }}>
            <Icon name="file-text" size={18} />
            <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          </a>
        ) : null}
        {m.text ? <span style={{ fontSize: 14, lineHeight: '23px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</span> : null}
      </div>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, lineHeight: '16px', color: 'var(--text-muted)' }}>
        {faTime(new Date(m.createdAt)) + (m.editedAt && !m.deleted ? ' · ویرایش شد' : '')}
        {!m.deleted ? (
          <>
            {m.text ? (
              <button type="button" className="bl-msg-act" onClick={onEdit}>
                ویرایش
              </button>
            ) : null}
            <button type="button" className="bl-msg-act" onClick={onDelete}>
              حذف
            </button>
          </>
        ) : null}
      </span>
    </div>
  );
}

export function CoachGroups({ modeSwitch }: { modeSwitch: ReactNode }) {
  const [groups, setGroups] = useState<ChatGroup[] | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [cur, setCur] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<GroupMessage[]>([]);
  const [thread, setThread] = useState(false); // phones: list or the open group
  const [editor, setEditor] = useState<{ group: ChatGroup | null } | null>(null);
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const curRef = useRef<number | null>(null);
  curRef.current = cur;

  const loadGroups = async () => {
    try {
      const g = await remote.groups();
      setGroups(g);
      setCur((c) => (c && g.some((x) => x.id === c) ? c : (g[0]?.id ?? null)));
    } catch (e) {
      setGroups([]);
      toast('گروه‌ها بارگذاری نشد', faError(e), 'error');
    }
  };
  useEffect(() => {
    void loadGroups();
    api.athletes
      .list()
      .then(setAthletes)
      .catch(() => {});
    return subscribeRealtime((e) => {
      if (e.type !== 'group') return;
      const m = e.message as unknown as GroupMessage | undefined;
      if (m && e.groupId === curRef.current) setMsgs((list) => (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m]));
      void remote
        .groups()
        .then(setGroups)
        .catch(() => {});
    });
  }, []);
  useEffect(() => {
    setMsgs([]);
    setEditing(null);
    setDraft('');
    setFile(null);
    if (!cur) return;
    remote
      .groupMessages(cur)
      .then((m) => curRef.current === cur && setMsgs(m))
      .catch((e) => toast('پیام‌ها بارگذاری نشد', faError(e), 'error'));
  }, [cur]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, cur, thread]);

  const g = groups?.find((x) => x.id === cur) ?? null;
  const shown = (groups || []).filter((x) => !q.trim() || x.name.includes(q.trim()));
  const memberNames = g?.members?.map((id) => athletes.find((a) => Number(a.id) === id)?.name).filter(Boolean) ?? [];

  const send = async () => {
    if (!g || sending) return;
    const text = draft.trim();
    if (editing) {
      if (!text) return;
      setSending(true);
      try {
        const m = await remote.editGroupMessage(g.id, editing.id, text);
        setMsgs((l) => l.map((x) => (x.id === m.id ? m : x)));
        setEditing(null);
        setDraft('');
      } catch (e) {
        toast('ویرایش نشد', faError(e), 'error');
      }
      setSending(false);
      return;
    }
    if (!text && !file) return;
    setSending(true);
    try {
      const m = await remote.postToGroup(g.id, text, file ?? undefined);
      setMsgs((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
      setDraft('');
      setFile(null);
      void loadGroups();
    } catch (e) {
      toast('پیام ارسال نشد', faError(e), 'error');
    }
    setSending(false);
  };
  const remove = async (m: GroupMessage) => {
    if (!g || !(await confirmDialog({ title: 'این پیام حذف شود؟', description: 'پیام برای همه اعضای گروه حذف می‌شود.', confirmLabel: 'حذف', destructive: true }))) return;
    try {
      const d = await remote.deleteGroupMessage(g.id, m.id);
      setMsgs((l) => l.map((x) => (x.id === d.id ? d : x)));
    } catch (e) {
      toast('حذف نشد', faError(e), 'error');
    }
  };
  const removeGroup = async () => {
    if (!g || !(await confirmDialog({ title: 'گروه «' + g.name + '» حذف شود؟', description: 'همه پیام‌های گروه هم حذف می‌شوند.', confirmLabel: 'حذف گروه', destructive: true })))
      return;
    try {
      await remote.deleteGroup(g.id);
      setCur(null);
      setThread(false);
      await loadGroups();
      toast('گروه حذف شد', g.name);
    } catch (e) {
      toast('حذف نشد', faError(e), 'error');
    }
  };
  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const video = f.type.startsWith('video/') || VIDEO.test(f.name);
    if (f.size > (video ? 200 : 20) * 1024 * 1024) return toast('فایل بزرگ است', video ? 'حداکثر حجم ویدیو ۲۰۰ مگابایت است.' : 'حداکثر حجم فایل ۲۰ مگابایت است.', 'error');
    setFile(f);
  };

  let day = '';
  return (
    <div className={'bl-chat ' + (thread ? 'is-thread' : 'is-list')} style={{ flex: '1 1 0', minHeight: 0, display: 'flex' }}>
      <aside
        className="bl-chat-list"
        style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, lineHeight: '26px', fontWeight: 600, flex: 1 }}>گفتگو</h2>
            <Button variant="primary" size="sm" icon="plus" onClick={() => setEditor({ group: null })}>
              گروه جدید
            </Button>
          </div>
          {modeSwitch}
          <SearchField placeholder="جستجوی گروه" size="sm" onChange={setQ} />
        </div>
        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
          {groups && !groups.length ? (
            <EmptyState
              compact
              icon="users"
              title="هنوز گروهی ندارید"
              description="یک گروه بسازید، ورزشکاران را اضافه کنید و پیام، عکس یا ویدیو را یک‌جا برای همه بفرستید."
              actionLabel="ساخت گروه"
              onAction={() => setEditor({ group: null })}
            />
          ) : null}
          {shown.map((x) => (
            <button
              key={x.id}
              type="button"
              className="hv-sunken"
              onClick={() => {
                setCur(x.id);
                setThread(true);
              }}
              style={{
                width: '100%',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '12px 16px',
                border: 0,
                borderBottom: '1px solid var(--border-subtle)',
                background: x.id === cur ? 'var(--brand-primary-subtle)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'right',
                font: 'inherit',
                color: 'var(--text-primary)',
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: 'var(--brand-primary-subtle)',
                  color: 'var(--brand-primary-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="users" size={18} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, lineHeight: '22px', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{x.lastAt ? faTime(new Date(x.lastAt)) : ''}</span>
                </span>
                <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {x.lastText || faDigits(x.memberCount) + ' عضو'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <section className="bl-chat-thread" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--background)' }}>
        {g ? (
          <>
            <header
              className="bl-chat-head"
              style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <span className="bl-chat-back">
                <IconButton icon="arrow-right" label="همه گروه‌ها" size="sm" onClick={() => setThread(false)} />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 15, lineHeight: '22px', fontWeight: 600 }}>{g.name}</span>
                <span
                  title={memberNames.join('، ')}
                  style={{ fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}
                >
                  {faDigits(g.memberCount) + ' عضو' + (memberNames.length ? ' · ' + memberNames.join('، ') : '')}
                </span>
              </div>
              <Button variant="ghost" size="sm" icon="users" onClick={() => setEditor({ group: g })}>
                اعضا
              </Button>
              <IconButton icon="trash" label="حذف گروه" size="sm" onClick={() => void removeGroup()} />
            </header>
            <div
              style={{
                padding: '8px 20px',
                fontSize: 12,
                lineHeight: '18px',
                color: 'var(--text-secondary)',
                background: 'var(--surface-sunken)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              فقط شما در این گروه پیام می‌گذارید؛ اعضا پیام‌ها را در اپ می‌بینند.
            </div>
            <div ref={scroller} style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!msgs.length ? <EmptyState compact icon="chat" title="هنوز پیامی نیست" description="اولین پیام، عکس یا ویدیو را برای اعضای گروه بفرستید." /> : null}
              {msgs.map((m) => {
                const d = dayLabel(m.createdAt);
                const sep = d !== day ? (day = d) : null;
                return (
                  <div key={m.id} style={{ display: 'contents' }}>
                    {sep ? <div style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '2px 10px' }}>{sep}</div> : null}
                    <Post
                      m={m}
                      onEdit={() => {
                        setEditing(m);
                        setDraft(m.text);
                        setFile(null);
                      }}
                      onDelete={() => void remove(m)}
                    />
                  </div>
                );
              })}
            </div>
            <footer style={{ padding: '12px 20px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {editing || file ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {editing ? 'ویرایش پیام: ' + editing.text : (VIDEO.test(file!.name) || file!.type.startsWith('video/') ? 'ویدیو: ' : 'فایل: ') + file!.name}
                  </span>
                  <button
                    type="button"
                    className="bl-msg-act"
                    onClick={() => {
                      setEditing(null);
                      setFile(null);
                      if (editing) setDraft('');
                    }}
                  >
                    انصراف
                  </button>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                {!editing ? (
                  <label
                    className="hv-border-brand"
                    title="پیوست عکس، ویدیو یا فایل"
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <input type="file" accept="image/*,video/*,.pdf" onChange={pickFile} style={{ display: 'none' }} />
                    <Icon name="image" size={18} />
                  </label>
                ) : null}
                <textarea
                  className="fc-ring"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder={'پیام به گروه ' + g.name + '…'}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 40,
                    maxHeight: 120,
                    resize: 'none',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    font: "400 14px/22px 'Vazirmatn',sans-serif",
                    color: 'var(--text-primary)',
                    background: 'var(--surface)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <Button variant="primary" icon="send" loading={sending} disabled={!draft.trim() && !file} onClick={() => void send()}>
                  {editing ? 'ذخیره' : 'ارسال'}
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {groups === null ? <span style={{ color: 'var(--text-muted)' }}>در حال بارگذاری…</span> : <EmptyState icon="users" title="گروهی انتخاب نشده" />}
          </div>
        )}
      </section>
      {editor ? (
        <GroupEditor
          group={editor.group}
          athletes={athletes}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setEditor(null);
            toast(editor.group ? 'گروه ذخیره شد' : 'گروه ساخته شد', saved.name + ' · ' + faDigits(saved.memberCount) + ' عضو');
            setCur(saved.id);
            setThread(true);
            void loadGroups();
          }}
        />
      ) : null}
    </div>
  );
}
