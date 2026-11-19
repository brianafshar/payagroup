// Ported from design handoff: project/C14 Coach Exercise Library.dc.html
import { createRef, Fragment } from 'react';
import { Button, Checkbox, DataTable, EmptyState, ExerciseCard, PageHeader, SearchField, SegmentedControl, Select, Sidebar, Tag, TopBar } from '@/ds';
import { PanelLayout } from '@/app/PanelLayout';
import { toast } from '@/lib/toast';
import { categoriesFor, EX_CATS, EX_EQUIP, EX_DIFF, ISSUES, LIBRARY_CREDIT, SPORT_LABEL, SPORTS } from '@/data/exercises';
import { pending } from '@/app/pending';
import { api, faError } from '@/data/api';
import { parseCsv } from '@/lib/csv';
import { faDigits } from '@/lib/format';
import { useQuery } from '@/data/hooks';
import { panelUser } from '@/data/session';
import { Screen, type ScreenState } from '../Screen';

/** Data container: the coach's exercise library. */
export default function CoachExerciseLibraryPage(props: { brand?: string }) {
  const list = useQuery('exercises', api.exercises.list);
  const wait = pending(list);
  if (wait) return wait;
  return <CoachExerciseLibrary {...props} exercises={list.data} />;
}

/** CSV column value → library key: accepts the key (`chest`) or its Persian label (`سینه`). */
const keyOf = (map: Record<string, string>, v: string, fallback: string) => {
  const t = (v || '').trim();
  return map[t] ? t : Object.keys(map).find((k) => map[k] === t) || fallback;
};

class CoachExerciseLibrary extends Screen {
  fileRef = createRef<HTMLInputElement>();

  /** Import rows `name, category, equipment, difficulty` (header row optional); existing names are skipped. */
  async importFile(f: File) {
    const rows = parseCsv(await f.text());
    if (rows.length && /name|نام/i.test(rows[0][0])) rows.shift();
    const have = new Set((this.props.exercises || []).map((e) => e.name.trim()));
    const todo = rows.filter((r) => r[0]?.trim() && !have.has(r[0].trim()));
    let ok = 0;
    for (const [name, cat, equip, diff] of todo) {
      try {
        await api.exercises.create({
          name: name.trim(),
          cat: keyOf(EX_CATS, cat, 'chest'),
          equip: keyOf(EX_EQUIP, equip, 'bodyweight'),
          diff: keyOf(EX_DIFF, diff, 'intermediate'),
          metrics: ['ست', 'تکرار', 'وزنه'],
        } as never);
        ok++;
      } catch (e) {
        toast('«' + name.trim() + '» وارد نشد', faError(e), 'error');
      }
    }
    toast('ورود فایل انجام شد', faDigits(ok) + ' حرکت اضافه شد' + (rows.length - todo.length ? ' · ' + faDigits(rows.length - todo.length) + ' تکراری رد شد' : ''));
  }

  state: ScreenState = { pg: 0, sports: [], cats: [], equip: 'any', diff: 'all', q: '', sort: 'used', view: 'grid', rk: 0, filtersOpen: false, band: false, issue: '' };
  renderVals() {
    const EX = this.props.exercises,
      CATS = EX_CATS || {},
      EQ = EX_EQUIP || {},
      DF = EX_DIFF || {};
    const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const { sports, cats, equip, diff, q, sort, view, rk, band, issue } = this.state;
    // «قابل انجام با کش»: band / mini-band exercises and those with a band alternative.
    const bandable = (e) => e.equip === 'band' || e.equip === 'loop_band' || !!e.alternatives?.band?.length;
    const PER = 24; // cards per page — keeps the page short (#51)
    let items = EX.filter(
      (e) =>
        (!sports.length || sports.includes(e.sport || 'fitness')) &&
        (!cats.length || cats.includes(e.cat)) &&
        (equip === 'any' || e.equip === equip) &&
        (diff === 'all' || e.diff === diff) &&
        (!band || bandable(e)) &&
        (!issue || (issue === 'any' ? !!e.issues?.length : e.issues?.includes(issue))) &&
        (!q.trim() || e.name.includes(q.trim())),
    );
    items = items.slice().sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'fa') : sort === 'video' ? Number(b.video) - Number(a.video) : b.used - a.used));
    const mapped = items.map((e) => ({
      ...e,
      catLabel: CATS[e.cat] || e.cat,
      sportLabel: SPORT_LABEL[e.sport || 'fitness'] || e.sport,
      equipLabel: EQ[e.equip],
      diffLabel: DF[e.diff],
      badgeLabel: e.badge === 'band' ? 'کش' : undefined,
      dur: e.dur ? fa(e.dur) : undefined,
      usage: 'در ' + fa(e.used) + ' برنامه استفاده شده',
      to: 'coach:exercise?id=' + e.id,
    }));
    // Category boxes follow the chosen sports (#75); categories no chosen sport has are dropped.
    const catsOf = (list: string[]) => (list.length ? [...new Set(list.flatMap((x) => categoriesFor(x)))] : Object.keys(CATS));
    const toggleSport = (id) =>
      this.setState((s) => {
        const next = s.sports.includes(id) ? s.sports.filter((x) => x !== id) : [...s.sports, id];
        const allowed = catsOf(next);
        return { pg: 0, sports: next, cats: s.cats.filter((c) => allowed.includes(c)) };
      });
    // Sports that actually have exercises in this library, fitness first.
    const libSports = SPORTS.filter(([k]) => ['fitness', 'running', 'swimming', 'cycling'].includes(k) || EX.some((e) => (e.sport || 'fitness') === k)).map(([k]) => k);
    const toggleCat = (id) => this.setState((s) => ({ pg: 0, cats: s.cats.includes(id) ? s.cats.filter((x) => x !== id) : [...s.cats, id] }));
    const tags = [
      ...sports.map((c) => ({ label: SPORT_LABEL[c], remove: () => toggleSport(c) })),
      ...cats.map((c) => ({ label: CATS[c], remove: () => toggleCat(c) })),
      ...(equip !== 'any' ? [{ label: EQ[equip], remove: () => this.setState({ equip: 'any', rk: rk + 1 }) }] : []),
      ...(diff !== 'all' ? [{ label: DF[diff], remove: () => this.setState({ diff: 'all', rk: rk + 1 }) }] : []),
      ...(band ? [{ label: 'قابل انجام با کش', remove: () => this.setState({ band: false, pg: 0 }) }] : []),
      ...(issue ? [{ label: issue === 'any' ? 'اصلاحی' : 'اصلاحی: ' + ISSUES[issue], remove: () => this.setState({ issue: '', pg: 0 }) }] : []),
    ];
    const pages = Math.max(1, Math.ceil(mapped.length / PER));
    const pg = Math.min(this.state.pg || 0, pages - 1);
    const pageItems = mapped.slice(pg * PER, pg * PER + PER);
    return {
      brand: this.props.brand ?? 'brand',
      user: panelUser({ name: 'علی احمدی', role: 'سرمربی' }),
      crumbs: [{ label: 'داشبورد', to: 'coach:dashboard' }, 'کتابخانه حرکات'],
      subtitle: fa(EX.length) + ' حرکت · ' + fa(EX.filter((e) => e.video).length) + ' با ویدیو · قابل استفاده در همه برنامه‌ها',
      importCsv: () => this.fileRef.current?.click(),
      fileRef: this.fileRef,
      onFile: (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void this.importFile(f);
      },
      sportBoxes: (libSports.length ? libSports : ['fitness']).map((id) => ({
        key: id + (sports.includes(id) ? '1' : '0'),
        label: SPORT_LABEL[id],
        count: fa(EX.filter((e) => (e.sport || 'fitness') === id).length),
        on: sports.includes(id),
        toggle: () => toggleSport(id),
      })),
      catBoxes: catsOf(sports).map((id) => ({ key: id + (cats.includes(id) ? '1' : '0'), label: CATS[id], on: cats.includes(id), toggle: () => toggleCat(id) })),
      equip,
      equipKey: 'eq' + rk,
      setEquip: (v) => this.setState({ equip: v, pg: 0 }),
      equipOpts: [{ value: 'any', label: 'همه تجهیزات' }, ...Object.keys(EQ).map((k) => ({ value: k, label: EQ[k] }))],
      diff,
      diffKey: 'df' + rk,
      setDiff: (v) => this.setState({ diff: v, pg: 0 }),
      diffOpts: [
        { value: 'all', label: 'همه' },
        { value: 'beginner', label: 'مبتدی' },
        { value: 'intermediate', label: 'متوسط' },
        { value: 'advanced', label: 'پیشرفته' },
      ],
      hasFilters: tags.length > 0,
      filtersOpen: !!this.state.filtersOpen,
      toggleFilters: () => this.setState({ filtersOpen: !this.state.filtersOpen }),
      clearAll: () => this.setState({ pg: 0, sports: [], cats: [], equip: 'any', diff: 'all', band: false, issue: '', rk: rk + 1 }),
      band,
      bandCount: fa(EX.filter(bandable).length),
      toggleBand: () => this.setState({ band: !band, pg: 0 }),
      issue,
      corrective: !!issue,
      toggleCorrective: () => this.setState({ issue: issue ? '' : 'any', pg: 0 }),
      issueOpts: [
        { value: 'any', label: 'همه مشکلات' },
        ...Object.entries(ISSUES).map(([k, label]) => ({ value: k, label: label + ' (' + fa(EX.filter((e) => e.issues?.includes(k)).length) + ')' })),
      ],
      setIssue: (v) => this.setState({ issue: v, pg: 0 }),
      setQ: (v) => this.setState({ q: v, pg: 0 }),
      sortOpts: [
        { value: 'used', label: 'مرتب‌سازی: پرکاربردترین' },
        { value: 'name', label: 'مرتب‌سازی: الفبا' },
        { value: 'video', label: 'مرتب‌سازی: دارای ویدیو' },
      ],
      setSort: (v) => this.setState({ sort: v, pg: 0 }),
      views: [
        { value: 'grid', label: 'شبکه', icon: 'grid' },
        { value: 'list', label: 'فهرست', icon: 'list' },
      ],
      setView: (v) => this.setState({ view: v }),
      activeTags: tags,
      shownLabel: fa(items.length) + ' از ' + fa(EX.length) + ' نمایش داده شده',
      empty: items.length === 0,
      isGrid: view === 'grid' && items.length > 0,
      isList: view === 'list' && items.length > 0,
      items: pageItems,
      pages,
      pg,
      pageLabel: 'صفحه ' + fa(pg + 1) + ' از ' + fa(pages),
      prevPage: () => (this.setState({ pg: Math.max(0, pg - 1) }), window.scrollTo({ top: 0, behavior: 'smooth' })),
      nextPage: () => (this.setState({ pg: Math.min(pages - 1, pg + 1) }), window.scrollTo({ top: 0, behavior: 'smooth' })),
      columns: [
        { key: 'n', label: 'حرکت' },
        { key: 'c', label: 'دسته' },
        { key: 'eq', label: 'تجهیزات' },
        { key: 'd', label: 'سطح' },
        { key: 'v', label: 'ویدیو', type: 'badge' },
        { key: 'u', label: 'استفاده', type: 'number', align: 'right' },
      ],
      rows: pageItems.map((e) => ({
        id: e.id,
        n: e.name,
        c: e.catLabel,
        eq: e.equipLabel,
        d: e.diffLabel,
        v: e.video ? { label: 'دارد', tone: 'success', icon: 'play' } : null,
        u: e.used,
        to: 'coach:exercise?id=' + e.id,
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
          <PageHeader title="کتابخانه حرکات" subtitle={v.subtitle}>
            <input ref={v.fileRef} type="file" accept=".csv,text/csv" onChange={v.onFile} style={{ display: 'none' }} />
            <Button variant="secondary" icon="upload" onClick={v.importCsv}>
              ورود فایل
            </Button>
            <Button variant="primary" icon="plus" to="coach:create-exercise">
              ایجاد حرکت
            </Button>
          </PageHeader>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
            <div
              className={'bl-collapse-mobile bl-unstick-mobile' + (v.filtersOpen ? ' is-open' : '')}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                minWidth: '0',
                // Filters stay in view while scrolling the grid (#51).
                position: 'sticky',
                top: '16px',
                maxHeight: 'calc(100vh - 32px)',
                overflowY: 'auto',
              }}
            >
              <div className="bl-collapse-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: '0', fontSize: '16px', lineHeight: '24px', fontWeight: '600' }}>
                  <button type="button" className="bl-collapse-toggle" aria-expanded={v.filtersOpen} onClick={v.toggleFilters}>
                    فیلترها{v.hasFilters ? ' •' : ''}
                  </button>
                  <span className="bl-collapse-title">فیلترها</span>
                </h3>
                {v.hasFilters ? (
                  <>
                    <button
                      type="button"
                      onClick={v.clearAll}
                      style={{ border: '0', background: 'none', padding: '0', font: "500 13px/20px 'Vazirmatn',sans-serif", color: 'var(--brand-primary-text)', cursor: 'pointer' }}
                    >
                      پاک کردن همه
                    </button>
                  </>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '16px', color: 'var(--text-muted)', fontWeight: '600' }}>نوع</p>
                <Checkbox key={'band' + v.band} label="قابل انجام با کش" description={v.bandCount + ' حرکت'} checked={v.band} onChange={v.toggleBand} />
                <Checkbox key={'corr' + v.corrective} label="اصلاحی" description="بر اساس مشکل" checked={v.corrective} onChange={v.toggleCorrective} />
                {v.corrective ? <Select value={v.issue} options={v.issueOpts} onChange={v.setIssue} /> : null}
              </div>
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '16px', color: 'var(--text-muted)', fontWeight: '600' }}>رشته</p>
                {v.sportBoxes.map((c) => (
                  <Checkbox key={c.key} label={c.label} description={c.count + ' حرکت'} checked={c.on} onChange={c.toggle} />
                ))}
              </div>
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '16px', color: 'var(--text-muted)', fontWeight: '600' }}>دسته</p>
                {(v.catBoxes || []).map((c: any, $index: number) => (
                  <Fragment key={$index}>
                    <Checkbox label={c?.label} checked={c?.on} onChange={c?.toggle} />
                  </Fragment>
                ))}
              </div>
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '16px', color: 'var(--text-muted)', fontWeight: '600' }}>تجهیزات</p>
                <Select value={v.equip} options={v.equipOpts} onChange={v.setEquip} />
              </div>
              <div style={{ height: '1px', background: 'var(--border-subtle)' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' }}>
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '16px', color: 'var(--text-muted)', fontWeight: '600' }}>سطح</p>
                <SegmentedControl options={v.diffOpts} value={v.diff} onChange={v.setDiff} size="sm" fullWidth />
              </div>
            </div>
            <div style={{ gridColumn: 'span 3', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <SearchField placeholder="جستجوی حرکت" onChange={v.setQ} />
                <div style={{ width: '200px' }}>
                  <Select value="used" options={v.sortOpts} onChange={v.setSort} />
                </div>
                <SegmentedControl options={v.views} value="grid" onChange={v.setView} label="نما" />
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', minHeight: '32px' }}>
                {(v.activeTags || []).map((t: any, $index: number) => (
                  <Fragment key={$index}>
                    <Tag removable onRemove={t?.remove}>
                      {t?.label}
                    </Tag>
                  </Fragment>
                ))}
                <p style={{ margin: '0', fontSize: '12px', lineHeight: '18px', color: 'var(--text-muted)' }}>{v.shownLabel}</p>
              </div>
              {v.isGrid ? (
                <>
                  <div className="bl-two-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '16px', alignItems: 'start' }}>
                    {(v.items || []).map((e: any, $index: number) => (
                      <Fragment key={$index}>
                        <ExerciseCard
                          name={e?.name}
                          category={e?.catLabel}
                          equipment={e?.equipLabel}
                          sport={e?.sportLabel}
                          badge={e?.badgeLabel}
                          imageSrc={e?.imageSrc}
                          difficulty={e?.diffLabel}
                          hasVideo={e?.video}
                          duration={e?.dur}
                          metrics={e?.metrics}
                          usage={e?.usage}
                          to={e?.to}
                        />
                      </Fragment>
                    ))}
                  </div>
                </>
              ) : null}
              {v.isList ? (
                <>
                  <DataTable columns={v.columns} rows={v.rows} emptyTitle="حرکتی یافت نشد" />
                </>
              ) : null}
              {v.pages > 1 ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                  <Button variant="secondary" size="sm" icon="chevron-right" disabled={v.pg === 0} onClick={v.prevPage}>
                    قبلی
                  </Button>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{v.pageLabel}</span>
                  <Button variant="secondary" size="sm" iconRight="chevron-left" disabled={v.pg >= v.pages - 1} onClick={v.nextPage}>
                    بعدی
                  </Button>
                </div>
              ) : null}
              <a href={LIBRARY_CREDIT.href} target="_blank" rel="noreferrer" dir="ltr" style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Illustrations: {LIBRARY_CREDIT.text}
              </a>
              {v.empty ? (
                <>
                  <EmptyState
                    icon="search"
                    title="حرکتی یافت نشد"
                    description="فیلترها را تغییر دهید یا حرکت جدیدی بسازید."
                    actionLabel="ایجاد حرکت"
                    actionTo="coach:create-exercise"
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </PanelLayout>
    );
  }
}
