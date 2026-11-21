import type { Lang } from "./types";

/** Search-engine metadata shared by the build-time prerender and the browser. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://payagroup.org";
export const SITE_NAME = "Paya Group";

/** Fill these in with real details to get them into the structured data (omitted while empty). */
export const BUSINESS = {
  telephone: "",
  email: "",
  address: { streetAddress: "", addressLocality: "", addressRegion: "", addressCountry: "IR" },
  sameAs: [] as string[], // Instagram / Telegram / Google Business Profile URLs
  geo: { latitude: 35.7607523, longitude: 51.3785358 },
  mapUrl: "https://maps.app.goo.gl/tvA97GdXmZ4Egn6q9",
};

export type PageKey = "home" | "basketball" | "elite" | "exercises" | "contact";
export const PAGES: Record<PageKey, string> = { home: "", basketball: "basketball", elite: "elite", exercises: "exercises", contact: "contact" };
export const LANG_LIST: Lang[] = ["fa", "en"];

type M = { title: string; description: string; crumb: string };
const META: Record<PageKey, Record<Lang, M>> = {
  home: {
    fa: { title: "پایا گروپ | باشگاه بسکتبال و بدنسازی", description: "پایا گروپ، از ۲۰۰۷: باشگاه ورزشی با کلاس‌های بسکتبال، سالن بدنسازی با مربی، برنامه‌ی تمرینی شخصی و ویدیوی آموزشی هر حرکت.", crumb: "خانه" },
    en: { title: "Paya Group | Basketball & Bodybuilding Club", description: "Paya Group, since 2007: a sports club with basketball classes, a fully equipped gym with coaches, personal training programs and a video tutorial for every exercise.", crumb: "Home" },
  },
  basketball: {
    fa: { title: "کلاس بسکتبال | پایا گروپ", description: "کلاس‌های بسکتبال پایا برای مینی‌بسکت، نوجوانان و بزرگسالان: تمرین مهارت، تاکتیک و آمادگی جسمانی با مربیان باتجربه، برنامه‌ی هفتگی و تیم رقابتی.", crumb: "بسکتبال" },
    en: { title: "Basketball Classes | Paya Group", description: "Basketball classes for mini-basketball, juniors and adults: skills, tactics and conditioning with experienced coaches, a weekly schedule and competitive teams.", crumb: "Basketball" },
  },
  elite: {
    fa: { title: "باشگاه بدنسازی Elite | پایا گروپ", description: "بدنسازی Elite پایا: وزنه‌های آزاد و دستگاه، برنامه‌ی تمرینی شخصی در اپلیکیشن پایا، مربیان باتجربه و ویدیوی آموزشی برای هر حرکت.", crumb: "بدنسازی" },
    en: { title: "Elite Bodybuilding Gym | Paya Group", description: "Paya Elite bodybuilding: free weights and machines, a personal program in the Paya app, experienced coaches and a tutorial video for every move.", crumb: "Bodybuilding" },
  },
  exercises: {
    fa: { title: "آموزش حرکات بدنسازی و بسکتبال (ویدیو) | پایا گروپ", description: "کتابخانه‌ی ویدیوهای آموزشی حرکات بدنسازی و بسکتبال: نحوه‌ی اجرا، نکات و عضلات درگیر، دسته‌بندی‌شده برای سینه، پشت، پا، شانه، بازو و تمرین‌های بسکتبال.", crumb: "آموزش حرکات" },
    en: { title: "Exercise Video Tutorials | Paya Group", description: "A video library of bodybuilding and basketball exercises: technique, tips and muscles worked, by category: chest, back, legs, shoulders, arms and basketball drills.", crumb: "Exercises" },
  },
  contact: {
    fa: { title: "تماس با پایا گروپ", description: "راه‌های ارتباطی، آدرس و ساعت کاری باشگاه پایا گروپ برای بازدید و ثبت‌نام در کلاس‌های بسکتبال و بدنسازی.", crumb: "تماس" },
    en: { title: "Contact Paya Group", description: "Address, hours and contact details of Paya Group for visits and sign-up to basketball and bodybuilding programs.", crumb: "Contact" },
  },
};

/** Canonical path of a static page. Folders on disk, so they end with a slash: /fa/elite/ */
export const pagePath = (lang: Lang, key: PageKey) => `/${lang}/${PAGES[key] ? PAGES[key] + "/" : ""}`;

export type Tag = { tag: "meta" | "link" | "script"; attrs: Record<string, string>; text?: string };

export interface HeadInput {
  lang: Lang;
  path: string;
  alternates: Partial<Record<Lang, string>>;
  title: string;
  description: string;
  image?: string;
  ogType?: string;
  noindex?: boolean;
  ld?: unknown[];
}

const abs = (p: string) => (/^https?:\/\//.test(p) ? p : SITE_URL + p);
export const OG_IMAGE = `${SITE_URL}/og.jpg`;

export function headTags(o: HeadInput): Tag[] {
  const url = abs(o.path);
  const image = o.image || OG_IMAGE;
  const t: Tag[] = [
    { tag: "meta", attrs: { name: "description", content: o.description } },
    { tag: "meta", attrs: { name: "robots", content: o.noindex ? "noindex,follow" : "index,follow,max-image-preview:large,max-video-preview:-1" } },
    { tag: "link", attrs: { rel: "canonical", href: url } },
  ];
  for (const l of LANG_LIST) if (o.alternates[l]) t.push({ tag: "link", attrs: { rel: "alternate", hreflang: l, href: abs(o.alternates[l]!) } });
  if (o.alternates.fa) t.push({ tag: "link", attrs: { rel: "alternate", hreflang: "x-default", href: abs(o.alternates.fa) } });
  const og = (property: string, content: string) => t.push({ tag: "meta", attrs: { property, content } });
  og("og:type", o.ogType || "website");
  og("og:site_name", SITE_NAME);
  og("og:title", o.title);
  og("og:description", o.description);
  og("og:url", url);
  og("og:locale", o.lang === "fa" ? "fa_IR" : "en_US");
  og("og:locale:alternate", o.lang === "fa" ? "en_US" : "fa_IR");
  og("og:image", image);
  if (!o.image) { og("og:image:width", "1200"); og("og:image:height", "630"); }
  t.push({ tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } });
  t.push({ tag: "meta", attrs: { name: "twitter:title", content: o.title } });
  t.push({ tag: "meta", attrs: { name: "twitter:description", content: o.description } });
  t.push({ tag: "meta", attrs: { name: "twitter:image", content: image } });
  for (const ld of o.ld ?? []) t.push({ tag: "script", attrs: { type: "application/ld+json" }, text: JSON.stringify(ld).replace(/</g, "\\u003c") });
  return t;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export function tagsToHtml(tags: Tag[]): string {
  return tags
    .map((x) => {
      const attrs = Object.entries({ ...x.attrs, "data-seo": "" }).map(([k, v]) => (v === "" ? k : `${k}="${esc(v)}"`)).join(" ");
      return x.tag === "script" ? `<script ${attrs}>${x.text}</script>` : `<${x.tag} ${attrs}>`;
    })
    .join("\n    ");
}

/** Browser side: swap the managed tags when the route changes. */
export function applyTags(title: string, tags: Tag[]) {
  document.title = title;
  document.head.querySelectorAll("[data-seo]").forEach((n) => n.remove());
  for (const x of tags) {
    const el = document.createElement(x.tag);
    for (const [k, v] of Object.entries(x.attrs)) el.setAttribute(k, v);
    if (x.text) el.textContent = x.text;
    el.setAttribute("data-seo", "");
    document.head.appendChild(el);
  }
}

const crumbs = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.path) })),
});

function clubLd(lang: Lang, description: string) {
  const b = BUSINESS;
  const a = b.address;
  return {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    "@id": `${SITE_URL}/#club`,
    name: SITE_NAME,
    alternateName: lang === "fa" ? "پایا گروپ" : "Paya",
    url: `${SITE_URL}/${lang}/`,
    logo: `${SITE_URL}/apple-touch-icon.png`,
    image: OG_IMAGE,
    description,
    foundingDate: "2007",
    sport: ["Basketball", "Bodybuilding"],
    inLanguage: ["fa", "en"],
    geo: { "@type": "GeoCoordinates", ...b.geo },
    hasMap: b.mapUrl,
    ...(b.telephone ? { telephone: b.telephone } : {}),
    ...(b.email ? { email: b.email } : {}),
    ...(a.streetAddress ? { address: { "@type": "PostalAddress", ...a } } : {}),
    ...(b.sameAs.length ? { sameAs: b.sameAs } : {}),
  };
}

export function pageHead(lang: Lang, key: PageKey) {
  const m = META[key][lang];
  const alternates = Object.fromEntries(LANG_LIST.map((l) => [l, pagePath(l, key)])) as Record<Lang, string>;
  const ld: unknown[] = [];
  if (key === "home") {
    ld.push(clubLd(lang, m.description));
    ld.push({ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/${lang}/`, inLanguage: lang });
  } else {
    ld.push(crumbs([{ name: META.home[lang].crumb, path: pagePath(lang, "home") }, { name: m.crumb, path: pagePath(lang, key) }]));
  }
  return { title: m.title, tags: headTags({ lang, path: pagePath(lang, key), alternates, title: m.title, description: m.description, ld }) };
}

export interface ExerciseSeoInput {
  id: number; name: string; name_en?: string; description: string; description_en?: string;
  video_url: string; image_url?: string; updated_at?: string;
}

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

export function exerciseHead(lang: Lang, e: ExerciseSeoInput) {
  const name = (lang === "en" && e.name_en) || e.name;
  const desc0 = (lang === "en" && e.description_en) || e.description;
  const suffix = lang === "fa" ? "آموزش حرکت" : "exercise tutorial";
  const title = `${name} | ${suffix} | Paya`;
  const description = clip(desc0 ? `${name}: ${desc0}` : `${name}: ${suffix}`, 158);
  const path = (l: Lang) => `/${l}/exercises/${e.id}`;
  const ld: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name,
      description,
      ...(e.image_url ? { thumbnailUrl: [e.image_url] } : {}),
      uploadDate: e.updated_at || undefined,
      contentUrl: e.video_url,
      inLanguage: lang,
      publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-touch-icon.png` } },
    },
    crumbs([
      { name: META.home[lang].crumb, path: pagePath(lang, "home") },
      { name: META.exercises[lang].crumb, path: pagePath(lang, "exercises") },
      { name, path: path(lang) },
    ]),
  ];
  return {
    title,
    tags: headTags({ lang, path: path(lang), alternates: { fa: path("fa"), en: path("en") }, title, description, image: e.image_url, ogType: "video.other", ld }),
  };
}
