import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { S, tr, useLang } from "../i18n";

const ITEMS = [
  { key: "home", path: "" },
  { key: "basketball", path: "basketball" },
  { key: "bodybuilding", path: "bodybuilding" },
  { key: "exercises", path: "exercises" },
  { key: "contact", path: "contact" },
] as const;

export default function Nav() {
  const lang = useLang();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const other = lang === "fa" ? "en" : "fa";
  const switchPath = pathname.replace(/^\/(fa|en)/, `/${other}`);
  const fa = (n: number) => (lang === "fa" ? String(n).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]) : String(n).padStart(2, "0"));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const active = ITEMS.findIndex((i) => pathname.replace(/\/$/, "") === `/${lang}${i.path ? "/" + i.path : ""}`);
  const shown = hover ?? (active >= 0 ? active : 0);

  return (
    <>
      <header className="bar">
        <Link to={`/${lang}`} className="bar-logo" aria-label="Paya">
          <img src="/brand/paya-primary-color.svg" alt="Paya" height={56} />
        </Link>
        <div className="bar-actions">
          <Link to={switchPath} className="lang">{tr(S.nav.switchTo, lang)}</Link>
          <button className="menu-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className="menu-label">{tr(open ? S.nav.close : S.nav.menu, lang)}</span>
            <span className={`burger${open ? " x" : ""}`}><i /><i /></span>
          </button>
        </div>
      </header>

      <nav className={`overlay${open ? " open" : ""}`} aria-hidden={!open}>
        <ul className={`nav-list${hover !== null ? " has-hover" : ""}`} onMouseLeave={() => setHover(null)}>
          {ITEMS.map((it, i) => (
            <li key={it.key} className={i === shown ? "on" : ""} style={{ ["--i" as string]: i }}>
              <Link to={`/${lang}${it.path ? "/" + it.path : ""}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={open ? 0 : -1}>
                <span className="num">{fa(i + 1)}</span>
                <span className="name">{tr(S.nav[it.key], lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <aside className="nav-side">
          <div className="big-n">{fa(shown + 1)}</div>
          <p>{tr(S.hint[ITEMS[shown].key], lang)}</p>
        </aside>
      </nav>
    </>
  );
}
