import { Link } from "react-router-dom";
import { S, tr, useLang } from "../i18n";
import { useExercises, useTitle } from "../hooks";
import { BASKETBALL, BODYBUILDING, HOME } from "../data/content";
import ExerciseCard from "../components/ExerciseCard";
import HScroll from "../components/HScroll";
import { Panel, PanelHead } from "../components/Panel";

export default function Sport({ kind }: { kind: "basketball" | "bodybuilding" }) {
  const lang = useLang();
  const c = kind === "basketball" ? BASKETBALL : BODYBUILDING;
  const t = (b: { fa: string; en: string }) => b[lang];
  useTitle(t(c.title));
  const { data } = useExercises();
  const related = (data ?? []).filter((e) => e.sport === c.sport).slice(0, 5);

  return (
    <HScroll>
      <Panel className={`p-sport dark ${kind}`}>
        <div className="sport-bg" aria-hidden />
        <div className="hero-copy">
          <p className="kicker">{c.n}</p>
          <h1 className="display">{t(c.title)}</h1>
          <p className="lead">{t(c.lead)}</p>
          <span className="hint">{lang === "fa" ? "← برای ادامه اسکرول کنید" : "Scroll to explore →"}</span>
        </div>
      </Panel>

      <Panel>
        <PanelHead n="01" title={t(c.overviewTitle)} />
        <div className="cols">
          <div><p data-reveal className="body-lg">{t(c.p1)}</p><p data-reveal className="body-lg">{t(c.p2)}</p></div>
          <div className="stats two-col">
            {c.highlights.map((h, i) => (<div key={i} data-reveal><b>{h.n}</b><span>{t(h.l)}</span></div>))}
          </div>
        </div>
      </Panel>

      <Panel className="soft">
        <PanelHead n="02" title={t(c.levelsTitle)} />
        <div className="levels">
          {c.levels.map((l, i) => (
            <div key={i} className="level" data-reveal><span className="chip-age">{t(l.age)}</span><h3>{t(l.t)}</h3><p>{t(l.d)}</p></div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHead n="03" title={t(c.scheduleTitle)} />
        <ul className="sched">
          {c.schedule.map((r, i) => (
            <li key={i} data-reveal><b>{t(r.d)}</b><span>{t(r.t)}</span><em>{t(r.l)}</em></li>
          ))}
        </ul>
      </Panel>

      <Panel className="soft">
        <PanelHead n="04" title={t(c.coachesTitle)} />
        <div className="coaches">
          {c.coaches.map((m, i) => (
            <div key={i} className="coach" data-reveal><div className="avatar">{i + 1}</div><div><b>{t(m.n)}</b><span>{t(m.r)}</span></div></div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHead n="05" title={t(c.methodTitle)} />
        <ol className="method">
          {c.method.map((m, i) => (
            <li key={i} data-reveal><span>{String(i + 1).padStart(2, "0")}</span><h3>{t(m.t)}</h3><p>{t(m.d)}</p></li>
          ))}
        </ol>
      </Panel>

      <Panel className="soft">
        <PanelHead n="06" title={t(c.facilitiesTitle)} />
        <ul className="points big">
          {c.facilities.map((f, i) => <li key={i} data-reveal>{t(f)}</li>)}
        </ul>
      </Panel>

      {related.length > 0 && (
        <Panel className="wide">
          <div className="row-head">
            <PanelHead n="07" title={tr(S.sport.related, lang)} />
            <Link to={`/${lang}/exercises?sport=${c.sport}`} className="link">{tr(S.sport.seeAll, lang)} →</Link>
          </div>
          <div className="cards-row">{related.map((e) => <ExerciseCard key={e.id} ex={e} />)}</div>
        </Panel>
      )}

      <Panel className="soft">
        <PanelHead n={related.length > 0 ? "08" : "07"} title={t(c.faqTitle)} />
        <div className="faq">
          {c.faq.map((f, i) => (
            <details key={i} data-reveal><summary>{t(f.q)}</summary><p>{t(f.a)}</p></details>
          ))}
        </div>
      </Panel>

      <Panel className="p-contact dark">
        <PanelHead title={t(c.ctaTitle)} />
        <p className="body-lg" data-reveal>{t(c.ctaText)}</p>
        <div className="contact-lines" data-reveal>
          <p>{tr(S.footer.address, lang)}</p>
          <p>{tr(S.footer.phone, lang)}</p>
          <p>{HOME.email}</p>
        </div>
        <Link to={`/${lang}/contact`} className="btn">{tr(S.nav.contact, lang)} →</Link>
      </Panel>
    </HScroll>
  );
}
