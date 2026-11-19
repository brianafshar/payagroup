// Voice messages in the athlete's chat: recording in the composer (expo-audio, AAC .m4a; up to 5
// minutes) and a player in the bubble that loads the recording only when it is played.
import { faDigits } from '@baseline/core';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon, IconButton, toast, Txt } from '../ui';

export const MAX_VOICE_SEC = 300;
export const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return faDigits(Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
};

/** Speech doesn't need stereo or a high bit rate: mono AAC at 64 kb/s is about 0.5 MB a minute. */
const VOICE: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { ...RecordingPresets.HIGH_QUALITY.android },
  ios: { ...RecordingPresets.HIGH_QUALITY.ios },
};

export interface Recording {
  uri: string;
  sec: number;
  /** File name with the extension the server expects. */
  name: string;
  mime: string;
}

/** Composer while recording: cancel, a pulsing dot with the timer, and send. Starts on mount. */
export function VoiceRecorder({ onSend, onCancel }: { onSend: (r: Recording) => void; onCancel: () => void }) {
  const { c } = useTheme();
  const recorder = useAudioRecorder(VOICE);
  const state = useAudioRecorderState(recorder, 200);
  const [ready, setReady] = useState(false);
  const done = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let alive = true;
    (async () => {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        toast('میکروفون در دسترس نیست', 'اجازه دسترسی به میکروفون را در تنظیمات گوشی بده.', 'error');
        onCancel();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!alive) return;
      recorder.record();
      setReady(true);
    })().catch(() => {
      toast('ضبط شروع نشد', 'دوباره امتحان کن.', 'error');
      onCancel();
    });
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    anim.start();
    return () => {
      alive = false;
      anim.stop();
      if (!done.current) void recorder.stop().catch(() => {});
      // Back to normal playback (iOS plays through the earpiece while recording is allowed).
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sec = (state.durationMillis || 0) / 1000;
  const finish = async (send: boolean) => {
    if (done.current) return;
    done.current = true;
    const length = (recorder.getStatus().durationMillis || 0) / 1000;
    try {
      await recorder.stop();
    } catch {
      /* already stopped */
    }
    const uri = recorder.uri;
    if (!send) return onCancel();
    if (!uri || length < 0.5) {
      toast('خیلی کوتاه بود', 'برای پیام صوتی کمی بیشتر صحبت کن.', 'error');
      return onCancel();
    }
    // The web build records webm (Chrome) or mp4 (Safari); phones record m4a.
    const ext = Platform.OS === 'web' ? (/\.(\w+)$/.exec(uri)?.[1] ?? (uri.startsWith('blob:') ? 'webm' : 'm4a')) : 'm4a';
    onSend({ uri, sec: Math.min(MAX_VOICE_SEC, length), name: 'voice.' + ext, mime: ext === 'webm' ? 'audio/webm' : 'audio/mp4' });
  };
  useEffect(() => {
    if (sec >= MAX_VOICE_SEC) void finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sec]);

  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <IconButton icon="trash" label="لغو ضبط" variant="secondary" size="lg" onPress={() => void finish(false)} />
      <View
        accessibilityLiveRegion="polite"
        style={{
          flex: 1,
          height: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 6,
          backgroundColor: c['surface-sunken'],
        }}
      >
        <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.error, opacity: pulse }} />
        <Txt size={15} lh={22} w={600}>
          {clock(sec)}
        </Txt>
        <Txt size={12} lh={18} color="text-muted" numberOfLines={1} style={{ flex: 1 }}>
          {ready ? 'در حال ضبط…' : 'آماده‌سازی میکروفون…'}
        </Txt>
      </View>
      <IconButton icon="send" label="ارسال پیام صوتی" variant="primary" size="lg" disabled={!ready} onPress={() => void finish(true)} />
    </View>
  );
}

/** Voice message in a bubble. The audio is loaded on the first tap. */
export function VoiceBubble({ uri, sec }: { uri: string; sec: number }) {
  const [active, setActive] = useState(false);
  return active ? <ActivePlayer uri={uri} sec={sec} /> : <PlayerView playing={false} pos={0} len={sec} onToggle={() => setActive(true)} />;
}

function ActivePlayer({ uri, sec }: { uri: string; sec: number }) {
  const player = useAudioPlayer(uri);
  const st = useAudioPlayerStatus(player);
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (st.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [st.didJustFinish, player]);
  const len = st.duration && Number.isFinite(st.duration) ? st.duration : sec;
  return (
    <PlayerView
      playing={st.playing}
      loading={st.isBuffering && !st.playing}
      pos={st.currentTime || 0}
      len={len}
      onToggle={() => (st.playing ? player.pause() : player.play())}
      onSeek={(f) => void player.seekTo(f * len)}
    />
  );
}

function PlayerView({
  playing,
  loading,
  pos,
  len,
  onToggle,
  onSeek,
}: {
  playing: boolean;
  loading?: boolean;
  pos: number;
  len: number;
  onToggle: () => void;
  onSeek?: (f: number) => void;
}) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const pct = len ? Math.min(1, pos / len) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 220 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'توقف' : 'پخش پیام صوتی'}
        onPress={onToggle}
        hitSlop={6}
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c['brand-primary'], alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={16} color="on-brand-primary" />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel="جابه‌جایی در پیام صوتی"
          disabled={!onSeek}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          // The bar fills from the right (RTL), like the coach's panel.
          onPress={(e) => w && onSeek?.(Math.min(1, Math.max(0, (w - e.nativeEvent.locationX) / w)))}
          style={{ height: 16, justifyContent: 'center' }}
        >
          <View style={{ height: 4, borderRadius: 2, backgroundColor: c.border }}>
            <View style={{ width: `${pct * 100}%`, height: 4, borderRadius: 2, backgroundColor: c['brand-primary'] }} />
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="mic" size={12} color="text-muted" />
          <Txt size={11} lh={14} color="text-muted">
            {loading ? 'در حال بارگذاری…' : playing || pos ? clock(pos) + ' / ' + clock(len) : clock(len)}
          </Txt>
        </View>
      </View>
    </View>
  );
}
