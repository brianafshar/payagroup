#!/usr/bin/env node
/**
 * One-off porting tool: converts Claude Design `.dc.html` screen prototypes into React
 * class components (TSX) that render with the ported Baseline design system.
 *
 *   node tools/convert-dc.mjs            # converts every screen listed in SCREENS
 *   node tools/convert-dc.mjs C13        # converts only screens whose code starts with C13
 *
 * Mapping (mirrors the prototype runtime in project/support.js):
 *  - `{{ path }}`            → `v.path` (v = props merged with renderVals(), like the runtime)
 *  - `<x-import Baseline.X>` → `<X …>` (kebab props → camelCase; a `style` keeps only the
 *                              host-position props on a wrapper div, as the runtime did)
 *  - `<sc-if value>`         → `{cond ? <>…</> : null}`
 *  - `<sc-for list as>`      → `{list.map((as, $index) => …)}`
 *  - `style-hover/-focus`    → shared utility classes in screens/interactions.css
 *  - `class Component extends DCLogic` → `class X extends Screen` (same state/setState API)
 *
 * The output is a starting point that is then reviewed and edited by hand.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'htmlparser2';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'project');
const OUT = join(ROOT, 'apps/web/src/screens');

export const SCREENS = [
  ['A01 Admin Login', 'admin', 'AdminLogin'],
  ['A02 Admin Dashboard', 'admin', 'AdminDashboard'],
  ['A03 Admin Coaches', 'admin', 'AdminCoaches'],
  ['A04 Admin Create Coach', 'admin', 'AdminCreateCoach'],
  ['A05 Admin Coach Details', 'admin', 'AdminCoachDetails'],
  ['A06 Admin Athletes', 'admin', 'AdminAthletes'],
  ['A07 Admin Branding', 'admin', 'AdminBranding'],
  ['A08 Admin Access', 'admin', 'AdminAccess'],
  ['C09 Coach Login', 'coach', 'CoachLogin'],
  ['C10 Coach Dashboard', 'coach', 'CoachDashboard'],
  ['C11 Coach Athletes', 'coach', 'CoachAthletes'],
  ['C12 Coach Athlete Profile', 'coach', 'CoachAthleteProfile'],
  ['C13 Coach Create Athlete', 'coach', 'CoachCreateAthlete'],
  ['C14 Coach Exercise Library', 'coach', 'CoachExerciseLibrary'],
  ['C15 Coach Create Exercise', 'coach', 'CoachCreateExercise'],
  ['C16 Coach Exercise Details', 'coach', 'CoachExerciseDetails'],
  ['C17 Coach Programs', 'coach', 'CoachPrograms'],
  ['C18 Coach Create Program', 'coach', 'CoachCreateProgram'],
  ['C19 Coach Program Builder', 'coach', 'CoachProgramBuilder'],
  ['C20 Coach Program Template', 'coach', 'CoachProgramTemplate'],
  ['C21 Coach Assign Program', 'coach', 'CoachAssignProgram'],
  ['C22 Coach Program Customization', 'coach', 'CoachProgramCustomization'],
  ['C23 Coach Training History', 'coach', 'CoachTrainingHistory'],
  ['C24 Coach Nutrition Plan', 'coach', 'CoachNutritionPlan'],
  ['C25 Coach Recovery Plan', 'coach', 'CoachRecoveryPlan'],
  ['C26 Coach Analytics Overview', 'coach', 'CoachAnalyticsOverview'],
  ['C27 Coach Strength Analytics', 'coach', 'CoachStrengthAnalytics'],
  ['C28 Coach Endurance Speed', 'coach', 'CoachEnduranceSpeed'],
  ['C29 Coach Body Composition', 'coach', 'CoachBodyComposition'],
  ['C30 Coach Recovery Analytics', 'coach', 'CoachRecoveryAnalytics'],
  ['C31 Coach Personal Records', 'coach', 'CoachPersonalRecords'],
  ['C32 Coach Settings', 'coach', 'CoachSettings'],
  ['C33 Coach Chat', 'coach', 'CoachChat'],
];

/* ---------------- pseudo-class utilities (shared across screens) ---------------- */
const PSEUDO_NAMES = {
  'hover|border-color:var(--brand-primary);': 'hv-border-brand',
  'hover|background:var(--surface-sunken);color:var(--error, #c62828);': 'hv-danger-soft',
  'hover|background:var(--surface-sunken);': 'hv-sunken',
  'hover|background:var(--border-subtle);': 'hv-subtle',
  'hover|border-color:var(--brand-primary);color:var(--text-primary);': 'hv-border-brand-text',
  'hover|border-color:var(--brand-primary);background:var(--brand-primary-subtle);': 'hv-brand-soft',
  'hover|color:var(--error, #c62828);': 'hv-danger-text',
  'hover|border-color:var(--brand-primary);box-shadow:var(--shadow-1);': 'hv-lift',
  'hover|background:var(--surface-sunken);color:var(--text-primary);': 'hv-sunken-text',
  'hover|background:var(--error-subtle, #fdecec);color:var(--error, #c62828);': 'hv-danger',
  'focus|box-shadow:inset 0 -2px 0 var(--brand-primary);': 'fc-underline',
  'focus|border-color:var(--brand-primary);box-shadow:0 0 0 3px var(--brand-primary-subtle);': 'fc-ring',
  'hover|background:rgba(255,154,31,.12);text-decoration:none;': 'hv-index-link',
};
const pseudoUsed = new Map();
function pseudoClass(kind, css) {
  const key = kind + '|' + css.trim();
  let name = PSEUDO_NAMES[key];
  if (!name) {
    let h = 0;
    for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
    name = (kind === 'hover' ? 'hv-' : 'fc-') + (h >>> 0).toString(36);
  }
  pseudoUsed.set(name, { kind, css: css.trim() });
  return name;
}
function importantify(css) {
  return css
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (/!important$/.test(d) ? d : d + ' !important'))
    .join('; ');
}

/* ---------------- expressions ---------------- */
const KEYWORDS = new Set(['true', 'false', 'null', 'undefined']);
/** `a.b.c` → `v.a?.b?.c` (or `s.b` for loop variables); mirrors the runtime's null-safe paths. */
function expr(src, scope) {
  const e = src.trim();
  if (KEYWORDS.has(e) || /^-?\d+(\.\d+)?$/.test(e) || /^'.*'$/.test(e)) return e;
  const neg = e.startsWith('!');
  const body = neg ? e.slice(1).trim() : e;
  const parts = body.split('.');
  const [root, ...rest] = parts;
  const base = scope.has(root) ? root : 'v.' + root;
  const out = rest.length ? base + rest.map((p) => (/^\d+$/.test(p) ? `?.[${p}]` : '?.' + p)).join('') : base;
  return (neg ? '!' : '') + out;
}
const BIND_WHOLE = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
function attrValue(raw, scope) {
  const m = raw.match(BIND_WHOLE);
  if (m) return { expr: expr(m[1], scope) };
  if (raw.includes('{{')) {
    const parts = raw.split(/\{\{([\s\S]+?)\}\}/g);
    const tpl = parts.map((s, i) => (i & 1 ? '${' + expr(s, scope) + ' ?? ""}' : s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${'))).join('');
    return { expr: '`' + tpl + '`' };
  }
  return { str: raw };
}
function jsxAttr(name, raw, scope) {
  const v = attrValue(raw, scope);
  if (v.expr === 'true') return name;
  if (v.expr !== undefined) return `${name}={${v.expr}}`;
  const s = v.str;
  if (/["\\{}<>]|\n/.test(s)) return `${name}={${JSON.stringify(s)}}`;
  return `${name}="${s}"`;
}

/* ---------------- styles ---------------- */
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function styleDecls(css) {
  const out = [];
  // split on ; not inside parentheses
  let depth = 0;
  let cur = '';
  for (const ch of css) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out
    .map((d) => {
      const i = d.indexOf(':');
      if (i < 0) return null;
      const prop = d.slice(0, i).trim();
      const val = d.slice(i + 1).trim();
      if (!prop) return null;
      return [prop.startsWith('--') ? prop : kebabToCamel(prop), val];
    })
    .filter(Boolean);
}
let needsCssType = false;
function styleObject(css, scope) {
  const decls = styleDecls(css);
  if (!decls.length) return null;
  const custom = decls.some(([k]) => k.startsWith('--'));
  if (custom) needsCssType = true;
  const body = decls
    .map(([k, val]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      const av = attrValue(val, scope);
      return `${key}: ${av.expr !== undefined ? av.expr : JSON.stringify(av.str)}`;
    })
    .join(', ');
  return custom ? `{{ ${body} } as CSSProperties}` : `{{ ${body} }}`;
}
const HOST_STYLE_PROPS = new Set(['position', 'left', 'right', 'top', 'bottom', 'inset', 'width', 'height', 'z-index', 'transform']);
function hostStyle(css) {
  return styleDecls(css)
    .filter(([k]) => HOST_STYLE_PROPS.has(k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ');
}

/* ---------------- DOM attribute names ---------------- */
const EVENTS = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onsubmit: 'onSubmit', onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', onmousedown: 'onMouseDown', onmouseup: 'onMouseUp', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus', onblur: 'onBlur', ondragstart: 'onDragStart', ondragend: 'onDragEnd', ondragenter: 'onDragEnter', ondragleave: 'onDragLeave', ondragover: 'onDragOver', ondrop: 'onDrop', onpointerdown: 'onPointerDown', onpointerup: 'onPointerUp', onpointermove: 'onPointerMove' };
const DOM_ATTRS = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', colspan: 'colSpan', rowspan: 'rowSpan', maxlength: 'maxLength', readonly: 'readOnly', autocomplete: 'autoComplete', autofocus: 'autoFocus', contenteditable: 'contentEditable', spellcheck: 'spellCheck', inputmode: 'inputMode', enterkeyhint: 'enterKeyHint', crossorigin: 'crossOrigin', viewbox: 'viewBox', preserveaspectratio: 'preserveAspectRatio', 'accept-charset': 'acceptCharset' };
const BOOL_ATTRS = new Set(['disabled', 'checked', 'readonly', 'required', 'hidden', 'multiple', 'selected', 'autofocus', 'open', 'draggable']);
function domAttrName(name) {
  const l = name.toLowerCase();
  if (DOM_ATTRS[l]) return DOM_ATTRS[l];
  if (EVENTS[l]) return EVENTS[l];
  if (l.startsWith('aria-') || l.startsWith('data-')) return l;
  if (name.includes('-')) return kebabToCamel(name);
  return name;
}

/* ---------------- template → JSX ---------------- */
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'del', 'em', 'i', 'ins', 'kbd', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'u', 'label', 'x-import', 'button', 'input', 'img', 'svg', 'select', 'textarea']);
const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'area', 'col', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'stop', 'ellipse', 'use']);

function isFlexOrGrid(el) {
  const st = el && el.attribs && el.attribs.style;
  return !!st && /display\s*:\s*(inline-)?(flex|grid)/.test(st);
}
function jsText(s) {
  return '{' + JSON.stringify(s) + '}';
}

const used = new Set();

function renderChildren(nodes, parent, scope, ind) {
  const out = [];
  const flex = isFlexOrGrid(parent) || (parent && parent.name === 'x-import') || !parent;
  nodes.forEach((n, i) => {
    if (n.type === 'text') {
      const raw = n.data;
      if (!raw.includes('{{')) {
        if (!raw.trim()) {
          if (!raw.includes(' ') || flex) return;
          const prev = nodes[i - 1];
          const next = nodes[i + 1];
          const inl = (x) => x && (x.type === 'text' || (x.type === 'tag' && INLINE.has(x.name)));
          if (inl(prev) && inl(next)) out.push(ind + "{' '}");
          return;
        }
        const collapsed = raw.replace(/\s+/g, ' ');
        const lead = /^\s/.test(raw) && i > 0;
        const trail = /\s$/.test(raw) && i < nodes.length - 1;
        const core = collapsed.trim();
        const txt = (lead ? ' ' : '') + core + (trail ? ' ' : '');
        out.push(ind + (/[{}<>"'`]/.test(txt) || lead || trail ? jsText(txt) : txt));
        return;
      }
      const parts = raw.split(/\{\{([\s\S]+?)\}\}/g);
      parts.forEach((p, k) => {
        if (k & 1) out.push(ind + '{' + expr(p, scope) + '}');
        else if (p.trim()) {
          const c = p.replace(/\s+/g, ' ');
          out.push(ind + jsText(c));
        } else if (p.includes(' ') && k > 0 && k < parts.length - 1) out.push(ind + "{' '}");
      });
      return;
    }
    if (n.type === 'comment') return;
    if (n.type !== 'tag' && n.type !== 'script' && n.type !== 'style') return;
    out.push(renderEl(n, scope, ind));
  });
  return out;
}

function renderEl(el, scope, ind) {
  const tag = el.name;
  const inner = ind + '  ';
  if (tag === 'sc-if') {
    const cond = attrValue(el.attribs.value || '', scope).expr || 'false';
    const kids = renderChildren(el.children, el.parent && el.parent.type === 'tag' ? el.parent : null, scope, inner + '  ');
    return `${ind}{${cond} ? (\n${inner}<>\n${kids.join('\n')}\n${inner}</>\n${ind}) : null}`;
  }
  if (tag === 'sc-for') {
    const list = attrValue(el.attribs.list || '', scope).expr || '[]';
    const as = el.attribs.as || 'item';
    const sub = new Set(scope);
    sub.add(as);
    sub.add('$index');
    const kids = renderChildren(el.children, el.parent && el.parent.type === 'tag' ? el.parent : null, sub, inner + '  ');
    return `${ind}{(${list} || []).map((${as}: any, $index: number) => (\n${inner}<Fragment key={$index}>\n${kids.join('\n')}\n${inner}</Fragment>\n${ind}))}`;
  }
  if (tag === 'x-import') {
    const g = el.attribs['component-from-global-scope'] || '';
    const name = g.replace(/^Baseline\./, '');
    used.add(name);
    const attrs = [];
    let wrap = null;
    for (const [k, val] of Object.entries(el.attribs)) {
      if (k === 'component-from-global-scope' || k.startsWith('hint-') || k === 'data-dc-tpl') continue;
      if (k === 'style') {
        const hs = hostStyle(val);
        if (hs) wrap = hs;
        continue;
      }
      const pk = k.startsWith('aria-') || k.startsWith('data-') ? k : kebabToCamel(k);
      attrs.push(jsxAttr(pk, val, scope));
    }
    const kids = renderChildren(el.children, el, scope, inner + (wrap ? '  ' : ''));
    const open = `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}`;
    const node = kids.length ? `${open}>\n${kids.join('\n')}\n${wrap ? inner : ind}</${name}>` : `${open} />`;
    if (wrap) return `${ind}<div style={{ ${wrap} }}>\n${inner}${node}\n${ind}</div>`;
    return ind + node;
  }
  // DOM element
  const attrs = [];
  const classes = [];
  for (const [k, val] of Object.entries(el.attribs)) {
    if (k.startsWith('hint-') || k === 'data-dc-tpl' || k === 'data-screen-label' || k === 'data-om-id') continue;
    if (k.startsWith('style-')) {
      classes.push(pseudoClass(k.slice(6), val));
      continue;
    }
    if (k === 'style') {
      const so = styleObject(val, scope);
      if (so) attrs.push('style=' + so);
      continue;
    }
    if (k === 'class') {
      classes.unshift(val);
      continue;
    }
    const name = domAttrName(k);
    if (val === '' && BOOL_ATTRS.has(k.toLowerCase())) {
      attrs.push(name);
      continue;
    }
    attrs.push(jsxAttr(name, val, scope));
  }
  if (classes.length) {
    const hasBind = classes.some((c) => c.includes('{{'));
    if (hasBind) attrs.unshift(jsxAttr('className', classes.join(' '), scope));
    else attrs.unshift(`className="${classes.join(' ')}"`);
  }
  const open = `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}`;
  if (VOID.has(tag) && !el.children.length) return `${ind}${open} />`;
  const kids = renderChildren(el.children, el, scope, inner);
  if (!kids.length) return `${ind}${open}></${tag}>`;
  return `${ind}${open}>\n${kids.join('\n')}\n${ind}</${tag}>`;
}

/* ---------------- screen root ---------------- */
const tagKids = (el) => el.children.filter((n) => n.type === 'tag');
function findImport(el, name) {
  return tagKids(el).find((c) => c.name === 'x-import' && c.attribs['component-from-global-scope'] === 'Baseline.' + name);
}

/** Recognises the Admin/Coach panel frame (sidebar column + main column with TopBar). */
function renderPanel(root, scope, ind) {
  const [side, main, ...rest] = tagKids(root);
  if (!side || !main) return null;
  const sidebar = findImport(side, 'Sidebar');
  const mainKids = tagKids(main);
  const topBar = mainKids[0] && mainKids[0].name === 'x-import' && mainKids[0].attribs['component-from-global-scope'] === 'Baseline.TopBar' ? mainKids[0] : null;
  if (!sidebar || !topBar || tagKids(side).length !== 1) return null;
  delete sidebar.attribs.style;
  delete topBar.attribs.style;
  const style = root.attribs.style || '';
  const fullHeight = /overflow\s*:\s*hidden/.test(style);
  const theme = attrValue(root.attribs['data-theme'] || 'brand', scope);
  const inner = ind + '  ';
  const content = renderChildren(
    main.children.filter((n) => n !== topBar),
    main,
    scope,
    inner,
  );
  const overlays = rest.map((r) => renderEl(r, scope, inner + '    '));
  used.add('PanelLayout');
  const props = [
    theme.expr ? `theme={${theme.expr}}` : `theme="${theme.str}"`,
    fullHeight ? 'fullHeight' : '',
    `sidebar={${renderEl(sidebar, scope, '').trim()}}`,
    `topBar={${renderEl(topBar, scope, '').trim()}}`,
    overlays.length ? `overlays={\n${inner}  <>\n${overlays.join('\n')}\n${inner}  </>\n${inner}}` : '',
  ].filter(Boolean);
  return `${ind}<PanelLayout ${props.join(' ')}>\n${content.join('\n')}\n${ind}</PanelLayout>`;
}

/** Other roots (login screens, index): the fixed prototype canvas becomes full-viewport. */
function fitRoot(root) {
  let st = root.attribs.style || '';
  st = st.replace(/(^|;)\s*width\s*:\s*1440px/, '$1width:100%');
  st = st.replace(/(^|;)\s*(min-)?height\s*:\s*\d+px/, '$1min-height:100vh');
  st = st.replace(/(^|;)\s*transform\s*:\s*translateZ\(0\)\s*;?/, '$1');
  root.attribs.style = st;
}

/* ---------------- logic class ---------------- */
function convertLogic(src) {
  let s = src.trim();
  s = s.replace(/window\.blHref\s*\?\s*window\.blHref\(([^()]*)\)\s*:\s*'#'/g, 'href($1)');
  s = s.replace(/\(window\.blHref\s*&&\s*window\.blHref\(([^()]*)\)\)\s*\|\|\s*'#'/g, 'href($1)');
  s = s.replace(/window\.blHref\s*&&\s*window\.blHref\(([^()]*)\)/g, 'href($1)');
  s = s.replace(/window\.blHref\(/g, 'href(');
  s = s.replace(/window\.blGo\s*&&\s*window\.blGo\(/g, 'go(');
  s = s.replace(/window\.blGo\(/g, 'go(');
  s = s.replace(/window\.blToast\s*&&\s*window\.blToast\(/g, 'toast(');
  s = s.replace(/window\.blToast\(/g, 'toast(');
  s = s.replace(/window\.blParam\s*&&\s*window\.blParam\(/g, 'param(');
  s = s.replace(/window\.blParam\(/g, 'param(');
  s = s.replace(/React\.createRef\(/g, 'createRef(');
  s = s.replace(/React\.createElement\(/g, 'createElement(');
  s = s.replace(/window\.blAddExercise\s*&&\s*window\.blAddExercise\(/g, 'addExercise(');
  s = s.replace(/window\.blAddExercise\(/g, 'addExercise(');
  s = s.replace(/window\.BL_EXERCISES/g, 'EXERCISES');
  s = s.replace(/window\.BL_EX_CATS/g, 'EX_CATS');
  s = s.replace(/window\.BL_EX_EQUIP/g, 'EX_EQUIP');
  s = s.replace(/window\.BL_EX_DIFF/g, 'EX_DIFF');
  s = s.replace(/^(\s*)state = \{/m, '$1state: ScreenState = {');
  s = s.replace(/class Component extends DCLogic\s*\{/, '');
  s = s.replace(/\}\s*$/, '');
  return s;
}

function fields(logic) {
  const methodNames = new Set([...logic.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*(\(|=|:)/gm)].map((m) => m[1]));
  const f = new Set();
  for (const m of logic.matchAll(/this\.([A-Za-z_$][\w$]*)/g)) {
    const n = m[1];
    if (['state', 'setState', 'props', 'forceUpdate'].includes(n) || methodNames.has(n)) continue;
    f.add(n);
  }
  return [...f];
}

/* ---------------- file ---------------- */
function convert([file, area, className]) {
  const html = readFileSync(join(SRC, file + '.dc.html'), 'utf8');
  const dc = html.slice(html.indexOf('<x-dc>') + 6, html.lastIndexOf('</x-dc>')).replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const logicMatch = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  const logic = logicMatch ? convertLogic(logicMatch[1]) : '  renderVals() { return {}; }';
  used.clear();
  const doc = parseDocument(dc, { lowerCaseAttributeNames: false, lowerCaseTags: false, recognizeSelfClosing: true, decodeEntities: true });
  const roots = doc.children.filter((n) => n.type === 'tag');
  const scope = new Set();
  needsCssType = false;
  const body = roots
    .map((r) => {
      const panel = renderPanel(r, scope, '      ');
      if (panel) return panel;
      fitRoot(r);
      return renderEl(r, scope, '      ');
    })
    .join('\n');
  const jsx = roots.length > 1 ? `      <>\n${body}\n      </>` : body;
  const comps = [...used].sort();
  const libUse = [];
  if (/\bgo\(/.test(logic)) libUse.push('go');
  if (/\bhref\(/.test(logic)) libUse.push('href');
  if (/\bparam\(/.test(logic)) libUse.push('param');
  const exUse = ['EXERCISES', 'EX_CATS', 'EX_EQUIP', 'EX_DIFF', 'addExercise'].filter((n) => new RegExp('\\b' + n + '\\b').test(logic));
  const fieldDecls = fields(logic).map((n) => `  ${n}: any;`).join('\n');
  const usesFragment = /<Fragment/.test(jsx);
  const depth = area === '.' ? '.' : '..';
  const reactImports = [/\bcreateElement\(/.test(logic) ? 'createElement' : '', /\bcreateRef\(/.test(logic) ? 'createRef' : '', usesFragment ? 'Fragment' : '', needsCssType ? 'type CSSProperties' : ''].filter(Boolean);
  const dsComps = comps.filter((c) => c !== 'PanelLayout');
  const imports = [
    `// Ported from design handoff: project/${file}.dc.html`,
    reactImports.length ? `import { ${reactImports.join(', ')} } from 'react';` : '',
    dsComps.length ? `import { ${dsComps.join(', ')} } from '@/ds';` : '',
    comps.includes('PanelLayout') ? `import { PanelLayout } from '@/app/PanelLayout';` : '',
    libUse.length ? `import { ${libUse.join(', ')} } from '@/lib/nav';` : '',
    /\btoast\(/.test(logic) ? `import { toast } from '@/lib/toast';` : '',
    exUse.length ? `import { ${exUse.join(', ')} } from '@/data/exercises';` : '',
    /state: ScreenState/.test(logic) ? `import { Screen, type ScreenState } from '${depth}/Screen';` : `import { Screen } from '${depth}/Screen';`,
  ].filter(Boolean);
  const classBody = [fieldDecls, logic.replace(/^\n+/, '').replace(/\s+$/, '')].filter(Boolean).join('\n');
  const lines = [
    ...imports,
    '',
    `export default class ${className} extends Screen {`,
    classBody,
    '',
    '  render() {',
    '    const v = this.vals();',
    '    return (',
    jsx,
    '    );',
    '  }',
    '}',
    '',
  ];
  const dir = area === '.' ? OUT : join(OUT, area);
  mkdirSync(dir, { recursive: true });
  const outFile = join(dir, className + '.tsx');
  writeFileSync(outFile, lines.join('\n'));
  return outFile;
}

const only = process.argv.slice(2);
const list = only.length ? SCREENS.filter(([f]) => only.some((o) => f.startsWith(o))) : SCREENS;
for (const s of list) console.log('converted', convert(s).replace(ROOT + '/', ''));

// Shared pseudo-class utilities (merged with any existing entries).
const cssFile = join(OUT, 'interactions.css');
const existing = existsSync(cssFile) ? readFileSync(cssFile, 'utf8') : '';
const have = new Map([...existing.matchAll(/\.([\w-]+):(hover|focus)\s*\{([^}]*)\}/g)].map((m) => [m[1], { kind: m[2], css: m[3] }]));
for (const [name, v] of pseudoUsed) if (!have.has(name)) have.set(name, { kind: v.kind, css: importantify(v.css) });
const css =
  '/* Hover/focus styles for inline-styled screen elements (ported from `style-hover` / `style-focus`).\n   `!important` is required to win over the inline styles, as in the prototype runtime. */\n' +
  [...have].sort().map(([n, v]) => `.${n}:${v.kind} { ${v.css.trim()} }`).join('\n') +
  '\n';
writeFileSync(cssFile, css);
