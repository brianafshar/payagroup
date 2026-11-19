// Ported from design handoff: project/C16 Coach Exercise Details.dc.html
import { createElement, createRef, Fragment } from 'react';
import { ExerciseImageCard } from './ExerciseImageCard';
import { Button, Card, Checkbox, DataTable, DescriptionList, FileUpload, ListRow, PageHeader, RadioGroup, Select, Sidebar, TextField, TopBar, VideoPlayer } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { go, param } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { EX_CATS, EX_EQUIP, EX_DIFF, ISSUES, MUSCLES, SPORT_LABEL } from '@/data/exercises';
import type { Exercise } from '@/data/types';
import { api, faError, remote } from '@/data/api';
import { pending } from '@/app/pending';
import { useQuery } from '@/data/hooks';
import { faDayMonth } from '@/lib/format';
import { faNum as faN } from '@/lib/metrics';
import { videoDuration } from './CoachCreateExercise';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Data container: the exercise in `?id=` and athletes' best results on it. */
export default function CoachExerciseDetailsPage(props: { brand?: string }) {
  const id = param('id') || '';
  const ex = useQuery('exercise:' + id, () => api.exercises.get(id));
  const records = useQuery('exercise-records:' + id, () => remote.exerciseRecords(id));
  const programs = useQuery('exercise-programs:' + id, () => remote.exercisePrograms(id));
  const all = useQuery('exercises', api.exercises.list); // names of the band / no-equipment alternatives
  const wait = pending(ex, records, programs, all);
  if (wait) return wait;
  return <CoachExerciseDetails key={ex.data?.id} {...props} exercise={ex.data} records={records.data} programs={programs.data} all={all.data} />;
}

const SECTION = { margin: 0, fontSize: '14px', lineHeight: '22px', fontWeight: 600 } as const;
const LIST = {
  margin: 0,
  paddingInlineStart: '20px',
  fontSize: '14px',
  lineHeight: '24px',
  color: 'var(--text-secondary)',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
} as const;

const WEEKDAY_FA: Record<string, string> = { sat: 'شنبه', sun: 'یکشنبه', mon: 'دوشنبه', tue: 'سه‌شنبه', wed: 'چهارشنبه', thu: 'پنجشنبه', fri: 'جمعه' };

class CoachExerciseDetails extends Screen {
  state: ScreenState = {
    edit: false,
    desc: null,
    cues: null,
    draftDesc: '',
    draftCues: '',
    steps: null,
    draftSteps: '',
    saved: null,
    draft: null,
    videoUrl: null,
    fileName: '',
    fileMeta: '',
    uploading: false,
    progress: 0,
  };
  fileRef = createRef<HTMLInputElement>();
  componentWillUnmount() {
    if (this.state.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(this.state.videoUrl);
  }
  renderVals() {
    const CATS = EX_CATS || {},
      EQ = EX_EQUIP || {},
      DF = EX_DIFF || {};
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const ex: Exercise = this.props.exercise;
    const desc = this.state.desc ?? ex.description ?? '',
      cues = this.state.cues ?? ex.cues ?? [],
      steps: string[] = this.state.steps ?? ex.steps ?? [];
    const lines = (t: string) =>
      t
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean);
    const byId = new Map((this.props.all as Exercise[]).map((e) => [e.id, e]));
    const altRows = (ids?: string[]) =>
      (ids || [])
        .map((i) => byId.get(i))
        .filter(Boolean)
        .map((e) => ({ id: e.id, name: e.name, sub: [EX_CATS[e.cat], EX_EQUIP[e.equip]].filter(Boolean).join(' · '), to: 'coach:exercise?id=' + e.id }));
    const alt = ex.alternatives || {};
    const base = this.state.saved || {
      name: ex.name,
      cat: ex.cat,
      equip: ex.equip,
      diff: ex.diff,
      muscles: ex.measure || CATS[ex.cat],
      metrics: ex.metrics || [],
    };
    const dr = this.state.draft || base;
    const ALLM = ['ست', 'تکرار', 'وزنه', 'استراحت', 'RPE', 'تمپو', 'مدت', 'مسافت', 'ضربان قلب'];
    const setD = (patch) => this.setState((s) => ({ draft: { ...(s.draft || base), ...patch } }));
    const hasVideo = ex.video;
    const { edit, fileName, fileMeta, uploading, progress } = this.state;
    const videoUrl = this.state.removed ? null : this.state.videoUrl || ex.videoSrc || null;
    const faNum = (n) =>
      String(n)
        .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
        .replace('.', '٫');
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'کتابخانه حرکات', to: 'coach:library' }, base.name],
      title: base.name,
      subtitle: [CATS[base.cat], EQ[base.equip], SPORT_LABEL[ex.sport || 'fitness'] || ex.sport].filter(Boolean).join(' · '),
      badges: [{ label: DF[base.diff], tone: 'neutral', icon: 'gauge' }],
      dName: dr.name,
      dCat: dr.cat,
      dEquip: dr.equip,
      dDiff: dr.diff,
      dMuscles: dr.muscles,
      nameErr: dr.name.trim() ? undefined : 'نام حرکت را وارد کنید.',
      setDName: (v) => setD({ name: v }),
      setDCat: (v) => setD({ cat: v }),
      setDEquip: (v) => setD({ equip: v }),
      setDDiff: (v) => setD({ diff: v }),
      setDMuscles: (v) => setD({ muscles: v }),
      catOpts: Object.keys(CATS).map((k) => ({ value: k, label: CATS[k] })),
      equipOpts: Object.keys(EQ).map((k) => ({ value: k, label: EQ[k] })),
      diffOpts: [
        { value: 'beginner', label: 'مبتدی' },
        { value: 'intermediate', label: 'متوسط' },
        { value: 'advanced', label: 'پیشرفته' },
      ],
      metricBoxes: ALLM.map((m) => ({
        label: m,
        on: dr.metrics.includes(m),
        toggle: () => setD({ metrics: dr.metrics.includes(m) ? dr.metrics.filter((x) => x !== m) : [...dr.metrics, m] }),
      })),
      duplicate: () => {
        api.exercises
          .create({ ...ex, name: ex.name + ' (کپی)', video: false, videoSrc: undefined })
          .then((c) => go('coach:exercise?id=' + c.id, { title: 'حرکت کپی شد', desc: '«' + ex.name + ' (کپی)» به کتابخانه اضافه شد (بدون ویدیو).' }))
          .catch((e) => toast('کپی نشد', faError(e), 'error'));
      },
      toggleEdit: () => this.setState({ edit: true, draftDesc: desc, draftCues: cues.join('\n'), draftSteps: steps.join('\n'), draft: base }),
      viewMode: !edit,
      editMode: edit,
      one: 1,
      three: 3,
      four: 4,
      desc,
      cues,
      cuesText: cues.join('\n'),
      steps,
      stepsText: steps.join('\n'),
      setSteps: (v) => this.setState({ draftSteps: v }),
      musclesPrimary: (ex.musclesPrimary || []).map((k) => MUSCLES[k] || k),
      musclesSecondary: (ex.musclesSecondary || []).map((k) => MUSCLES[k] || k),
      issues: (ex.issues || []).map((k) => ISSUES[k] || k),
      altGroups: [
        ['با کش', altRows(alt.band)],
        ['بدون وسیله', altRows(alt.home)],
        ['جایگزینِ این حرکات باشگاهی', altRows(alt.replaces)],
      ].filter(([, rows]) => rows.length),
      setDesc: (v) => this.setState({ draftDesc: v }),
      setCues: (v) => this.setState({ draftCues: v }),
      cancelEdit: () => this.setState({ edit: false, draft: null }),
      saveEdit: async () => {
        if (!dr.name.trim()) return;
        if (!dr.metrics.length) return toast('شاخصی انتخاب نشده', 'حداقل یک شاخص ثبت انتخاب کنید.', 'error');
        {
          const newCues = this.state.draftCues
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean);
          try {
            await api.exercises.update(ex.id, {
              name: dr.name.trim(),
              cat: dr.cat,
              equip: dr.equip,
              diff: dr.diff,
              measure: dr.muscles,
              metrics: dr.metrics,
              description: this.state.draftDesc.trim(),
              cues: newCues,
              steps: lines(this.state.draftSteps),
            });
          } catch (e) {
            return toast('ذخیره نشد', faError(e), 'error');
          }
        }
        this.setState((s) => ({
          edit: false,
          saved: { ...dr, name: dr.name.trim() },
          draft: null,
          desc: s.draftDesc.trim() || desc,
          steps: lines(s.draftSteps),
          cues: s.draftCues
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
        }));
        toast('تغییرات ذخیره شد', 'ورزشکاران نسخه جدید را در تمرین بعدی می‌بینند.');
      },
      videoState: hasVideo ? 'idle' : 'empty',
      videoTitle: base.name + ' · تکنیک',
      duration: ex.dur || '0:45',
      fileRef: this.fileRef,
      pickFile: () => {
        if (!edit) this.setState({ edit: true, draftDesc: desc, draftCues: cues.join('\n'), draftSteps: steps.join('\n') });
        this.fileRef.current && this.fileRef.current.click();
      },
      onFile: (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (!/^video\//.test(f.type)) return toast('فرمت پشتیبانی نمی‌شود', 'یک فایل ویدیویی MP4، MOV یا WebM انتخاب کنید.', 'error');
        if (f.size > 200 * 1024 * 1024) return toast('فایل خیلی بزرگ است', 'حداکثر حجم ۲۰۰ مگابایت است.', 'error');
        const url = URL.createObjectURL(f);
        const mb = f.size / 1024 / 1024;
        const ext = (f.name.split('.').pop() || '').toUpperCase();
        {
          this.setState({ uploading: true, progress: 50, fileName: f.name, fileMeta: ext + ' · ' + faNum(mb.toFixed(1)) + ' MB', removed: false });
          void videoDuration(f).then(async (dur) => {
            const fd = new FormData();
            fd.append('video', f);
            if (dur) fd.append('dur', dur);
            try {
              const saved = await api.exercises.update(ex.id, fd);
              this.setState({ uploading: false, progress: 100, videoUrl: saved.videoSrc || url });
              toast('ویدیو بارگذاری شد', 'این ویدیو برای ورزشکاران شما نمایش داده می‌شود.');
            } catch (err) {
              this.setState({ uploading: false, progress: 0, fileName: '' });
              toast('بارگذاری نشد', faError(err), 'error');
            }
          });
          return;
        }
      },
      removeVideo: () => {
        api.exercises.update(ex.id, { removeVideo: true } as Partial<Exercise>).catch((e) => toast('حذف نشد', faError(e), 'error'));
        this.setState({ removed: true, videoUrl: null, fileName: '', fileMeta: '' });
        toast('ویدیو حذف شد');
      },
      hasCustom: !!videoUrl,
      noCustom: !videoUrl,
      customVideo: videoUrl
        ? createElement('video', {
            key: videoUrl,
            src: videoUrl,
            poster: this.props.exercise?.imageSrc || undefined,
            controls: true,
            playsInline: true,
            style: { width: '100%', height: 400, display: 'block', borderRadius: 'var(--radius-md)', background: '#000', objectFit: 'contain' },
          })
        : null,
      uploadState: uploading ? 'uploading' : videoUrl ? 'done' : 'idle',
      progress,
      fileName,
      fileMeta,
      details: [
        { label: 'عضلات اصلی', value: base.muscles || '—' },
        { label: 'تجهیزات', value: EQ[base.equip] },
        { label: 'شاخص‌های ثبت', value: base.metrics.join(' · ') || '—' },
      ],
      usedIn: this.props.programs.map((p) => ({
        icon: p.kind === 'template' ? 'layers' : 'git-branch',
        title: p.kind === 'template' ? p.name : (p.athleteName || '') + ' · ' + (p.kind === 'customized' ? 'نسخه شخصی‌سازی‌شده' : p.name),
        subtitle: (p.kind === 'template' ? 'قالب نسخه ' + fa(p.version) : 'نسخه اختصاصی') + (p.weekdays.length ? ' · ' + p.weekdays.map((d) => WEEKDAY_FA[d] || d).join('، ') : ''),
        to: p.kind === 'template' ? 'coach:program?id=' + p.id : 'coach:program-builder?id=' + p.id,
      })),
      usedTitle: ex.used ? 'استفاده در ' + fa(ex.used) + ' برنامه' : 'هنوز در برنامه‌ای استفاده نشده',
      bestCols: [
        { key: 'a', label: 'ورزشکار', type: 'person' },
        { key: 'v', label: 'بهترین', align: 'right' },
        { key: 'd', label: 'تاریخ' },
      ],
      best: Object.values(
        (this.props.records as any[]).reduce((acc, r) => {
          if (!acc[r.athleteId] || acc[r.athleteId].value < r.value) acc[r.athleteId] = r;
          return acc;
        }, {}),
      ).map((r: any) => ({
        id: String(r.id),
        a: { name: r.athleteName || 'ورزشکار', sub: r.type },
        v: faN(r.value) + ' ' + r.unit,
        d: faDayMonth(new Date(r.date)),
        to: 'coach:athlete?id=' + r.athleteId,
      })),
    };
  }

  render() {
    const v = this.vals();
    return (
      <PanelLayout
        theme={v.brand}
        sidebar={<Sidebar app="coach" active="library" brandSub="فضای کاری مربی" user={v.user} />}
        topBar={<TopBar breadcrumbs={v.crumbs} unread search />}
      >
        <div style={{ flex: '1 1 auto', padding: '24px 32px 48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <PageHeader back="کتابخانه حرکات" backTo="coach:library" title={v.title} subtitle={v.subtitle} badges={v.badges}>
            {v.viewMode ? (
              <>
                <Button variant="secondary" icon="copy" onClick={v.duplicate}>
                  کپی
                </Button>
                <Button variant="primary" icon="edit" onClick={v.toggleEdit}>
                  ویرایش
                </Button>
              </>
            ) : null}
            {v.editMode ? (
              <>
                <Button variant="ghost" onClick={v.cancelEdit}>
                  انصراف
                </Button>
                <Button variant="primary" icon="check" onClick={v.saveEdit}>
                  ذخیره تغییرات
                </Button>
              </>
            ) : null}
          </PageHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input type="file" accept="video/mp4,video/quicktime,video/webm,video/*" ref={v.fileRef} onChange={v.onFile} style={{ display: 'none' }} />
              {v.hasCustom ? <>{v.customVideo}</> : null}
              {v.noCustom ? (
                <>
                  <VideoPlayer state={v.videoState} title={v.videoTitle} duration={v.duration} emptyAction="بارگذاری ویدیو" onEmptyAction={v.pickFile} />
                </>
              ) : null}
              {v.editMode ? (
                <>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      minWidth: '0',
                    }}
                  >
                    <FileUpload
                      label="ویدیوی آموزشی شما"
                      state={v.uploadState}
                      progress={v.progress}
                      fileName={v.fileName}
                      fileMeta={v.fileMeta}
                      hint="MP4، MOV یا WebM · فقط برای ورزشکاران شما نمایش داده می‌شود"
                      onBrowse={v.pickFile}
                      onReplace={v.pickFile}
                      onRemove={v.removeVideo}
                    />
                  </div>
                </>
              ) : null}
              <ExerciseImageCard ex={this.props.exercise} />
              <Card title="توضیحات و نحوه اجرا">
                {v.viewMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
                    {v.desc ? <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)', textWrap: 'pretty' }}>{v.desc}</p> : null}
                    {v.steps.length ? (
                      <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h3 style={SECTION}>مراحل اجرا</h3>
                        <ol style={LIST}>
                          {v.steps.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ol>
                      </section>
                    ) : null}
                    {v.cues.length ? (
                      <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h3 style={SECTION}>نکات و خطاهای رایج</h3>
                        <ul style={LIST}>
                          {v.cues.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                ) : null}
                {v.editMode ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }}>
                      <TextField label="توضیحات" multiline rows={v.three} value={v.desc} onChange={v.setDesc} />
                      <TextField label="مراحل اجرا" hint="هر مرحله در یک خط" multiline rows={v.four} value={v.stepsText} onChange={v.setSteps} />
                      <TextField label="نکات و خطاهای رایج" hint="هر نکته در یک خط" multiline rows={v.four} value={v.cuesText} onChange={v.setCues} />
                    </div>
                  </>
                ) : null}
              </Card>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '0' }}>
              <Card title="جزئیات">
                {v.viewMode ? (
                  <>
                    <DescriptionList columns={v.one} items={v.details} />
                  </>
                ) : null}
                {v.editMode ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: '0' }}>
                      <TextField label="نام حرکت" value={v.dName} onChange={v.setDName} error={v.nameErr} />
                      <Select label="دسته" value={v.dCat} options={v.catOpts} onChange={v.setDCat} />
                      <Select label="تجهیزات" value={v.dEquip} options={v.equipOpts} onChange={v.setDEquip} />
                      <RadioGroup label="سطح" direction="row" value={v.dDiff} options={v.diffOpts} onChange={v.setDDiff} />
                      <TextField label="عضلات اصلی" value={v.dMuscles} placeholder="مثلاً سینه، سرشانه جلو" onChange={v.setDMuscles} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '14px', lineHeight: '20px', fontWeight: '500' }}>شاخص‌های ثبت</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px' }}>
                          {(v.metricBoxes || []).map((m: any, $index: number) => (
                            <Fragment key={$index}>
                              <Checkbox label={m?.label} checked={m?.on} onChange={m?.toggle} />
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </Card>
              {v.musclesPrimary.length || v.musclesSecondary.length ? (
                <Card title="عضلات درگیر">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {v.musclesPrimary.map((m) => (
                      <span key={'p' + m} className="bl-chip" style={{ background: 'var(--brand-primary-subtle)', color: 'var(--brand-primary-text)', fontWeight: 600 }}>
                        {m}
                      </span>
                    ))}
                    {v.musclesSecondary.map((m) => (
                      <span key={'s' + m} className="bl-chip">
                        {m}
                      </span>
                    ))}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>رنگی: عضلات اصلی · خاکستری: عضلات کمکی</p>
                </Card>
              ) : null}
              {v.issues.length ? (
                <Card title="مناسب برای">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {v.issues.map((m) => (
                      <span key={m} className="bl-chip">
                        {m}
                      </span>
                    ))}
                  </div>
                </Card>
              ) : null}
              {v.altGroups.length ? (
                <Card title="جایگزین‌ها" padding="none">
                  {v.altGroups.map(([label, rows]) => (
                    <div key={label as string} style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ padding: '10px 16px 2px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
                      {(rows as any[]).map((r) => (
                        <ListRow key={r.id} icon="refresh" title={r.name} subtitle={r.sub} to={r.to} />
                      ))}
                    </div>
                  ))}
                </Card>
              ) : null}
              <Card title={v.usedTitle} actionLabel="همه" actionTo="coach:programs" padding="none">
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '0' }}>
                  {v.usedIn.map((u, i) => (
                    <ListRow key={i} icon={u.icon} title={u.title} subtitle={u.subtitle} to={u.to} />
                  ))}
                  {v.usedIn.length ? null : <ListRow icon="layers" title="در هیچ برنامه‌ای استفاده نشده" chevron={false} />}
                </div>
              </Card>
              <Card title="بهترین رکورد ورزشکاران" padding="none">
                <DataTable bare dense columns={v.bestCols} rows={v.best} />
              </Card>
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
