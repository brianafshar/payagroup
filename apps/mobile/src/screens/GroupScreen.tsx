// A coach's broadcast group (#81): the coach's posts — text, photos, videos, files. Read only.
import { faDate, faDigits, faTime } from '@baseline/core';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { groupPosts, groups, openGroup, type GroupPost } from '../data/live';
import { useNav, type RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { EmptyState, Icon, MobileHeader, Screen, Txt, VideoPlayer } from '../ui';

const VIDEO = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const IMAGE = /\.(jpe?g|png|webp|gif)(\?|$)/i;
const fileName = (url: string) => decodeURIComponent(url.split('?')[0].split('/').pop() || 'فایل');

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const t = new Date();
  const y = new Date();
  y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'امروز';
  if (d.toDateString() === y.toDateString()) return 'دیروز';
  return faDate(d, { weekday: true, year: false });
}

function Post({ p }: { p: GroupPost }) {
  const { c } = useTheme();
  const url = p.attachment || '';
  return (
    <View style={{ alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '88%', gap: 4 }}>
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c['border-subtle'], borderRadius: 14, borderTopLeftRadius: 4, padding: 10, gap: 8 }}>
        {p.deleted ? (
          <Txt size={14} lh={22} color="text-muted">
            این پیام حذف شد
          </Txt>
        ) : null}
        {url && VIDEO.test(url) ? (
          <View style={{ width: 260, maxWidth: '100%' }}>
            <VideoPlayer title="ویدیو" src={url} />
          </View>
        ) : url && IMAGE.test(url) ? (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel="باز کردن عکس" onPress={() => void Linking.openURL(url)}>
            <Image source={{ uri: url }} style={{ width: 240, height: 180, borderRadius: 8, backgroundColor: c['surface-sunken'] }} resizeMode="cover" />
          </Pressable>
        ) : url ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="file-text" size={18} />
            <Txt size={13} lh={20} numberOfLines={1} style={{ flexShrink: 1 }}>
              {fileName(url)}
            </Txt>
          </Pressable>
        ) : null}
        {p.text ? (
          <Txt size={14} lh={23}>
            {p.text}
          </Txt>
        ) : null}
      </View>
      <Txt size={11} lh={16} color="text-muted">
        {faTime(new Date(p.createdAt)) + (p.editedAt && !p.deleted ? ' · ویرایش شد' : '')}
      </Txt>
    </View>
  );
}

export function GroupScreen() {
  const nav = useNav();
  const { id } = useRoute<RouteProp<RootStackParamList, 'Group'>>().params;
  const { list } = groups.use();
  const { posts, loaded } = groupPosts.use();
  const g = list.find((x) => x.id === Number(id));
  useEffect(() => {
    void openGroup(Number(id)).catch(() => groupPosts.set({ loaded: true }));
    return () => groupPosts.set({ id: null, posts: [], loaded: false });
  }, [id]);
  let day = '';
  return (
    <Screen gap={12} header={<MobileHeader title={g?.name || 'گروه'} back="گفتگو" onBack={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Chat'))} />}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="users" size={16} color="text-muted" />
        <Txt size={12} lh={18} color="text-muted" style={{ flex: 1 }}>
          {(g ? 'مربی: ' + g.coachName + ' · ' + faDigits(g.memberCount) + ' عضو · ' : '') + 'فقط مربی در این گروه پیام می‌گذارد.'}
        </Txt>
      </View>
      {loaded && !posts.length ? <EmptyState icon="chat" title="هنوز پیامی نیست" description="پیام‌های مربی برای این گروه اینجا نمایش داده می‌شوند." /> : null}
      {posts.map((p) => {
        const d = dayLabel(p.createdAt);
        const sep = d !== day ? (day = d) : null;
        return (
          <View key={p.id} style={{ gap: 8 }}>
            {sep ? (
              <Txt size={12} lh={18} color="text-muted" align="center">
                {sep}
              </Txt>
            ) : null}
            <Post p={p} />
          </View>
        );
      })}
    </Screen>
  );
}
