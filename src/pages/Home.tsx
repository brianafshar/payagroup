import { Link } from "react-router-dom";
import { S, tr, useLang } from "../i18n";
import { useExercises, usePageSeo } from "../hooks";
import { HOME as H } from "../data/content";
import ExerciseCard from "../components/ExerciseCard";
import HScroll from "../components/HScroll";
import { Panel, PanelHead } from "../components/Panel";

export default function Home() {
  const lang = useLang();
  usePageSeo("home");
  const { data } = useExercises();
  const t = (b: { fa: string; en: string }) => b[lang];

  return (
    <HScroll>
      <Panel className="p-hero">
        <img className="hero-symbol" src="/brand/paya-symbol-color.svg" alt="" aria-hidden />
        <div className="hero-copy">
          <p className="kicker">{tr(S.home.kicker, lang)}</p>
          <h1 className="display">PAYA</h1>
          <p className="lead">{tr(S.home.tagline, lang)}</p>
          <span className="hint">{lang === "fa" ? "← برای ادامه اسکرول کنید" : "Scroll to explore →"}</span>
        </div>
      </Panel>

      <Panel className="soft">
        <PanelHead n="01" title={t(H.about.title)} />
        <div className="cols">
          <div>
            <p data-reveal className="body-lg">{t(H.about.p1)}</p>
            <p data-reveal className="body-lg">{t(H.about.p2)}</p>
          </div>
          <div className="values">
            {H.about.values.map((v, i) => (
              <div key={i} data-reveal className="value"><b>{t(v.t)}</b><span>{t(v.d)}</span></div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHead n="02" title={t(H.journeyTitle)} />
        <div className="stats">
          {H.stats.map((s) => (<div key={s.n} data-reveal><b>{s.n}</b><span>{t(s.l)}</span></div>))}
        </div>
        <ol className="timeline">
          {H.timeline.map((x) => (<li key={x.y} data-reveal><b>{x.y}</b><span>{t(x.t)}</span></li>))}
        </ol>
      </Panel>

      <Panel className="soft">
        <PanelHead n="03" title={t(H.discTitle)} />
        <div className="disc">
          <Link to={`/${lang}/basketball`} className="disc-card bball" data-reveal>
            <span className="disc-n">01</span>
            <span><span className="disc-t">{tr(S.nav.basketball, lang)}</span><small>{t(H.basketballSub)}</small></span>
            <span className="disc-go">{t(H.explore)} →</span>
          </Link>
          <Link to={`/${lang}/elite`} className="disc-card bbuild" data-reveal>
            <span className="disc-n">02</span>
            <span><span className="disc-t">{tr(S.nav.bodybuilding, lang)}</span><small>{t(H.bodybuildingSub)}</small></span>
            <span className="disc-go">{t(H.explore)} →</span>
          </Link>
          <div className="disc-card soon" data-reveal>{t(H.soon)}</div>
        </div>
      </Panel>

      <Panel>
        <PanelHead n="04" title={t(H.whyTitle)} />
        <div className="why">
          {H.why.map((w, i) => (
            <div key={i} data-reveal className="why-item"><span>{String(i + 1).padStart(2, "0")}</span><h3>{t(w.t)}</h3><p>{t(w.d)}</p></div>
          ))}
        </div>
      </Panel>

      <Panel className="soft wide">
        <div className="row-head">
          <PanelHead n="05" title={t(H.exTitle)} />
          <Link to={`/${lang}/exercises`} className="link">{t(H.exAll)} →</Link>
        </div>
        <div className="cards-row">{data?.slice(0, 5).map((e) => <ExerciseCard key={e.id} ex={e} />)}</div>
      </Panel>

      <Panel>
        <PanelHead n="06" title={t(H.plansTitle)} />
        <div className="plans">
          {H.plans.map((p, i) => (
            <div key={i} className="plan" data-reveal>
              <h3>{t(p.t)}</h3><p>{t(p.d)}</p>
              <ul>{p.f.map((f, j) => <li key={j}>{t(f)}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="note">{t(H.plansNote)}</p>
      </Panel>

      <Panel className="soft">
        <PanelHead n="07" title={t(H.voicesTitle)} />
        <div className="voices">
          {H.voices.map((v, i) => (<blockquote key={i} data-reveal><p>“{t(v.q)}”</p><cite>— {t(v.a)}</cite></blockquote>))}
        </div>
      </Panel>

      <Panel>
        <PanelHead n="08" title={t(H.appTitle)} />
        <div className="cols">
          <p data-reveal className="body-lg">{t(H.appText)}</p>
          <ul className="points" data-reveal>{H.appPoints.map((p, i) => <li key={i}>{t(p)}</li>)}</ul>
        </div>
      </Panel>

      <Panel className="p-contact dark">
        <PanelHead n="09" title={t(H.contactTitle)} />
        <p className="body-lg" data-reveal>{t(H.contactText)}</p>
        <div className="contact-lines" data-reveal>
          <p>{tr(S.footer.address, lang)}</p>
          <p>{tr(S.footer.phone, lang)}</p>
          <p>{t(H.hours)}</p>
          <p>{H.email} · payagroup.org</p>
        </div>
        <p className="copy-l">© <span suppressHydrationWarning>{new Date().getFullYear()}</span> Paya Group. {tr(S.footer.rights, lang)}</p>
      </Panel>
    </HScroll>
  );
}
