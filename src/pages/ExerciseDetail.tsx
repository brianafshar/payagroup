import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { S, tr, useLang } from "../i18n";
import { loadExercise, parseSlug } from "../api";
import { useLocalized, useTitle } from "../hooks";
import { CATEGORY, DIFFICULTY, EQUIPMENT, SPORT, label } from "../data/labels";
import type { Exercise } from "../types";

export default function ExerciseDetail() {
  const lang = useLang();
  const L = useLocalized();
  const { slug } = useParams();
  const [ex, setEx] = useState<Exercise | null | undefined>(undefined);

  useEffect(() => {
    const id = parseSlug(slug);
    if (id === null) return setEx(null);
    setEx(undefined);
    loadExercise(id).then(setEx, () => setEx(null));
  }, [slug]);

  useTitle(ex ? L.name(ex) : "");
  const back = <Link to={`/${lang}/exercises`} className="link">← {tr(S.ex.back, lang)}</Link>;

  if (ex === undefined) return <section className="wrap section page-head"><p className="state">{tr(S.ex.loading, lang)}</p></section>;
  if (ex === null) return <section className="wrap section page-head"><p className="state">{tr(S.ex.notFound, lang)}</p>{back}</section>;

  const steps = L.steps(ex);
  const tips = L.tips(ex);
  const meta: [string, string][] = [
    [tr(S.ex.category, lang), label(CATEGORY, ex.category, lang)],
    [tr(S.ex.sport, lang), label(SPORT, ex.sport, lang)],
    [tr(S.ex.equipment, lang), label(EQUIPMENT, ex.equipment, lang)],
    [tr(S.ex.level, lang), label(DIFFICULTY, ex.difficulty, lang)],
  ];

  return (
    <section className="wrap section detail">
      {back}
      <h1 className="display sm">{L.name(ex)}</h1>
      <div className="detail-grid">
        <div>
          <div className="player">
            {ex.video_url ? (
              <video src={ex.video_url} poster={ex.image_url || undefined} controls playsInline preload="metadata" />
            ) : (
              <div className="player-ph">{tr(S.ex.noVideo, lang)}</div>
            )}
          </div>
          <p className="about-text">{L.desc(ex)}</p>
        </div>
        <aside>
          <dl className="meta">
            {meta.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
          </dl>
          {steps.length > 0 && (<><h3>{tr(S.ex.how, lang)}</h3><ol className="steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol></>)}
          {tips.length > 0 && (<><h3>{tr(S.ex.tips, lang)}</h3><ul className="tips">{tips.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
        </aside>
      </div>
    </section>
  );
}
