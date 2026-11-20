import { Link } from "react-router-dom";
import { S, tr, useLang } from "../i18n";
import { useExercises, useTitle } from "../hooks";
import ExerciseCard from "../components/ExerciseCard";

type Kind = "basketball" | "bodybuilding";

// Placeholder content, replace with real text later.
const C = {
  basketball: {
    sport: "basketball",
    title: S.nav.basketball,
    lead: { fa: "از مینی‌بسکت تا تیم‌های حرفه‌ای، مهارت و کار تیمی را اینجا بساز.", en: "From mini-basketball to competitive squads, build skill and teamwork here." },
    text: { fa: "کلاس‌های بسکتبال پایا برای همه‌ی سطح‌ها برگزار می‌شود: تمرین مهارت‌های پایه، دریبل، شوت، دفاع و بازی تیمی با مربی‌های باتجربه. (متن نمونه)", en: "Paya basketball runs classes for every level: fundamentals, dribbling, shooting, defense and team play with experienced coaches. (sample text)" },
    days: [
      { d: { fa: "شنبه و دوشنبه", en: "Sat & Mon" }, t: { fa: "۱۷:۰۰ – ۱۹:۰۰ · نوجوانان", en: "5:00 – 7:00 PM · Juniors" } },
      { d: { fa: "یکشنبه و سه‌شنبه", en: "Sun & Tue" }, t: { fa: "۱۹:۰۰ – ۲۱:۰۰ · بزرگسالان", en: "7:00 – 9:00 PM · Adults" } },
    ],
  },
  bodybuilding: {
    sport: "fitness",
    title: S.nav.bodybuilding,
    lead: { fa: "قدرت و حجم با برنامه‌ی شخصی و پیگیری هر ست.", en: "Strength and size with a personal plan and every set tracked." },
    text: { fa: "سالن بدنسازی پایا مجهز به وزنه‌های آزاد و دستگاه‌هاست. برنامه‌ی تمرینی شخصی در اپ پایا ثبت می‌شود و مربی پیشرفتت را دنبال می‌کند. (متن نمونه)", en: "Paya’s gym is equipped with free weights and machines. Your personal program lives in the Paya app and your coach tracks your progress. (sample text)" },
    days: [
      { d: { fa: "همه‌ی روزهای هفته", en: "Every day" }, t: { fa: "۶:۰۰ – ۲۲:۰۰", en: "6:00 AM – 10:00 PM" } },
    ],
  },
} as const;

const COACHES = [
  { fa: "مربی نمونه ۱", en: "Coach Sample 1" },
  { fa: "مربی نمونه ۲", en: "Coach Sample 2" },
  { fa: "مربی نمونه ۳", en: "Coach Sample 3" },
];

export default function Sport({ kind }: { kind: Kind }) {
  const lang = useLang();
  const c = C[kind];
  useTitle(tr(c.title, lang));
  const { data } = useExercises();
  const related = (data ?? []).filter((e) => e.sport === c.sport).slice(0, 4);
  return (
    <>
      <section className="hero sm">
        <div className="wrap">
          <p className="kicker">{kind === "basketball" ? "01" : "02"}</p>
          <h1 className="display">{tr(c.title, lang)}</h1>
          <p className="lead">{tr(c.lead, lang)}</p>
        </div>
      </section>

      <section className="wrap section two">
        <div>
          <h2 data-reveal>{tr(S.sport.about, lang)}</h2>
          <p data-reveal className="about-text">{tr(c.text, lang)}</p>
        </div>
        <div>
          <h2 data-reveal>{tr(S.sport.schedule, lang)}</h2>
          <ul className="sched">
            {c.days.map((r, i) => (
              <li key={i} data-reveal><b>{tr(r.d, lang)}</b><span>{tr(r.t, lang)}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="wrap section">
        <h2 data-reveal>{tr(S.sport.coaches, lang)}</h2>
        <div className="coaches">
          {COACHES.map((m, i) => (
            <div key={i} className="coach" data-reveal><div className="avatar">{i + 1}</div>{m[lang]}</div>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="wrap section">
          <div className="row-head">
            <h2 data-reveal>{tr(S.sport.related, lang)}</h2>
            <Link to={`/${lang}/exercises?sport=${c.sport}`} className="link">{tr(S.sport.seeAll, lang)} →</Link>
          </div>
          <div className="grid">{related.map((e) => <ExerciseCard key={e.id} ex={e} />)}</div>
        </section>
      )}
    </>
  );
}
