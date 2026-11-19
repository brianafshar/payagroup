import type { JSX } from 'react';
import { EmptyState, ErrorState, LoadingState, Sidebar, TopBar } from '@/ds';
import { PanelLayout } from './PanelLayout';
import { panelUser } from '@/data/session';
import { faError } from '@/data/errors';
import type { QueryState } from '@/data/hooks';

/**
 * For data containers: a full-page loading or error state while any query has no data yet, else null.
 * `const wait = pending(a, b); if (wait) return wait;`
 */
export function pending(...queries: Array<QueryState<unknown>>): JSX.Element | null {
  const failed = queries.find((q) => q.error && q.data === undefined);
  if (failed)
    return (
      <div className="bl-page-state">
        <ErrorState title="بارگذاری نشد" description={faError(failed.error)} actionLabel="تلاش دوباره" onAction={() => queries.forEach((q) => q.error && q.refetch())} />
      </div>
    );
  if (queries.some((q) => q.data === undefined))
    return (
      <div className="bl-page-state">
        <LoadingState />
      </div>
    );
  return null;
}

/** Coach screens about one athlete, when the coach has no athlete with an account yet. */
export function NoAthletePage({ active, title }: { active: string; title: string }): JSX.Element {
  return (
    <PanelLayout
      sidebar={<Sidebar app="coach" active={active} brandSub="فضای کاری مربی" user={panelUser({ name: '', role: '' })} />}
      topBar={<TopBar breadcrumbs={[title]} unread search />}
    >
      <div style={{ padding: '48px 32px' }}>
        <EmptyState
          icon="users"
          title="هنوز ورزشکار فعالی ندارید"
          description="وقتی اولین ورزشکار دعوتش را بپذیرد، اطلاعات او اینجا نمایش داده می‌شود."
          actionLabel="افزودن ورزشکار"
          actionIcon="plus"
          actionTo="coach:create-athlete"
        />
      </div>
    </PanelLayout>
  );
}
