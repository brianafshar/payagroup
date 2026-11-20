import { Link } from "react-router-dom";
import { S, tr, useLang } from "../i18n";

export default function Footer() {
  const lang = useLang();
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <img src="/brand/paya-primary-reversed.svg" alt="Paya" height={72} />
        <div>
          <h4>{tr(S.footer.contact, lang)}</h4>
          <p>{tr(S.footer.address, lang)}</p>
          <p>{tr(S.footer.phone, lang)}</p>
          <p>payagroup.org</p>
        </div>
        <div className="footer-links">
          <Link to={`/${lang}/basketball`}>{tr(S.nav.basketball, lang)}</Link>
          <Link to={`/${lang}/bodybuilding`}>{tr(S.nav.bodybuilding, lang)}</Link>
          <Link to={`/${lang}/exercises`}>{tr(S.nav.exercises, lang)}</Link>
        </div>
      </div>
      <p className="copy">© {new Date().getFullYear()} Paya Group. {tr(S.footer.rights, lang)}</p>
    </footer>
  );
}
