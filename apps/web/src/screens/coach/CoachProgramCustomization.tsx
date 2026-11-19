// Design: project/C22 Coach Program Customization.dc.html — customizing an athlete's program means
// editing their own copy of it, so this route opens that copy in the program builder (C19).
import { useEffect } from 'react';
import { pending } from '@/app/pending';
import { LoadingState } from '@/ds';
import { api } from '@/data/api';
import { useQuery } from '@/data/hooks';
import { go, navigate, param } from '@/lib/nav';

export default function CoachProgramCustomizationPage() {
  const id = param('id') || '';
  const athlete = useQuery('athlete:' + id, () => api.athletes.get(id));
  useEffect(() => {
    if (!athlete.data) return;
    if (athlete.data.programId) navigate('/coach/builder?id=' + athlete.data.programId);
    else go('coach:athlete?id=' + id, { title: 'برنامه‌ای اختصاص داده نشده', desc: 'اول از «برنامه‌ها» یک قالب به این ورزشکار اختصاص دهید.', tone: 'info' });
  }, [athlete.data, id]);
  // While loading, and during the redirect.
  return (
    pending(athlete) ?? (
      <div className="bl-page-state">
        <LoadingState />
      </div>
    )
  );
}
