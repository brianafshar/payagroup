import { Link } from "react-router-dom";
import { S, tr, useLang } from "../i18n";
import { useExercises, useTitle } from "../hooks";
import ExerciseCard from "../components/ExerciseCard";

export default function Home() {
  const lang = useLang();
  useTitle("");
  const { data } = useExercises();
  const items = [
    { to: "basketball", t: S.nav.basketball, n: "01" },
    { to: "bodybuilding", t: S.nav.bodybuilding, n: "02" },
  ];
  return (
    <>
      <section className="hero">
        <img className="hero-symbol" src="/brand/paya-symbol-reversed.svg" alt="" aria-hidden />
        <div className="wrap">
          <p className="kicker">{tr(S.home.kicker, lang)}</p>
          <h1 className="display">PAYA</h1>
          <p className="lead">{tr(S.home.tagline, lang)}</p>
        </div>
        <span className="scroll">{tr(S.home.scroll, lang)} ↓</span>
      </section>

      <div className="marquee" aria-hidden>
        <div>{Array.from({ length: 8 }).map((_, i) => <span key={i}>BASKETBALL ✦ BODYBUILDING ✦ SINCE 2007 ✦ </span>)}</div>
      </div>

      <section className="wrap section about">
        <h2 data-reveal>{tr(S.home.aboutTitle, lang)}</h2>
        <p data-reveal className="about-text">{tr(S.home.aboutText, lang)}</p>
        <div className="stats">
          {S.home.stats.map((s) => (
            <div key={s.n} data-reveal><b>{s.n}</b><span>{tr(s.l, lang)}</span></div>
          ))}
        </div>
      </section>

      <section className="wrap section">
        <h2 data-reveal>{tr(S.home.disciplines, lang)}</h2>
        <div className="disc">
          {items.map((it) => (
            <Link key={it.to} to={`/${lang}/${it.to}`} className="disc-card" data-reveal>
              <span className="disc-n">{it.n}</span>
              <span className="disc-t">{tr(it.t, lang)}</span>
              <span className="disc-go">{tr(S.home.explore, lang)} →</span>
            </Link>
          ))}
          <div className="disc-card soon" data-reveal>{tr(S.home.soon, lang)}</div>
        </div>
      </section>

      <section className="wrap section">
        <div className="row-head">
          <h2 data-reveal>{tr(S.home.exTitle, lang)}</h2>
          <Link to={`/${lang}/exercises`} className="link">{tr(S.home.exAll, lang)} →</Link>
        </div>
        <div className="grid">{data?.slice(0, 4).map((e) => <ExerciseCard key={e.id} ex={e} />)}</div>
      </section>

      <section className="wrap section app">
        <h2 data-reveal>{tr(S.home.appTitle, lang)}</h2>
        <p data-reveal>{tr(S.home.appText, lang)}</p>
      </section>
    </>
  );
}
