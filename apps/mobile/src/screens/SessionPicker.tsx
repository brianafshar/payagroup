// Today's sessions when the athlete follows several programs (#74), e.g. a run and a gym session.
import { faJoin } from '@baseline/core';
import { ScrollView, View } from 'react-native';
import { selectSession, todaySessions } from '../data/workout';
import { Tag, Txt } from '../ui';

const STATUS: Record<string, string> = { completed: '✓', partial: '◐', 'in-progress': '…', missed: '✕' };

export function SessionPicker() {
  const list = todaySessions.use().list;
  if (list.length < 2) return null;
  return (
    <View style={{ gap: 6 }}>
      <Txt size={12} lh={18} w={600} color="text-muted">
        جلسه‌های امروز
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {list.map((s) => (
          <Tag key={s.programId + ':' + s.part} selected={s.selected} onPress={s.selected ? undefined : () => void selectSession(s.programId, s.part)}>
            {faJoin([s.name, s.rest ? 'استراحت' : s.focus]) + (s.status && STATUS[s.status] ? ' ' + STATUS[s.status] : '')}
          </Tag>
        ))}
      </ScrollView>
    </View>
  );
}
