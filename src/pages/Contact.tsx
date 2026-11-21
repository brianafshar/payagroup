import { S, tr, useLang } from "../i18n";
import { usePageSeo } from "../hooks";
import { HOME } from "../data/content";
import MapCard from "../components/MapCard";

export default function Contact() {
  const lang = useLang();
  usePageSeo("contact");
  return (
    <section className="wrap section page-head">
      <div className="contact-grid light">
        <MapCard />
        <div className="contact-info">
          <h1 className="display sm">{tr(S.nav.contact, lang)}</h1>
          <p className="lead">{tr(S.footer.address, lang)}</p>
          <p className="lead">{tr(S.footer.phone, lang)}</p>
          <p className="lead">{HOME.hours[lang]}</p>
          <p className="lead">{HOME.email}</p>
        </div>
      </div>
    </section>
  );
}
