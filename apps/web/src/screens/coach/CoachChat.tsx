// Ported from design handoff: project/C33 Coach Chat.dc.html
import { createRef, Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Icon, IconButton, SearchField, SegmentedControl, Sidebar, Switch, TopBar, ValueDisplay } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { href, param } from '@/lib/nav';
import { api, faError, remote } from '@/data/api';
import type { ChatMessage } from '@/data/remote';
import { sendTyping, subscribeRealtime, type RealtimeEvent } from '@/data/realtime';
import { panelUser } from '@/data/session';
import { faDate, faLastSeen, faTime } from '@/lib/format';
import { toast } from '@/lib/toast';
import { Screen } from '../Screen';
import { CoachGroups } from './CoachGroups';
import { canRecord, clock, VoicePlayer, VoiceRecorder, type Recording } from './Voice';

const faN = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'امروز';
  if (d.toDateString() === y.toDateString()) return 'دیروز';
  return faDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
}

/** API messages → the design's message list (day separators + bubbles). */
function toDesignMsgs(raw: ChatMessage[]) {
  const out: Array<Record<string, unknown>> = [];
  let day = '';
  for (const m of raw) {
    const d = dayLabel(m.createdAt);
    if (d !== day) out.push({ d: (day = d) });
    const name = m.attachment ? decodeURIComponent(m.attachment.split('?')[0].split('/').pop() || 'file') : '';
    out.push({
      id: m.id,
      from: m.sender === 'coach' ? 'c' : 'a',
      t: m.text,
      at: faTime(new Date(m.createdAt)),
      read: !!m.readAt,
      edited: !!m.editedAt,
      deleted: !!m.deleted,
      ...(m.ref ? { ref: { title: m.ref.replace(/^session:/, ''), sub: 'جلسه تمرین' } } : {}),
      ...(m.attachment && m.voiceSec != null ? { voice: { url: m.attachment, sec: m.voiceSec } } : {}),
      ...(m.attachment && m.voiceSec == null ? { file: { name, ext: (name.split('.').pop() || '').toUpperCase().slice(0, 4), url: m.attachment } } : {}),
    });
  }
  return out;
}

/** «ویرایش / حذف» for one of your messages, at the pointer (kept on screen). */
function MessageMenu({ at, onClose }: { at: { x: number; y: number; m: { hasText: boolean; startEdit: () => void; remove: () => void } }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({ left: Math.min(Math.max(8, at.x - el.offsetWidth), window.innerWidth - el.offsetWidth - 8), top: Math.min(at.y, window.innerHeight - el.offsetHeight - 8) });
  }, [at]);
  useEffect(() => {
    const close = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      if (e.type === 'mousedown' && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('resize', close);
    };
  }, [onClose]);
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <div ref={ref} className="bl-menu" role="menu" style={{ position: 'fixed', left: pos.left, top: pos.top, minWidth: 160, zIndex: 80 }}>
      {at.m.hasText ? (
        <button type="button" role="menuitem" className="bl-menu-item" onClick={act(at.m.startEdit)}>
          <Icon name="edit" size={16} />
          ویرایش
        </button>
      ) : null}
      <button type="button" role="menuitem" className="bl-menu-item is-destructive" onClick={act(at.m.remove)}>
        <Icon name="trash" size={16} />
        حذف برای هر دو طرف
      </button>
    </div>
  );
}

export default class CoachChat extends Screen {
  private unsub?: () => void;
  private typingTimer?: ReturnType<typeof setTimeout>;
  private lastTyping = 0;

  constructor(p) {
    super(p);
    // `thread`: on a phone only one pane shows — the list, or the open conversation (`?a=` opens it).
    this.state = {
      T: [],
      cur: null,
      q: '',
      filter: 'all',
      draft: '',
      attach: null,
      quiet: true,
      typing: false,
      loading: true,
      thread: !!param('a'),
      mode: param('tab') === 'groups' ? 'groups' : 'direct',
    };
  }
  async componentDidMount() {
    try {
      const [athletes, threads, profile] = await Promise.all([api.athletes.list(), remote.threads(), remote.coachProfile()]);
      const byId = new Map(threads.map((t) => [String(t.athleteId), t]));
      const T = athletes
        .filter((a) => a.userId || byId.has(a.id))
        .map((a) => {
          const th = byId.get(a.id);
          return {
            id: a.id,
            name: a.name,
            online: false,
            last: a.lastActiveAt ? faLastSeen(a.lastActiveAt) : 'ثبت نشده',
            today: a.programName ? a.programName : 'بدون برنامه',
            program: a.programName ? a.programName + (a.programWeek ? ' · هفته ' + faN(a.programWeek) : '') : 'برنامه‌ای اختصاص داده نشده',
            adh: a.stats?.adherencePct != null ? faN(a.stats.adherencePct) : 'ثبت نشده',
            check: '—',
            unread: th?.unread || 0,
            lastAt: th?.lastAt || '',
            loaded: false,
            raw: [] as ChatMessage[],
            msgs: th ? [{ d: dayLabel(th.lastAt) }, { from: th.lastSender === 'coach' ? 'c' : 'a', t: th.lastText, at: faTime(new Date(th.lastAt)) }] : [],
          };
        })
        .sort((x, y) => (y.lastAt || '').localeCompare(x.lastAt || ''));
      const want = param('a');
      const cur = T.find((t) => t.id === want) ? want : (T[0]?.id ?? null);
      this.setState({ T, cur, quiet: profile.quietHours, loading: false });
      if (cur) await this.openThread(cur);
      this.unsub = subscribeRealtime(this.onEvent);
    } catch (e) {
      this.setState({ loading: false });
      toast('گفتگوها بارگذاری نشد', faError(e), 'error');
    }
  }

  componentWillUnmount() {
    this.unsub?.();
    clearTimeout(this.typingTimer);
  }

  // The message list follows the conversation (#72): opening a thread shows its newest message, and a new
  // message, the typing note or a late-loading image keeps it at the bottom unless the coach scrolled up.
  private scroller = createRef<HTMLDivElement>();
  private atBottom = true;
  private bottomKey() {
    const t = this.state.T.find((x) => x.id === this.state.cur);
    const last = t?.raw[t.raw.length - 1];
    return [this.state.cur, t?.loaded, t?.msgs.length, last?.id, last?.sender, this.state.typing, this.state.thread].join('|');
  }
  private toBottom = () => {
    const el = this.scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  private onScroll = () => {
    const el = this.scroller.current;
    if (el) this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  private lastKey = '';
  componentDidUpdate(_p, prev) {
    const key = this.bottomKey();
    if (key === this.lastKey) return;
    this.lastKey = key;
    const t = this.state.T.find((x) => x.id === this.state.cur);
    const last = t?.raw[t.raw.length - 1];
    const opened = prev.cur !== this.state.cur || prev.thread !== this.state.thread || !prev.T.find((x) => x.id === this.state.cur)?.loaded;
    // A thread just opened or loaded, the coach's own message, or they were reading the bottom anyway.
    if (opened || last?.sender === 'coach' || this.atBottom) {
      this.atBottom = true;
      this.toBottom();
    }
  }

  private patchThread(id: string, fn: (t) => Record<string, unknown>) {
    this.setState((s) => ({ T: s.T.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)) }));
  }

  private setRaw(id: string, raw: ChatMessage[]) {
    this.patchThread(id, () => ({ raw, msgs: toDesignMsgs(raw), loaded: true, lastAt: raw.length ? raw[raw.length - 1].createdAt : '' }));
  }

  async openThread(id: string) {
    this.setState({ cur: id, draft: '', attach: null, typing: false, editing: null });
    this.patchThread(id, () => ({ unread: 0 }));
    const raw = await remote.messages(id);
    this.setRaw(id, raw);
    if (raw.some((m) => m.sender === 'athlete' && !m.readAt)) void remote.markRead(id);
  }

  onEvent = (e: RealtimeEvent) => {
    if (e.type === 'group') return; // CoachGroups handles those
    const id = String(e.type === 'message' || e.type === 'update' ? e.message.athleteId : e.athleteId);
    const t = this.state.T.find((x) => x.id === id);
    if (!t) return;
    if (e.type === 'typing') {
      if (id !== this.state.cur || e.sender !== 'athlete') return;
      this.setState({ typing: true });
      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => this.setState({ typing: false }), 4000);
      return;
    }
    if (e.type === 'read') {
      if (e.reader === 'athlete')
        this.setRaw(
          id,
          t.raw.map((m) => (m.sender === 'coach' && !m.readAt ? { ...m, readAt: e.at } : m)),
        );
      return;
    }
    const m = e.message as unknown as ChatMessage;
    if (e.type === 'update') {
      if (t.loaded)
        this.setRaw(
          id,
          t.raw.map((x) => (x.id === m.id ? m : x)),
        );
      return;
    }
    if (t.raw.some((x) => x.id === m.id)) return;
    const raw = t.loaded ? [...t.raw, m] : [m];
    this.setRaw(id, raw);
    if (m.sender === 'athlete') {
      this.setState({ typing: false });
      if (id === this.state.cur && document.visibilityState === 'visible') void remote.markRead(id);
      else this.patchThread(id, (x) => ({ unread: (x.unread || 0) + 1 }));
    }
    // newest conversation first
    this.setState((s) => ({ T: [s.T.find((x) => x.id === id), ...s.T.filter((x) => x.id !== id)] }));
  };

  /** Replace one message in the open thread (after an edit or delete). */
  private replaceMsg(m: ChatMessage) {
    const id = String(m.athleteId);
    const t = this.state.T.find((x) => x.id === id);
    if (t)
      this.setRaw(
        id,
        t.raw.map((x) => (x.id === m.id ? m : x)),
      );
  }

  /** Your own message: right-click (desktop) or long-press (phone) opens «ویرایش / حذف». */
  private pressTimer?: ReturnType<typeof setTimeout>;
  openMenu = (e: { preventDefault(): void; clientX: number; clientY: number }, m) => {
    e.preventDefault();
    this.setState({ msgMenu: { x: e.clientX, y: e.clientY, m } });
  };
  pressStart = (e: React.TouchEvent, m) => {
    const t = e.touches[0];
    const at = { clientX: t.clientX, clientY: t.clientY, preventDefault() {} };
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      navigator.vibrate?.(15);
      this.openMenu(at, m);
    }, 450);
  };
  pressEnd = () => clearTimeout(this.pressTimer);

  async deleteMsg(mid: number) {
    if (!window.confirm('این پیام برای هر دو طرف حذف شود؟')) return;
    try {
      this.replaceMsg(await remote.deleteMessage(mid));
    } catch (e) {
      toast('حذف نشد', faError(e), 'error');
    }
  }

  async sendVoice(r: Recording) {
    const { cur } = this.state;
    this.setState({ recording: false });
    if (!cur) return;
    try {
      const m = await remote.sendMessage(cur, '', { voice: r });
      const latest = this.state.T.find((x) => x.id === cur);
      if (latest && !latest.raw.some((x) => x.id === m.id)) this.setRaw(cur, [...latest.raw, m]);
    } catch (e) {
      toast('پیام صوتی ارسال نشد', faError(e), 'error');
    }
  }

  async sendLive() {
    const { cur, draft, attach, T, editing } = this.state;
    const txt = draft.trim();
    if (editing) {
      if (!txt) return;
      try {
        if (txt !== editing.before) this.replaceMsg(await remote.editMessage(editing.id, txt));
        this.setState({ editing: null, draft: '' });
      } catch (e) {
        toast('ویرایش نشد', faError(e), 'error');
      }
      return;
    }
    if (!cur || (!txt && !attach)) return;
    this.setState({ draft: '', attach: null });
    try {
      const m = await remote.sendMessage(cur, txt, { file: attach?.file?.blob, ref: attach?.ref ? 'session:' + attach.ref.title : '' });
      const t = T.find((x) => x.id === cur);
      const latest = this.state.T.find((x) => x.id === cur) ?? t;
      if (!latest.raw.some((x) => x.id === m.id)) this.setRaw(cur, [...latest.raw, m]);
    } catch (e) {
      this.setState({ draft: txt, attach });
      toast('پیام ارسال نشد', faError(e), 'error');
    }
  }

  renderVals() {
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const { T, cur, q, filter, draft, attach, quiet, typing } = this.state;
    const c = T.find((t) => t.id === cur) || {
      id: null,
      name: this.state.loading ? '…' : 'گفتگویی نیست',
      msgs: [],
      today: '—',
      program: '—',
      adh: '—',
      check: '—',
      last: '',
      online: false,
      unread: 0,
    };
    const ini = (n) =>
      n
        .split(' ')
        .map((w) => w[0])
        .join(' ');
    const lastMsg = (t) => [...t.msgs].reverse().find((m) => !m.d) || {};
    const hr = new Date().getHours();
    const shown = T.filter(
      (t) => (!q.trim() || t.name.includes(q.trim())) && (filter === 'all' || (filter === 'unread' && t.unread > 0) || (filter === 'wait' && lastMsg(t).from === 'a')),
    );
    const send = () => {
      void this.sendLive();
    };
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: ['گفتگو', c.name],
      unreadTotal: T.reduce((a, t) => a + t.unread, 0) ? fa(T.reduce((a, t) => a + t.unread, 0)) + ' خوانده‌نشده' : 'همه خوانده شده',
      setQ: (v) => this.setState({ q: v }),
      filterOpts: [
        { value: 'all', label: 'همه' },
        { value: 'unread', label: 'خوانده‌نشده' },
        { value: 'wait', label: 'منتظر پاسخ' },
      ],
      filter,
      setFilter: (v) => this.setState({ filter: v }),
      noThreads: shown.length === 0,
      threads: shown.map((t) => {
        const l = lastMsg(t);
        return {
          name: t.name,
          ini: ini(t.name),
          time: l.at || '',
          preview:
            (l.from === 'c' ? 'شما: ' : '') +
            (l.deleted ? 'پیام حذف شد' : l.t || (l.voice ? '🎤 پیام صوتی ' + clock(l.voice.sec) : l.file ? 'فایل: ' + l.file.name : l.ref ? 'جلسه: ' + l.ref.title : '')),
          hasUnread: t.unread > 0,
          unread: fa(t.unread),
          weight: t.unread ? '700' : '500',
          prevColor: t.unread ? 'var(--text-primary)' : 'var(--text-muted)',
          dot: t.online ? 'var(--success, #2e7d32)' : 'var(--border)',
          bg: t.id === cur ? 'var(--brand-primary-subtle)' : 'transparent',
          open: () => {
            this.setState({ thread: true });
            void this.openThread(t.id);
          },
        };
      }),
      cur: { id: c.id, name: c.name, ini: ini(c.name), status: c.online ? 'آنلاین' : 'آخرین بازدید ' + c.last, today: c.today, program: c.program, adh: c.adh, check: c.check },
      quietNow: quiet && (hr >= 22 || hr < 7),
      quietNote: 'ساعات سکوت فعال است؛ ' + c.name.split(' ')[0] + ' تا ساعت ۷ صبح اعلان نمی‌گیرد.',
      msgs: c.msgs.map((m) =>
        m.d
          ? { isDay: true, isMsg: false, text: m.d }
          : {
              isDay: false,
              isMsg: true,
              text: m.t,
              hasText: !!m.t,
              deleted: !!m.deleted,
              mine: m.from === 'c' && !!m.id && !m.deleted,
              startEdit: () => this.setState({ editing: { id: m.id, before: m.t }, draft: m.t, attach: null }),
              remove: () => void this.deleteMsg(m.id),
              align: m.from === 'c' ? 'flex-start' : 'flex-end',
              bg: m.from === 'c' ? 'var(--brand-primary-subtle)' : 'var(--surface)',
              border: m.from === 'c' ? '1px solid transparent' : '1px solid var(--border)',
              radius: m.from === 'c' ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
              meta: (m.from === 'c' ? 'شما · ' : '') + m.at + (m.edited && !m.deleted ? ' · ویرایش شد' : '') + (m.from === 'c' ? (m.read ? ' · خوانده شد' : ' · ارسال شد') : ''),
              hasRef: !!m.ref,
              refTitle: m.ref ? m.ref.title : '',
              refSub: m.ref ? m.ref.sub : '',
              refHref: href('coach:history') + (cur ? '?id=' + cur : ''),
              hasFile: !!m.file,
              fileName: m.file ? m.file.name : '',
              fileExt: m.file ? m.file.ext : '',
              fileUrl: m.file?.url,
              isImage: !!m.file?.url && /^(JPG|JPEG|PNG|WEBP|GIF)$/.test(m.file.ext),
              isVideo: !!m.file?.url && /^(MP4|MOV|WEBM|M4V)$/.test(m.file.ext),
              voiceUrl: m.voice?.url,
              voiceSec: m.voice?.sec,
            },
      ),
      typing,
      typingLabel: c.name.split(' ')[0] + ' در حال نوشتن…',
      editingLabel: this.state.editing ? 'ویرایش پیام: ' + this.state.editing.before : '',
      cancelEdit: () => this.setState({ editing: null, draft: '' }),
      hasAttach: !!attach,
      attachLabel: attach
        ? attach.file
          ? (/^(MP4|MOV|WEBM|M4V)$/.test(attach.file.ext) ? 'ویدیو: ' : 'فایل: ') + attach.file.name
          : 'جلسه: ' + attach.ref.title + ' · ' + attach.ref.sub
        : '',
      clearAttach: () => this.setState({ attach: null }),
      pickFile: (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        // Videos up to 200 MB (#82); everything else up to 20 MB (the server's limits).
        const video = f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(f.name);
        if (f.size > (video ? 200 : 20) * 1024 * 1024) {
          e.target.value = '';
          return toast('فایل بزرگ است', video ? 'حداکثر حجم ویدیو ۲۰۰ مگابایت است.' : 'حداکثر حجم فایل ۲۰ مگابایت است.', 'error');
        }
        this.setState({ attach: { file: { name: f.name, ext: (f.name.split('.').pop() || '').toUpperCase().slice(0, 4), blob: f } } });
        e.target.value = '';
      },
      attachWorkout: () => this.setState({ attach: { ref: { title: c.today.split(' · ')[0], sub: 'امروز · ' + c.program.split(' · ')[0] } } }),
      quick: [{ label: 'عالی بود 👏' }, { label: 'امروز تمرین یادت نره' }, { label: 'چک‌این صبح رو پر کن' }].map((x) => ({
        label: x.label,
        use: () => this.setState({ draft: (draft ? draft + ' ' : '') + x.label }),
      })),
      draft,
      setDraft: (e) => {
        this.setState({ draft: e.target.value });
        if (cur && Date.now() - this.lastTyping > 3000) {
          this.lastTyping = Date.now();
          sendTyping(Number(cur));
        }
      },
      onKey: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      },
      placeholder: 'پیام به ' + c.name + '…',
      cantSend: !draft.trim() && !attach,
      recording: !!this.state.recording,
      startVoice: () => {
        if (!canRecord()) {
          toast('ضبط صدا پشتیبانی نمی‌شود', 'این مرورگر ضبط صدا ندارد یا صفحه روی https باز نشده است.', 'error');
          return;
        }
        this.setState({ recording: true, editing: null, attach: null });
      },
      stopVoice: () => this.setState({ recording: false }),
      sendVoice: (r: Recording) => void this.sendVoice(r),
      send,
      quiet,
      setQuiet: (v) => {
        this.setState({ quiet: v });
        remote.saveCoachProfile({ quietHours: v }).catch((e) => toast('ذخیره نشد', faError(e), 'error'));
      },
    };
  }

  /** «گفتگوها | گروه‌ها» (#81): one-to-one chats or the coach's broadcast groups. */
  modeSwitch() {
    return (
      <SegmentedControl
        options={[
          { value: 'direct', label: 'گفتگوها' },
          { value: 'groups', label: 'گروه‌ها' },
        ]}
        value={this.state.mode}
        size="sm"
        fullWidth
        label="نوع گفتگو"
        onChange={(mode) => this.setState({ mode })}
      />
    );
  }

  render() {
    const v = this.vals();
    if (this.state.mode === 'groups')
      return (
        <PanelLayout
          theme={v.brand}
          fullHeight
          sidebar={<Sidebar app="coach" active="chat" brandSub="فضای کاری مربی" user={v.user} />}
          topBar={<TopBar breadcrumbs={['گفتگو', 'گروه‌ها']} unread search />}
        >
          <CoachGroups modeSwitch={this.modeSwitch()} />
        </PanelLayout>
      );
    return (
      <PanelLayout
        theme={v.brand}
        fullHeight
        overlays={this.state.msgMenu ? <MessageMenu at={this.state.msgMenu} onClose={() => this.setState({ msgMenu: null })} /> : null}
        sidebar={<Sidebar app="coach" active="chat" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
      >
        <div className={'bl-chat ' + (this.state.thread ? 'is-thread' : 'is-list')} style={{ flex: '1 1 0', minHeight: '0', display: 'flex' }}>
          <aside
            className="bl-chat-list"
            style={{
              width: '320px',
              flexShrink: '0',
              borderLeft: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '0',
            }}
          >
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: '0', fontSize: '18px', lineHeight: '26px', fontWeight: '600', flex: '1' }}>گفتگو</h2>
                <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.unreadTotal}</span>
              </div>
              {this.modeSwitch()}
              <SearchField placeholder="جستجوی ورزشکار" size="sm" onChange={v.setQ} />
              <SegmentedControl options={v.filterOpts} value={v.filter} size="sm" fullWidth label="فیلتر" onChange={v.setFilter} />
            </div>
            <div style={{ flex: '1 1 0', minHeight: '0', overflowY: 'auto' }}>
              {(v.threads || []).map((t: any, $index: number) => (
                <Fragment key={$index}>
                  <button
                    className="hv-sunken"
                    type="button"
                    onClick={t?.open}
                    style={{
                      width: '100%',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      padding: '12px 16px',
                      border: '0',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: t?.bg,
                      cursor: 'pointer',
                      textAlign: 'right',
                      fontFamily: "'Vazirmatn',sans-serif",
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span
                      style={{
                        position: 'relative',
                        width: '40px',
                        height: '40px',
                        flexShrink: '0',
                        borderRadius: '50%',
                        background: 'var(--brand-primary-subtle)',
                        color: 'var(--brand-primary-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        font: "600 14px/1 'Vazirmatn',sans-serif",
                      }}
                    >
                      {t?.ini}
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '0',
                          left: '0',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          border: '2px solid var(--surface)',
                          background: t?.dot,
                        }}
                      ></span>
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '14px',
                            lineHeight: '22px',
                            fontWeight: t?.weight,
                            flex: '1',
                            minWidth: '0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t?.name}
                        </span>
                        <span style={{ fontSize: '11px', lineHeight: '16px', color: 'var(--text-muted)', flexShrink: '0' }}>{t?.time}</span>
                      </span>
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            lineHeight: '18px',
                            color: t?.prevColor,
                            flex: '1',
                            minWidth: '0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t?.preview}
                        </span>
                        {t?.hasUnread ? (
                          <>
                            <span
                              style={{
                                minWidth: '18px',
                                height: '18px',
                                padding: '0 5px',
                                borderRadius: '9px',
                                background: 'var(--brand-primary)',
                                color: '#1a1a1a',
                                font: "600 11px/18px 'Vazirmatn',sans-serif",
                                textAlign: 'center',
                                flexShrink: '0',
                              }}
                            >
                              {t?.unread}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </Fragment>
              ))}
              {v.noThreads ? (
                <>
                  <p style={{ margin: '0', padding: '24px 16px', fontSize: '13px', lineHeight: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>گفتگویی یافت نشد.</p>
                </>
              ) : null}
            </div>
          </aside>
          <section className="bl-chat-thread" style={{ flex: '1 1 0', minWidth: '0', display: 'flex', flexDirection: 'column', minHeight: '0', background: 'var(--background)' }}>
            <header
              className="bl-chat-head"
              style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <span className="bl-chat-back">
                <IconButton icon="arrow-right" label="همه گفتگوها" size="sm" onClick={() => this.setState({ thread: false })} />
              </span>
              <span
                style={{
                  width: '40px',
                  height: '40px',
                  flexShrink: '0',
                  borderRadius: '50%',
                  background: 'var(--brand-primary-subtle)',
                  color: 'var(--brand-primary-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: "600 14px/1 'Vazirmatn',sans-serif",
                }}
              >
                {v.cur?.ini}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0', flex: '1' }}>
                <span style={{ fontSize: '15px', lineHeight: '22px', fontWeight: '600' }}>{v.cur?.name}</span>
                <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.cur?.status}</span>
              </div>
              <Button variant="ghost" size="sm" icon="user" to={v.cur?.id ? 'coach:athlete?id=' + v.cur.id : 'coach:athlete'}>
                پروفایل
              </Button>
              <span className="bl-chat-hist">
                <Button variant="ghost" size="sm" icon="calendar" to={v.cur?.id ? 'coach:history?id=' + v.cur.id : 'coach:history'}>
                  سابقه تمرین
                </Button>
              </span>
            </header>
            {v.quietNow ? (
              <>
                <div
                  style={{
                    padding: '8px 20px',
                    background: 'var(--warning-subtle, #fff4e0)',
                    fontSize: '12px',
                    lineHeight: '18px',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  {v.quietNote}
                </div>
              </>
            ) : null}
            <div
              ref={this.scroller}
              onScroll={this.onScroll}
              onLoadCapture={() => this.atBottom && this.toBottom()}
              style={{ flex: '1 1 0', minHeight: '0', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              {(v.msgs || []).map((m: any, $index: number) => (
                <Fragment key={$index}>
                  {m?.isDay ? (
                    <>
                      <div
                        style={{
                          alignSelf: 'center',
                          fontSize: '11px',
                          lineHeight: '16px',
                          color: 'var(--text-muted)',
                          background: 'var(--surface-sunken)',
                          padding: '2px 10px',
                          borderRadius: '10px',
                        }}
                      >
                        {m?.text}
                      </div>
                    </>
                  ) : null}
                  {m?.isMsg ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: m?.align, gap: '4px', maxWidth: '100%' }}>
                        <div
                          className={m?.mine ? 'bl-msg-own' : undefined}
                          title={m?.mine ? 'برای ویرایش یا حذف کلیک راست کنید (روی گوشی: نگه دارید)' : undefined}
                          onContextMenu={m?.mine ? (e) => this.openMenu(e, m) : undefined}
                          onTouchStart={m?.mine ? (e) => this.pressStart(e, m) : undefined}
                          onTouchEnd={m?.mine ? this.pressEnd : undefined}
                          onTouchMove={m?.mine ? this.pressEnd : undefined}
                          style={{
                            maxWidth: '520px',
                            padding: '10px 14px',
                            borderRadius: m?.radius,
                            background: m?.bg,
                            color: 'var(--text-primary)',
                            border: m?.border,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          {m?.hasRef ? (
                            <>
                              <a
                                href={m?.refHref}
                                style={{
                                  display: 'flex',
                                  gap: '8px',
                                  alignItems: 'center',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                }}
                              >
                                <span
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    flexShrink: '0',
                                    borderRadius: '6px',
                                    background: 'var(--brand-primary-subtle)',
                                    color: 'var(--brand-primary-text)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Icon name="dumbbell" size="16" />
                                </span>
                                <span style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                                  <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '600' }}>{m?.refTitle}</span>
                                  <span style={{ fontSize: '11px', lineHeight: '16px', color: 'var(--text-muted)' }}>{m?.refSub}</span>
                                </span>
                              </a>
                            </>
                          ) : null}
                          {m?.voiceUrl ? <VoicePlayer src={m.voiceUrl} sec={m.voiceSec} /> : null}
                          {m?.isImage ? (
                            <a href={m.fileUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                              <img src={m.fileUrl} alt={m.fileName} style={{ display: 'block', maxWidth: 260, maxHeight: 260, borderRadius: 8, objectFit: 'cover' }} />
                            </a>
                          ) : null}
                          {m?.isVideo ? (
                            // Loads only the first frame until played; plays inline with controls (#82).
                            <video
                              src={m.fileUrl}
                              controls
                              preload="metadata"
                              playsInline
                              style={{ display: 'block', width: 280, maxWidth: '100%', maxHeight: 360, borderRadius: 8, background: '#000' }}
                            />
                          ) : null}
                          {m?.hasFile && !m?.isImage && !m?.isVideo ? (
                            <>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '8px',
                                  alignItems: 'center',
                                  padding: '8px 10px',
                                  borderRadius: '8px',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                <span
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    flexShrink: '0',
                                    borderRadius: '6px',
                                    background: 'var(--surface-sunken)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    font: "600 9px/1 'IBM Plex Mono',monospace",
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  {m?.fileExt}
                                </span>
                                <span
                                  style={{
                                    fontSize: '13px',
                                    lineHeight: '20px',
                                    fontWeight: '500',
                                    minWidth: '0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {m?.fileUrl ? (
                                    <a href={m.fileUrl} target="_blank" rel="noreferrer">
                                      {m?.fileName}
                                    </a>
                                  ) : (
                                    m?.fileName
                                  )}
                                </span>
                              </div>
                            </>
                          ) : null}
                          {m?.hasText ? (
                            <>
                              <span style={{ fontSize: '14px', lineHeight: '24px', whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>{m?.text}</span>
                            </>
                          ) : null}
                          {m?.deleted ? <span style={{ fontSize: 13, lineHeight: '22px', color: 'var(--text-muted)', fontStyle: 'italic' }}>این پیام حذف شد</span> : null}
                        </div>
                        <span style={{ fontSize: '11px', lineHeight: '16px', color: 'var(--text-muted)', padding: '0 4px' }}>{m?.meta}</span>
                      </div>
                    </>
                  ) : null}
                </Fragment>
              ))}
              {v.typing ? (
                <>
                  <span style={{ alignSelf: 'flex-end', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)', padding: '0 4px' }}>{v.typingLabel}</span>
                </>
              ) : null}
            </div>
            <footer style={{ padding: '12px 20px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {v.editingLabel ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', minWidth: 0 }}>
                  <Icon name="edit" size={14} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.editingLabel}</span>
                  <button type="button" className="bl-msg-act" onClick={v.cancelEdit}>
                    لغو
                  </button>
                </div>
              ) : null}
              {v.hasAttach ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: 'var(--surface-sunken)',
                      alignSelf: 'flex-start',
                      maxWidth: '100%',
                    }}
                  >
                    <span style={{ fontSize: '12px', lineHeight: '18px', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.attachLabel}</span>
                    <button
                      type="button"
                      onClick={v.clearAttach}
                      title="حذف"
                      style={{ border: '0', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
                    >
                      ×
                    </button>
                  </div>
                </>
              ) : null}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(v.quick || []).map((q: any, $index: number) => (
                  <Fragment key={$index}>
                    <button
                      className="hv-border-brand-text"
                      type="button"
                      onClick={q?.use}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        border: '1px solid var(--border)',
                        borderRadius: '14px',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        font: "500 12px/1 'Vazirmatn',sans-serif",
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {q?.label}
                    </button>
                  </Fragment>
                ))}
              </div>
              {v.recording ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <VoiceRecorder onSend={v.sendVoice} onCancel={v.stopVoice} />
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <label
                    className="hv-border-brand"
                    title="پیوست عکس، ویدیو یا فایل"
                    style={{
                      width: '40px',
                      height: '40px',
                      flexShrink: '0',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      fontSize: '18px',
                    }}
                  >
                    <input type="file" accept="image/*,video/*,.pdf" onChange={v.pickFile} style={{ display: 'none' }} />
                    <Icon name="image" size="18" />
                  </label>
                  <IconButton icon="dumbbell" label="پیوست جلسه تمرین" variant="secondary" onClick={v.attachWorkout} />
                  <textarea
                    className="fc-ring"
                    value={v.draft}
                    onChange={v.setDraft}
                    onKeyDown={v.onKey}
                    rows={1}
                    placeholder={v.placeholder}
                    style={{
                      flex: '1',
                      minWidth: '0',
                      minHeight: '40px',
                      maxHeight: '120px',
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
                  ></textarea>
                  {v.cantSend ? (
                    <IconButton icon="mic" label="ضبط پیام صوتی" variant="primary" onClick={v.startVoice} />
                  ) : (
                    <Button variant="primary" icon="send" onClick={v.send}>
                      ارسال
                    </Button>
                  )}
                </div>
              )}
              <span style={{ fontSize: '11px', lineHeight: '16px', color: 'var(--text-muted)' }}>Enter برای ارسال · Shift+Enter برای خط جدید · 🎤 برای پیام صوتی</span>
            </footer>
          </section>
          <aside
            className="bl-chat-info"
            style={{
              width: '280px',
              flexShrink: '0',
              borderRight: '1px solid var(--border)',
              background: 'var(--surface)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '600' }}>امروز</span>
              <span style={{ fontSize: '14px', lineHeight: '22px' }}>{v.cur?.today}</span>
              <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.cur?.program}</span>
            </div>
            <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <ValueDisplay label="پایبندی ۳۰ روز" value={v.cur?.adh} unit="٪" layout="row" />
              <ValueDisplay label="آخرین چک‌این" value={v.cur?.check} layout="row" />
            </div>
            <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '13px', lineHeight: '20px', fontWeight: '600' }}>ساعات سکوت</span>
              <Switch label="ارسال نکردن اعلان ۲۲ تا ۷" description="پیام‌ها ارسال می‌شوند ولی ورزشکار تا صبح اعلان نمی‌گیرد." checked={v.quiet} onChange={v.setQuiet} />
            </div>
          </aside>
        </div>
      </PanelLayout>
    );
  }
}
