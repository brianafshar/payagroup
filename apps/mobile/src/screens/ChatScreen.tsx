// Design: project/M47 Athlete Chat.dc.html
import { faDigits, faTime } from '@baseline/core';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { LIVE } from '../api/config';
import { sendTyping } from '../api/realtime';
import { ATHLETE, chat, profile, type ChatItem } from '../data/athlete';
import { chatMeta, deleteChat, editChat, groups, markChatRead, sendChat, sendVoice } from '../data/live';
import { useNav } from '../navigation/types';
import { fontFamily, useTheme } from '../theme';
import { Button, Icon, IconButton, KEYBOARD_BEHAVIOR, MAX_FONT_SCALE, MobileHeader, Modal, toast, Txt, useBottomInset, useKeyboardOpen, VideoPlayer } from '../ui';
import { VoiceBubble, VoiceRecorder, type Recording } from './ChatVoice';

/** Chat attachments are served under their original extension (#82). */
const isVideo = (url: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);

export function ChatScreen() {
  const nav = useNav();
  const { c } = useTheme();
  const bottom = useBottomInset(10);
  const { msgs } = chat.use();
  profile.use(); // coach name (ATHLETE) in live mode
  const myGroups = groups.use().list;
  const [draft, setDraft] = useState('');
  const [attach, setAttach] = useState<string | null>(null);
  const asset = useRef<ImagePicker.ImagePickerAsset | null>(null);
  const [mockTyping, setTyping] = useState(false);
  const meta = chatMeta.use();
  const typing = LIVE ? meta.typing : mockTyping;
  const [sending, setSending] = useState(false);
  // Long-press one of your messages → edit or delete it for both sides (#59).
  const [menu, setMenu] = useState<{ id: number; t: string } | null>(null);
  const [editing, setEditing] = useState<{ id: number; before: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const keyboard = useKeyboardOpen();
  useEffect(() => {
    if (keyboard) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [keyboard]);
  // Live: opening the chat (and each new coach message while open) marks the thread read.
  useEffect(() => {
    void markChatRead();
  }, [msgs.length]);
  const lastMine = LIVE ? msgs.reduce((k, m, i) => ('from' in m && m.from === 'a' ? i : k), -1) : -1;
  const scroll = useRef<ScrollView>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = async () => {
    const t = draft.trim();
    if (editing) {
      if (!t) return;
      setSending(true);
      const ok = t === editing.before || (await editChat(editing.id, t));
      setSending(false);
      if (!ok) return;
      setEditing(null);
      setDraft('');
      return;
    }
    if (!t && !attach) return;
    if (LIVE) {
      setSending(true);
      const ok = await sendChat(t, asset.current ? { image: asset.current } : {});
      setSending(false);
      if (!ok) return;
      setDraft('');
      setAttach(null);
      asset.current = null;
      return;
    }
    const m: ChatItem = { from: 'a', t, at: faTime(new Date()), ...(attach ? { file: attach } : {}) };
    chat.set((s) => ({ msgs: [...s.msgs, ...(s.msgs.some((x) => 'd' in x && x.d === 'امروز') ? [] : [{ d: 'امروز' }]), m] }));
    setDraft('');
    setAttach(null);
    // TODO(backend): real messaging; the mock coach acknowledges after a moment.
    timers.current.push(setTimeout(() => setTyping(true), 1000));
    timers.current.push(
      setTimeout(() => {
        setTyping(false);
        chat.set((s) => ({ msgs: [...s.msgs, { from: 'c', t: 'دریافت شد 👍 بعد از تمرین جزئیاتش رو بررسی می‌کنم.', at: faTime(new Date()) }] }));
      }, 2800),
    );
  };
  const sendRecording = async (r: Recording) => {
    setRecording(false);
    if (LIVE) {
      setSending(true);
      await sendVoice(r);
      setSending(false);
      return;
    }
    const m: ChatItem = { from: 'a', t: '', at: faTime(new Date()), voice: { uri: r.uri, sec: r.sec } };
    chat.set((s) => ({ msgs: [...s.msgs, ...(s.msgs.some((x) => 'd' in x && x.d === 'امروز') ? [] : [{ d: 'امروز' }]), m] }));
  };
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    const video = a.type === 'video';
    // #82: same limits as the server (core/uploads.py) — 200 MB for video, 20 MB otherwise.
    if (a.fileSize && a.fileSize > (video ? 200 : 20) * 1024 * 1024)
      return toast('فایل بزرگ است', video ? 'حداکثر حجم ویدیو ۲۰۰ مگابایت است.' : 'حداکثر حجم فایل ۲۰ مگابایت است.', 'error');
    asset.current = a;
    setAttach((video ? 'ویدیو: ' : 'عکس: ') + (a.fileName ?? (video ? 'ویدیو' : 'عکس')));
  };

  return (
    <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1, backgroundColor: c.background }}>
      <MobileHeader title={'مربی · ' + ATHLETE.coach} back="خانه" onBack={() => nav.goBack()} />
      <View style={{ paddingVertical: 6, paddingHorizontal: 16, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c['border-subtle'] }}>
        <Txt size={12} lh={18} color="text-muted">
          معمولاً ظرف چند ساعت پاسخ می‌دهد · ساعات سکوت ۲۲ تا ۷
        </Txt>
      </View>
      {myGroups.length ? (
        // The coach's broadcast groups we're in (#81) — read only, one tap away.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c['border-subtle'] }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
        >
          {myGroups.map((g) => (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={'گروه ' + g.name + (g.unread ? '، ' + faDigits(g.unread) + ' پیام جدید' : '')}
              onPress={() => nav.navigate('Group', { id: g.id })}
              style={{
                flexDirection: 'row',
                gap: 6,
                alignItems: 'center',
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: g.unread ? c['brand-primary-subtle'] : c['surface-sunken'],
              }}
            >
              <Icon name="users" size={14} color={g.unread ? 'brand-primary-text' : 'text-secondary'} />
              <Txt size={13} lh={20} w={g.unread ? 700 : 500} numberOfLines={1}>
                {g.name}
              </Txt>
              {g.unread ? (
                <View
                  style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: c['brand-primary'], alignItems: 'center', justifyContent: 'center' }}
                >
                  <Txt size={11} lh={16} w={700} color={c['text-inverse']}>
                    {faDigits(g.unread)}
                  </Txt>
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 16, gap: 10 }}
      >
        {msgs.map((m, i) =>
          'd' in m ? (
            <View key={i} style={{ alignSelf: 'center', backgroundColor: c['surface-sunken'], paddingVertical: 2, paddingHorizontal: 10, borderRadius: 10 }}>
              <Txt size={11} lh={16} color="text-muted">
                {m.d}
              </Txt>
            </View>
          ) : (
            <Pressable
              key={i}
              disabled={!LIVE || m.from !== 'a' || !m.id || m.deleted}
              onLongPress={() => m.id && setMenu({ id: m.id, t: m.t })}
              delayLongPress={350}
              accessibilityHint={m.from === 'a' && !m.deleted ? 'برای ویرایش یا حذف نگه دارید' : undefined}
              style={{ alignItems: m.from === 'a' ? 'flex-start' : 'flex-end', gap: 3 }}
            >
              <View
                style={{
                  maxWidth: 280,
                  paddingVertical: 9,
                  paddingHorizontal: 13,
                  gap: 6,
                  backgroundColor: m.from === 'a' ? c['brand-primary-subtle'] : c.surface,
                  borderWidth: 1,
                  borderColor: m.from === 'a' ? 'transparent' : c.border,
                  borderTopStartRadius: 14,
                  borderTopEndRadius: 14,
                  borderBottomStartRadius: m.from === 'a' ? 14 : 4,
                  borderBottomEndRadius: m.from === 'a' ? 4 : 14,
                }}
              >
                {m.deleted ? (
                  <Txt size={13} lh={22} color="text-muted" style={{ fontStyle: 'italic' }}>
                    این پیام حذف شد
                  </Txt>
                ) : null}
                {m.ref ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => nav.navigate('Tabs', { screen: 'Workout' })}
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      alignItems: 'center',
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: c['border-subtle'],
                    }}
                  >
                    <Icon name="dumbbell" size={16} />
                    <Txt size={12} lh={18} w={600}>
                      {m.ref}
                    </Txt>
                  </Pressable>
                ) : null}
                {m.file && isVideo(m.file) && /^(https?|blob|file):/.test(m.file) ? (
                  <View style={{ width: 240, maxWidth: '100%' }}>
                    <VideoPlayer title="ویدیو" src={m.file} />
                  </View>
                ) : m.file && /^(https?|blob|file):/.test(m.file) ? (
                  <Pressable accessibilityRole="imagebutton" accessibilityLabel="باز کردن پیوست" onPress={() => void Linking.openURL(m.file as string)}>
                    <Image source={{ uri: m.file }} style={{ width: 200, height: 150, borderRadius: 8, backgroundColor: c['surface-sunken'] }} resizeMode="cover" />
                  </Pressable>
                ) : m.file ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      alignItems: 'center',
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: c['border-subtle'],
                    }}
                  >
                    <Icon name="image" size={16} />
                    <Txt size={12} lh={18} numberOfLines={1}>
                      {m.file}
                    </Txt>
                  </View>
                ) : null}
                {m.voice ? <VoiceBubble uri={m.voice.uri} sec={m.voice.sec} /> : null}
                {m.t ? (
                  <Txt size={14} lh={23}>
                    {m.t}
                  </Txt>
                ) : null}
              </View>
              <Txt size={11} lh={16} color="text-muted" style={{ paddingHorizontal: 4 }}>
                {(m.from === 'a' ? 'تو · ' : 'مربی · ') + m.at + (m.edited && !m.deleted ? ' · ویرایش شد' : '') + (i === lastMine && meta.lastRead ? ' · دیده شد' : '')}
              </Txt>
            </Pressable>
          ),
        )}
        {typing ? (
          <Txt size={12} lh={18} color="text-muted" style={{ alignSelf: 'flex-end' }}>
            مربی در حال نوشتن…
          </Txt>
        ) : null}
      </ScrollView>
      <View
        style={{
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: bottom,
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.border,
          gap: 8,
        }}
      >
        {editing ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="edit" size={14} color="text-muted" />
            <Txt size={12} lh={18} color="text-muted" style={{ flex: 1 }} numberOfLines={1}>
              {'ویرایش پیام: ' + editing.before}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="لغو ویرایش"
              hitSlop={8}
              onPress={() => {
                setEditing(null);
                setDraft('');
              }}
            >
              <Icon name="x" size={14} color="text-muted" />
            </Pressable>
          </View>
        ) : null}
        {attach ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: c['surface-sunken'],
              alignSelf: 'flex-start',
              maxWidth: '100%',
            }}
          >
            <Txt size={12} lh={18} numberOfLines={1}>
              {attach}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="حذف پیوست"
              onPress={() => {
                setAttach(null);
                asset.current = null;
              }}
              hitSlop={8}
            >
              <Icon name="x" size={14} color="text-muted" />
            </Pressable>
          </View>
        ) : null}
        {recording ? (
          <VoiceRecorder onSend={(r) => void sendRecording(r)} onCancel={() => setRecording(false)} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="پیوست عکس"
              onPress={pick}
              disabled={!!editing}
              style={{ width: 44, height: 44, borderWidth: 1, borderColor: c.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="image" size={20} />
            </Pressable>
            <TextInput
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              accessibilityLabel="پیام به مربی"
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                if (LIVE && v) sendTyping();
              }}
              placeholder="پیام به مربی…"
              placeholderTextColor={c['text-muted']}
              multiline
              numberOfLines={1}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                maxHeight: 110,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 6,
                fontFamily: fontFamily[400],
                fontSize: 14,
                lineHeight: 22,
                color: c['text-primary'],
                backgroundColor: c.surface,
                writingDirection: 'rtl',
              }}
            />
            {!draft.trim() && !attach && !editing ? (
              <IconButton icon="mic" label="ضبط پیام صوتی" variant="primary" size="lg" disabled={sending} onPress={() => setRecording(true)} />
            ) : (
              <IconButton icon="send" label="ارسال" variant="primary" size="lg" disabled={sending || (!draft.trim() && (!attach || !!editing))} onPress={() => void send()} />
            )}
          </View>
        )}
      </View>
      <Modal open={!!menu} title="پیام" onClose={() => setMenu(null)}>
        <View style={{ gap: 8 }}>
          {menu?.t ? (
            <Button
              variant="secondary"
              icon="edit"
              fullWidth
              onPress={() => {
                if (!menu) return;
                setEditing({ id: menu.id, before: menu.t });
                setDraft(menu.t);
                setAttach(null);
                setMenu(null);
              }}
            >
              ویرایش
            </Button>
          ) : null}
          <Button
            variant="destructive"
            icon="trash"
            fullWidth
            onPress={async () => {
              if (!menu) return;
              const id = menu.id;
              setMenu(null);
              await deleteChat(id);
            }}
          >
            حذف برای هر دو طرف
          </Button>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
