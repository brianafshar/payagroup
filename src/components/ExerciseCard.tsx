import { Link } from "react-router-dom";
import { exerciseSlug } from "../api";
import { useLocalized } from "../hooks";
import { CATEGORY, label } from "../data/labels";
import { useLang } from "../i18n";
import type { Exercise } from "../types";

export default function ExerciseCard({ ex }: { ex: Exercise }) {
  const lang = useLang();
  const L = useLocalized();
  return (
    <Link to={`/${lang}/exercises/${exerciseSlug(ex)}`} className="card" data-reveal>
      <div className="thumb">
        {ex.image_url ? (
          <img src={ex.image_url} alt="" loading="lazy" />
        ) : ex.video_url ? (
          <video src={`${ex.video_url}#t=0.5`} preload="metadata" muted playsInline />
        ) : (
          <div className="thumb-ph">▶</div>
        )}
        <span className="play">▶</span>
        {ex.duration && <span className="dur">{ex.duration}</span>}
      </div>
      <div className="card-body">
        <span className="tag">{label(CATEGORY, ex.category, lang)}</span>
        <h3>{L.name(ex)}</h3>
      </div>
    </Link>
  );
}
