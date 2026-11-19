// Ported from design handoff: project/C15 Coach Create Exercise.dc.html
import { createRef, Fragment } from 'react';
import { Button, Checkbox, ExerciseCard, FileUpload, PageHeader, RadioGroup, Select, Sidebar, TextField, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { go } from '@/lib/nav';
import { toast } from '@/lib/toast';
import { categoriesFor, EX_CATS, EX_EQUIP, EX_DIFF, SPORT_LABEL, SPORTS } from '@/data/exercises';
import { api, faError } from '@/data/api';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Video length as `m:ss` (read from the file's metadata in the browser). */
export function videoDuration(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const s = Math.round(v.duration || 0);
      resolve(s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : undefined);
    };
    v.onerror = () => resolve(undefined);
    v.src = url;
  });
}

export default class CoachCreateExercise extends Screen {
  videoRef = createRef<HTMLInputElement>();
  imageRef = createRef<HTMLInputElement>();
  state: ScreenState = {
    name: '',
    sport: 'fitness',
    measure: 'load',
    unit: 'kg',
    cat: null,
    equip: null,
    diff: 'intermediate',
    video: 'idle',
    progress: 0,
    image: 'idle',
    metrics: ['sets', 'reps', 'weight', 'rest', 'rpe'],
    tried: false,
    saving: false,
  };
  renderVals() {
    const CATS = EX_CATS || {},
      EQ = EX_EQUIP || {},
      DF = EX_DIFF || {};
    const { name, sport, measure, unit, cat, equip, diff, video, progress, image, metrics, tried, saving } = this.state;
    const MEAS = {
      load: {
        label: 'وزنه و تکرار',
        units: [
          ['kg', 'کیلوگرم (kg)'],
          ['lb', 'پوند (lb)'],
        ],
        metrics: ['sets', 'reps', 'weight', 'rest', 'rpe'],
        hint: 'ورزشکار ست، تکرار و وزنه را ثبت می‌کند.',
      },
      reps: { label: 'وزن بدن (فقط تکرار)', units: [['rep', 'تکرار']], metrics: ['sets', 'reps', 'rest'], hint: 'بدون وزنه؛ ست و تکرار ثبت می‌شود.' },
      distance: {
        label: 'مسافت',
        units: [
          ['m', 'متر (m)'],
          ['km', 'کیلومتر (km)'],
        ],
        metrics: ['distance', 'duration', 'pace', 'hr'],
        hint: 'ورزشکار مسافت، زمان و پیس را ثبت می‌کند.',
      },
      interval: {
        label: 'اینتروال (تکرار × مسافت)',
        units: [
          ['m', 'متر (m)'],
          ['km', 'کیلومتر (km)'],
        ],
        metrics: ['reps', 'distance', 'pace', 'rest', 'hr'],
        hint: 'مثلاً ۶ × ۴۰۰ متر: تعداد تکرار، مسافت هر تکرار، پیس هدف و استراحت بین تکرارها.',
      },
      time: {
        label: 'زمان',
        units: [
          ['s', 'ثانیه'],
          ['min', 'دقیقه'],
        ],
        metrics: ['sets', 'duration', 'rest'],
        hint: 'مثلاً پلانک یا اینتروال؛ مدت هر ست ثبت می‌شود.',
      },
    };
    const SPORT_DEF = {
      fitness: 'load',
      crossfit: 'load',
      martial: 'reps',
      football: 'reps',
      running: 'distance',
      swimming: 'distance',
      cycling: 'distance',
      triathlon: 'distance',
      endurance: 'distance',
    };
    const M = [
      ['sets', 'ست'],
      ['reps', 'تکرار'],
      ['weight', 'وزنه', 'kg'],
      ['rest', 'استراحت', measure === 'interval' ? 'بین تکرارها' : 'ثانیه'],
      ['rpe', 'RPE', 'اختیاری، ۱ تا ۱۰'],
      ['tempo', 'تمپو'],
      ['duration', 'مدت'],
      ['distance', 'مسافت', unit === 'km' ? 'km' : 'm'],
      // Pace is per kilometre (min:ss/km) for running and cycling; swimmers use per 100 m.
      ['pace', 'پیس', sport === 'swimming' ? 'دقیقه/۱۰۰m' : 'دقیقه/km'],
      ['hr', 'ضربان قلب', 'اختیاری'],
    ];
    const labelOf = (id) => (M.find((m) => m[0] === id) || [])[1];
    const toggle = (id) => this.setState((s) => ({ metrics: s.metrics.includes(id) ? s.metrics.filter((x) => x !== id) : [...s.metrics, id] }));
    const bad = { name: !name.trim(), cat: !cat, equip: !equip };
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'کتابخانه حرکات', to: 'coach:library' }, 'حرکت جدید'],
      three: 3,
      setName: (v) => this.setState({ name: v }),
      nameErr: tried && bad.name ? 'نام حرکت را وارد کنید.' : undefined,
      sports: SPORTS.map(([value, label]) => ({ value, label })),
      sport,
      sportLabel: SPORT_LABEL[sport] || sport,
      setSport: (v) => {
        const m = SPORT_DEF[v] || 'load';
        // A category of the old sport (e.g. «جلسه دویدن» after switching to swimming) is cleared (#75).
        this.setState((s) => ({ sport: v, measure: m, unit: MEAS[m].units[0][0], metrics: MEAS[m].metrics, cat: categoriesFor(v).includes(s.cat) ? s.cat : null }));
      },
      measure,
      measureOpts: Object.keys(MEAS).map((k) => ({ value: k, label: MEAS[k].label })),
      measureHint: MEAS[measure].hint,
      setMeasure: (v) => this.setState({ measure: v, unit: MEAS[v].units[0][0], metrics: MEAS[v].metrics }),
      unit,
      unitOpts: MEAS[measure].units.map(([v, l]) => ({ value: v, label: l })),
      setUnit: (v) => this.setState({ unit: v }),
      cat,
      catOpts: categoriesFor(sport).map((k) => ({ value: k, label: CATS[k] })),
      setCat: (v) => this.setState({ cat: v }),
      catErr: tried && bad.cat ? 'دسته را انتخاب کنید.' : undefined,
      equipOpts: Object.keys(EQ).map((k) => ({ value: k, label: EQ[k] })),
      setEquip: (v) => this.setState({ equip: v }),
      equipErr: tried && bad.equip ? 'تجهیزات را انتخاب کنید.' : undefined,
      diffOpts: [
        { value: 'beginner', label: 'مبتدی' },
        { value: 'intermediate', label: 'متوسط' },
        { value: 'advanced', label: 'پیشرفته' },
      ],
      setDiff: (v) => this.setState({ diff: v }),
      videoState: video,
      videoProgress: progress,
      uploadVideo: () => {
        this.videoRef.current?.click();
      },
      removeVideo: () => this.setState({ video: 'idle', progress: 0, videoFile: null }),
      videoRef: this.videoRef,
      onVideoFile: async (e) => {
        const f: File | undefined = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > 200 * 1024 * 1024) return toast('حجم فایل زیاد است', 'حداکثر ۲۰۰ مگابایت', 'error');
        const dur = await videoDuration(f);
        const mb = Math.max(1, Math.round(f.size / 1024 / 1024));
        const fa = (x) => String(x).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
        this.setState({
          video: 'done',
          progress: 100,
          videoFile: f,
          videoDur: dur,
          videoName: f.name,
          videoMeta: [f.name.split('.').pop()?.toUpperCase(), dur && fa(dur), fa(mb) + ' MB'].filter(Boolean).join(' · '),
        });
      },
      videoName: this.state.videoName,
      videoMeta: this.state.videoMeta,
      imageState: image,
      imageRef: this.imageRef,
      imageName: this.state.imageName,
      imageMeta: this.state.imageMeta,
      uploadImage: () => this.imageRef.current?.click(),
      onImageFile: (e) => {
        const f: File | undefined = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        if (f.size > 20 * 1024 * 1024) return toast('حجم فایل زیاد است', 'حداکثر ۲۰ مگابایت', 'error');
        const kb = Math.max(1, Math.round(f.size / 1024));
        const fa = (x) => String(x).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
        this.setState({ image: 'done', imageFile: f, imageName: f.name, imageMeta: [f.name.split('.').pop()?.toUpperCase(), fa(kb) + ' KB'].filter(Boolean).join(' · ') });
      },
      removeImage: () => this.setState({ image: 'idle', imageFile: null }),
      metricBoxes: M.map(([id, label, desc]) => ({ label, desc, on: metrics.includes(id), toggle: () => toggle(id) })),
      saveDisabled: video === 'uploading',
      uploadingNote: video === 'uploading',
      saving,
      save: () => {
        if (bad.name || bad.cat || bad.equip) return this.setState({ tried: true });
        if (!metrics.length) return toast('شاخصی انتخاب نشده', 'حداقل یک شاخص برای ثبت انتخاب کنید.', 'error');
        this.setState({ saving: true });
        {
          const fd = new FormData();
          const add = (k: string, val: string | undefined | null) => val != null && fd.append(k, val);
          add('name', name.trim());
          add('cat', cat);
          add('equip', equip);
          add('diff', diff);
          add('sport', sport);
          add('measure', measure);
          add('unit', unit);
          metrics.map(labelOf).forEach((m) => fd.append('metrics', m));
          if (this.state.videoFile) {
            fd.append('video', this.state.videoFile);
            add('dur', this.state.videoDur);
          }
          if (this.state.imageFile) fd.append('image', this.state.imageFile);
          api.exercises
            .create(fd)
            .then((ex) => go('coach:exercise?id=' + ex.id, { title: 'حرکت ذخیره شد', desc: '«' + name.trim() + '» به کتابخانه اضافه شد.' }))
            .catch((err) => {
              this.setState({ saving: false });
              toast('ذخیره نشد', faError(err), 'error');
            });
          return;
        }
      },
      previewName: name.trim() || 'نام حرکت',
      previewCat: cat ? CATS[cat] : 'دسته',
      previewEquip: equip ? EQ[equip] : 'تجهیزات',
      previewDiff: DF[diff],
      hasVideo: video === 'done',
      previewMetrics: metrics.map(labelOf),
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
          <PageHeader title="ایجاد حرکت" subtitle="در کتابخانه شما ذخیره می‌شود و در همه برنامه‌ها قابل استفاده است." back="کتابخانه حرکات" backTo="coach:library" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div style={{ gridColumn: 'span 2', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minWidth: '0',
                }}
              >
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>اطلاعات پایه</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  <TextField label="نام حرکت" placeholder="مثلاً پرس سینه دست جمع" onChange={v.setName} error={v.nameErr} />
                  <Select label="رشته" value={v.sport} options={v.sports} onChange={v.setSport} />
                  <Select label="دسته" placeholder="انتخاب کنید" value={v.cat ?? undefined} options={v.catOpts} onChange={v.setCat} error={v.catErr} />
                  <Select label="تجهیزات" placeholder="انتخاب کنید" options={v.equipOpts} onChange={v.setEquip} error={v.equipErr} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  <Select label="نوع اندازه‌گیری" value={v.measure} options={v.measureOpts} onChange={v.setMeasure} hint={v.measureHint} />
                  <Select label="واحد" value={v.unit} options={v.unitOpts} onChange={v.setUnit} />
                </div>
                <RadioGroup label="سطح" direction="row" value="intermediate" options={v.diffOpts} onChange={v.setDiff} />
                <TextField label="توضیحات" multiline rows={v.three} optional placeholder="مثلاً دست‌ها به عرض شانه تا فشار به پشت بازو منتقل شود. آرنج‌ها نزدیک بدن بماند." />
              </div>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minWidth: '0',
                }}
              >
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>رسانه</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  <FileUpload
                    label="ویدیوی آموزشی"
                    optional
                    state={v.videoState}
                    progress={v.videoProgress}
                    fileName={v.videoName}
                    fileMeta={v.videoMeta}
                    hint="MP4 یا MOV، حداکثر ۶۰ ثانیه"
                    onBrowse={v.uploadVideo}
                    onReplace={v.uploadVideo}
                    onRemove={v.removeVideo}
                  />
                  <input ref={v.videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={v.onVideoFile} style={{ display: 'none' }} />
                  <FileUpload
                    label="تصویر"
                    optional
                    state={v.imageState}
                    fileName={v.imageName}
                    fileMeta={v.imageMeta}
                    hint="JPG یا PNG، نسبت ۴:۳"
                    onBrowse={v.uploadImage}
                    onReplace={v.uploadImage}
                    onRemove={v.removeImage}
                  />
                  <input ref={v.imageRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={v.onImageFile} style={{ display: 'none' }} />
                </div>
              </div>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  minWidth: '0',
                }}
              >
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>آنچه ورزشکار ثبت می‌کند</h3>
                <p style={{ margin: '0', fontSize: '14px', lineHeight: '24px', color: 'var(--text-secondary)' }}>
                  شاخص‌هایی را که هنگام ثبت این حرکت نمایش داده می‌شوند انتخاب کنید. شاخص‌های اختیاری هرگز مانع تکمیل تمرین نمی‌شوند.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                  {(v.metricBoxes || []).map((m: any, $index: number) => (
                    <Fragment key={$index}>
                      <Checkbox label={m?.label} description={m?.desc} checked={m?.on} onChange={m?.toggle} />
                    </Fragment>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Button variant="ghost" to="coach:library">
                  انصراف
                </Button>
                <Button variant="primary" disabled={v.saveDisabled} loading={v.saving} onClick={v.save}>
                  ذخیره حرکت
                </Button>
              </div>
              {v.uploadingNote ? (
                <>
                  <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)', textAlign: 'left' }}>پس از پایان بارگذاری ویدیو، ذخیره فعال می‌شود.</p>
                </>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }}>
              <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>پیش‌نمایش کارت</h3>
              <ExerciseCard
                name={v.previewName}
                category={v.previewCat}
                equipment={v.previewEquip}
                sport={v.sportLabel}
                difficulty={v.previewDiff}
                hasVideo={v.hasVideo}
                duration="۰:۴۰"
                metrics={v.previewMetrics}
                usage="هنوز استفاده نشده"
              />
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
