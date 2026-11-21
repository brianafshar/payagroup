import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { S, tr, useLang } from "../i18n";

const ITEMS = [
  { key: "home", path: "" },
  { key: "basketball", path: "basketball" },
  { key: "bodybuilding", path: "elite" },
  { key: "exercises", path: "exercises" },
  { key: "contact", path: "contact" },
] as const;

export default function Nav() {
  const lang = useLang();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const other = lang === "fa" ? "en" : "fa";
  const switchPath = pathname.replace(/^\/(fa|en)/, `/${other}`);
  const rest = pathname.replace(/^\/(fa|en)\/?/, "");
  const isOn = (p: string) => (p === "" ? rest === "" : rest === p || rest.startsWith(p + "/"));
  const fa = (n: number) => (lang === "fa" ? String(n).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]) : String(n).padStart(2, "0"));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="bar">
        <Link to={`/${lang}`} className="bar-logo" aria-label="Paya">
          <img src="/brand/paya-symbol-reversed.svg" alt="Paya" height={34} />
        </Link>
        <nav className="links" aria-label="main">
          {ITEMS.map((it) => (
            <Link key={it.key} to={`/${lang}${it.path ? "/" + it.path : ""}`} className={isOn(it.path) ? "on" : ""}>
              {tr(S.nav[it.key], lang)}
            </Link>
          ))}
        </nav>
        <div className="bar-actions">
          <Link to={switchPath} className="lang">{tr(S.nav.switchTo, lang)}</Link>
          <button className="menu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={tr(S.nav.menu, lang)}>
            <span className={`burger${open ? " x" : ""}`}><i /><i /></span>
          </button>
        </div>
      </header>

      <nav className={`overlay${open ? " open" : ""}`} aria-hidden={!open}>
        <ul className="nav-list">
          {ITEMS.map((it, i) => (
            <li key={it.key} className={isOn(it.path) ? "on" : ""} style={{ ["--i" as string]: i }}>
              <Link to={`/${lang}${it.path ? "/" + it.path : ""}`} tabIndex={open ? 0 : -1}>
                <span className="num">{fa(i + 1)}</span>
                <span className="name">{tr(S.nav[it.key], lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
