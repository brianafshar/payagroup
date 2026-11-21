import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { S, tr, useLang } from "../i18n";
import { useExercises, useLocalized, usePageSeo } from "../hooks";
import { CATEGORY, SPORT, label } from "../data/labels";
import ExerciseCard from "../components/ExerciseCard";

export default function Exercises() {
  const lang = useLang();
  const L = useLocalized();
  usePageSeo("exercises");
  const { data, error, retry } = useExercises();
  const [sp, setSp] = useSearchParams();
  const sport = sp.get("sport") ?? "";
  const cat = sp.get("cat") ?? "";
  const q = sp.get("q") ?? "";

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };

  const sports = useMemo(() => [...new Set((data ?? []).map((e) => e.sport))], [data]);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    (data ?? []).filter((e) => !sport || e.sport === sport).forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + 1));
    return [...m.entries()];
  }, [data, sport]);

  const list = (data ?? []).filter((e) => {
    if (sport && e.sport !== sport) return false;
    if (cat && e.category !== cat) return false;
    if (q) {
      const hay = `${e.name} ${e.name_en ?? ""} ${L.desc(e)}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <section className="wrap section page-head">
      <h1 className="display sm">{tr(S.ex.title, lang)}</h1>
      <p className="lead">{tr(S.ex.sub, lang)}</p>

      <input className="search" value={q} onChange={(e) => set("q", e.target.value)} placeholder={tr(S.ex.search, lang)} />

      <div className="chips" aria-label={tr(S.ex.sport, lang)}>
        <button className={!sport ? "on" : ""} onClick={() => { set("sport", ""); set("cat", ""); }}>{tr(S.ex.all, lang)}</button>
        {sports.map((s) => (
          <button key={s} className={sport === s ? "on" : ""} onClick={() => { set("sport", s); set("cat", ""); }}>{label(SPORT, s, lang)}</button>
        ))}
      </div>
      <div className="chips sub" aria-label={tr(S.ex.category, lang)}>
        <button className={!cat ? "on" : ""} onClick={() => set("cat", "")}>{tr(S.ex.all, lang)}</button>
        {cats.map(([c, n]) => (
          <button key={c} className={cat === c ? "on" : ""} onClick={() => set("cat", c)}>{label(CATEGORY, c, lang)} <em>{n}</em></button>
        ))}
      </div>

      {error ? (
        <p className="state">{tr(S.ex.error, lang)} <button className="link" onClick={retry}>{tr(S.ex.retry, lang)}</button></p>
      ) : !data ? (
        <p className="state">{tr(S.ex.loading, lang)}</p>
      ) : list.length === 0 ? (
        <p className="state">{tr(S.ex.empty, lang)}</p>
      ) : (
        <div className="grid">{list.map((e) => <ExerciseCard key={e.id} ex={e} />)}</div>
      )}
    </section>
  );
}
