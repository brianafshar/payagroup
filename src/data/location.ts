// Pin of the club (from the Google Maps link the club shared).
export const LOCATION = {
  lat: 35.7607523,
  lng: 51.3785358,
  mapsUrl: "https://maps.app.goo.gl/tvA97GdXmZ4Egn6q9",
  place: { fa: "مجموعه ورزشی گلبانگ", en: "Golbang Sport Complex" },
};

export const embedUrl = (lang: "fa" | "en") =>
  `https://www.google.com/maps?q=${LOCATION.lat},${LOCATION.lng}&z=17&hl=${lang}&output=embed`;
