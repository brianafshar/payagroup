import { S, tr, useLang } from "../i18n";
import { usePageSeo } from "../hooks";

export default function Contact() {
  const lang = useLang();
  usePageSeo("contact");
  return (
    <section className="wrap section page-head">
      <h1 className="display sm">{tr(S.nav.contact, lang)}</h1>
      <p className="lead">{tr(S.footer.address, lang)}</p>
      <p className="lead">{tr(S.footer.phone, lang)}</p>
    </section>
  );
}
