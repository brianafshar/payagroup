// Search-engine output for the pages only this server can build (exercise pages, sitemap).
// Mirrors src/seo.ts (the website's own copy for static pages).
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

export const LANGS = ["fa", "en"];
export const STATIC_PAGES = ["", "basketball", "elite", "exercises", "contact"];
export const staticPath = (lang, sub) => `/${lang}/${sub ? sub + "/" : ""}`;

const CRUMB = { fa: { home: "خانه", ex: "آموزش حرکات" }, en: { home: "Home", ex: "Exercises" } };

export function exerciseSeo(site, lang, e) {
  const name = (lang === "en" && e.name_en) || e.name;
  const desc0 = (lang === "en" && e.description_en) || e.description;
  const suffix = lang === "fa" ? "آموزش حرکت" : "exercise tutorial";
  const title = `${name} | ${suffix} | Paya`;
  const description = clip(desc0 ? `${name}: ${desc0}` : `${name}: ${suffix}`, 158);
  const path = (l) => `/${l}/exercises/${e.id}`;
  const url = site + path(lang);
  const image = e.image_url || `${site}/og.jpg`;
  const video = e.video_url;
  const ld = [
    {
      "@context": "https://schema.org", "@type": "VideoObject", name, description,
      ...(e.image_url ? { thumbnailUrl: [e.image_url] } : {}),
      ...(e.updated_at ? { uploadDate: e.updated_at } : {}),
      contentUrl: video, inLanguage: lang,
      publisher: { "@type": "Organization", name: "Paya Group", logo: { "@type": "ImageObject", url: `${site}/apple-touch-icon.png` } },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: CRUMB[lang].home, item: `${site}${staticPath(lang, "")}` },
        { "@type": "ListItem", position: 2, name: CRUMB[lang].ex, item: `${site}${staticPath(lang, "exercises")}` },
        { "@type": "ListItem", position: 3, name, item: url },
      ],
    },
  ];
  const m = (a, v) => `<meta ${a} content="${esc(v)}" data-seo>`;
  const tags = [
    m('name="description"', description),
    m('name="robots"', "index,follow,max-image-preview:large,max-video-preview:-1"),
    `<link rel="canonical" href="${esc(url)}" data-seo>`,
    `<link rel="alternate" hreflang="fa" href="${esc(site + path("fa"))}" data-seo>`,
    `<link rel="alternate" hreflang="en" href="${esc(site + path("en"))}" data-seo>`,
    `<link rel="alternate" hreflang="x-default" href="${esc(site + path("fa"))}" data-seo>`,
    m('property="og:type"', "video.other"), m('property="og:site_name"', "Paya Group"),
    m('property="og:title"', title), m('property="og:description"', description), m('property="og:url"', url),
    m('property="og:locale"', lang === "fa" ? "fa_IR" : "en_US"), m('property="og:image"', image),
    m('name="twitter:card"', "summary_large_image"), m('name="twitter:title"', title),
    m('name="twitter:description"', description), m('name="twitter:image"', image),
    ...ld.map((o) => `<script type="application/ld+json" data-seo>${json(o)}</script>`),
  ];
  const steps = (lang === "en" && e.steps_en?.length ? e.steps_en : e.steps) || [];
  const noscript = `<noscript><main><h1>${esc(name)}</h1><p>${esc(desc0 || "")}</p>${steps.length ? `<ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}<p><a href="${esc(video)}">${lang === "fa" ? "ویدیو" : "Video"}</a> · <a href="${staticPath(lang, "exercises")}">${esc(CRUMB[lang].ex)}</a></p></main></noscript>`;
  return { title, tags: tags.join("\n    "), noscript };
}

/** Fill the site's HTML shell with page-specific head tags. */
export function fillShell(shell, lang, { title, tags, noscript = "" }) {
  return shell
    .replace(/<html[^>]*>/, `<html lang="${lang}" dir="${lang === "fa" ? "rtl" : "ltr"}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace("</head>", `    ${tags}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"></div>${noscript}`);
}

export const notFoundHead = (lang) => ({ title: "404 | Paya Group", tags: '<meta name="robots" content="noindex" data-seo>' , noscript: "" });

export function sitemap(site, exercises) {
  const alt = (fa, en) =>
    `<xhtml:link rel="alternate" hreflang="fa" href="${esc(site + fa)}"/><xhtml:link rel="alternate" hreflang="en" href="${esc(site + en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(site + fa)}"/>`;
  const rows = [];
  for (const sub of STATIC_PAGES) {
    for (const l of LANGS) {
      rows.push(`<url><loc>${esc(site + staticPath(l, sub))}</loc>${alt(staticPath("fa", sub), staticPath("en", sub))}<changefreq>${sub === "exercises" ? "weekly" : "monthly"}</changefreq><priority>${sub === "" ? "1.0" : "0.8"}</priority></url>`);
    }
  }
  for (const e of exercises) {
    const fa = `/fa/exercises/${e.id}`, en = `/en/exercises/${e.id}`;
    const last = e.updated_at ? `<lastmod>${esc(e.updated_at)}</lastmod>` : "";
    for (const p of [fa, en]) rows.push(`<url><loc>${esc(site + p)}</loc>${last}${alt(fa, en)}<priority>0.6</priority></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join("\n")}\n</urlset>\n`;
}
