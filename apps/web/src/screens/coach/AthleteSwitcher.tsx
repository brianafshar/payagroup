import { Select } from '@/ds';
import type { Athlete } from '@/data/types';
import { go } from '@/lib/nav';

/** Switch the page to another athlete (keeps the same page, changes `?id=`). Athletes without an account are listed last. */
export function AthleteSwitcher({ athletes, current, route }: { athletes: Athlete[]; current: string; route: string }) {
  const list = [...athletes];
  return (
    <div style={{ width: 240 }}>
      <Select
        value={current}
        icon="user"
        options={list.map((a) => ({ value: a.id, label: a.name }))}
        onChange={(id) => go(route + '?id=' + id)}
      />
    </div>
  );
}
