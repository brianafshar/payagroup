import { LOCATION, embedUrl } from "../data/location";
import { S, tr, useLang } from "../i18n";

/** Google map of the club + a link that opens it in Google Maps. */
export default function MapCard({ className = "" }: { className?: string }) {
  const lang = useLang();
  return (
    <figure className={`mapcard ${className}`} data-reveal>
      <div className="map-frame">
        <iframe
          src={embedUrl(lang)}
          title={`${LOCATION.place[lang]} – Google Maps`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <figcaption>
        <span>📍 {LOCATION.place[lang]}</span>
        <a href={LOCATION.mapsUrl} target="_blank" rel="noopener" className="map-open">{tr(S.footer.openMap, lang)} ↗</a>
      </figcaption>
    </figure>
  );
}
