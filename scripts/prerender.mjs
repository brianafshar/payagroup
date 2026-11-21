// Build step: render every static route to real HTML (so search engines see content without running JS),
// then keep a clean shell (dist/__shell.html) that the API server uses for exercise pages.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.resolve("dist");
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const { render, PAGES, LANG_LIST, pageHead, tagsToHtml } = await import(pathToFileURL(path.resolve("dist-ssr/entry-server.js")).href);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

let n = 0;
for (const lang of LANG_LIST) {
  for (const [key, sub] of Object.entries(PAGES)) {
    const { title, tags } = pageHead(lang, key);
    const body = render(`/${lang}/${sub}`);
    const html = template
      .replace(/<html[^>]*>/, `<html lang="${lang}" dir="${lang === "fa" ? "rtl" : "ltr"}">`)
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace("</head>", `    ${tagsToHtml(tags)}\n  </head>`)
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
    if (!html.includes(body.slice(0, 40))) throw new Error(`prerender failed for ${lang}/${sub}`);
    const out = path.join(dist, lang, sub, "index.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    n++;
  }
}
fs.copyFileSync(path.join(dist, "index.html"), path.join(dist, "__shell.html"));
console.log(`prerendered ${n} pages`);
