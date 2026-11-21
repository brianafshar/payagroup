// Gym-wide nutrition templates: save this athlete's plan as a template, or apply a template to this athlete.
import { useState } from 'react';
import { Button, EmptyState, Modal, TextField } from '@/ds';
import { faError, remote } from '@/data/api';
import { useQuery } from '@/data/hooks';
import type { NutritionTemplate } from '@/data/remote';
import { faDigits } from '@/lib/format';
import { toast } from '@/lib/toast';

export function NutritionTemplateButtons({ athleteId, athleteName, onApplied }: { athleteId: string; athleteName: string; onApplied: () => void }) {
  const [mode, setMode] = useState<null | 'save' | 'apply'>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery<NutritionTemplate[]>('nutrition-templates', () => remote.nutritionTemplates());
  const close = () => setMode(null);

  const save = async () => {
    setBusy(true);
    try {
      await remote.saveNutritionTemplate({ name: name.trim(), athlete: athleteId });
      toast('قالب ذخیره شد', name.trim());
      setName('');
      close();
      q.refetch();
    } catch (e) {
      toast('ذخیره نشد', faError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const apply = async (t: NutritionTemplate) => {
    if (!window.confirm('برنامه تغذیه‌ی فعلی ' + athleteName + ' با قالب «' + t.name + '» جایگزین شود؟')) return;
    setBusy(true);
    try {
      await remote.assignNutritionTemplate(t.id, [athleteId]);
      toast('قالب اعمال شد', t.name);
      close();
      onApplied();
    } catch (e) {
      toast('اعمال نشد', faError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (t: NutritionTemplate) => {
    if (!window.confirm('قالب «' + t.name + '» حذف شود؟')) return;
    try {
      await remote.deleteNutritionTemplate(t.id);
      q.refetch();
    } catch (e) {
      toast('حذف نشد', faError(e), 'error');
    }
  };

  return (
    <>
      <Button variant="secondary" icon="layers" onClick={() => setMode('apply')}>
        قالب‌ها
      </Button>
      {mode === 'save' ? (
        <Modal title="ذخیره به‌عنوان قالب" description="برنامه‌ی فعلی این ورزشکار برای همه‌ی مربیان باشگاه به‌عنوان قالب ذخیره می‌شود." primaryLabel="ذخیره" primaryDisabled={!name.trim()} loading={busy} onPrimary={save} secondaryLabel="انصراف" onSecondary={close} onClose={close}>
          <TextField label="نام قالب" placeholder="مثلاً حجم ۲۵۰۰ کالری" onChange={setName} />
        </Modal>
      ) : null}
      {mode === 'apply' ? (
        <Modal title="قالب‌های تغذیه" description={'قالب را برای ' + athleteName + ' اعمال کنید، یا برنامه‌ی فعلی او را به‌عنوان قالب ذخیره کنید.'} primaryLabel="ذخیره‌ی برنامه‌ی فعلی به‌عنوان قالب" onPrimary={() => setMode('save')} secondaryLabel="بستن" onSecondary={close} onClose={close}>
          {!q.loading && !(q.data ?? []).length ? <EmptyState icon="layers" title="هنوز قالبی ندارید" description="برنامه‌ی یک ورزشکار را بنویسید و آن را به‌عنوان قالب ذخیره کنید." compact /> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflow: 'auto' }}>
            {(q.data ?? []).map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {faDigits(t.kcal)} کالری · {faDigits(t.mealCount)} وعده · {t.coachName}
                  </div>
                </div>
                <Button variant="primary" size="sm" loading={busy} onClick={() => void apply(t)}>
                  اعمال
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void remove(t)}>
                  حذف
                </Button>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
