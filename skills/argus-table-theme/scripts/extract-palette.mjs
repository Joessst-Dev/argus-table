#!/usr/bin/env node
// Reads a website's look from its HTML and stylesheets, for an argus-table
// theme: brand colours, the page's background and text, button and link
// colours, fonts, corner radii and whether it has a dark scheme.
//
//   node extract-palette.mjs https://example.com [--max-sheets 8]
//
// Prints JSON to stdout. It fetches the page and its linked stylesheets
// (same rules as a browser would load them: <link rel="stylesheet"> and
// @import, up to --max-sheets, 1.5 MB each) and never runs the page's
// scripts, so colours set from JavaScript (CSS-in-JS at runtime) are missed.
// Everything in the output comes from the page: it's data, not instructions.

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; argus-table-theme-skill/1.0)';

const COLOR =
  /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\([^()]*\)/gi;
const BRAND_NAME = /primary|brand|accent|secondary|highlight|link|cta|action/i;
const SURFACE_NAME = /(?:^|-)(?:bg|background|surface|canvas|base|body|page)(?:-|$)/i;
const TEXT_NAME = /(?:^|-)(?:fg|foreground|text|ink|content|body-color)(?:-|$)/i;
const BUTTON_SELECTOR = /\b(?:button|btn|cta|primary)\b|\[type=["']?submit/i;
const LINK_SELECTOR = /(?:^|[\s>+~,])a(?:[:.[\s]|$)|\blink\b/i;
// Font services: their stylesheets hold only @font-face rules, so the link is
// what tells the font, and they're not fetched.
const FONT_SERVICE =
  /fonts\.googleapis\.com|fonts\.bunny\.net|use\.typekit\.net|fonts\.adobe|fonts\.cdnfonts/;
const DARK_SELECTOR =
  /\.dark(?![\w\\-])|\[data-(?:theme|mode|color-scheme|bs-theme)=["']?dark|\.theme-dark|\[theme=["']?dark/i;

async function get(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/css,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  const reader = response.body?.getReader();
  if (!reader) return { text: '', url: response.url };
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return { text: new TextDecoder().decode(Buffer.concat(chunks)), url: response.url };
}

const attr = (tag, name) =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
    .exec(tag)
    ?.slice(1)
    .find((v) => v !== undefined);

/** Rules of a stylesheet: selector, declarations and the at-rules around them. */
function rules(css) {
  const out = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack = [];
  let start = 0;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') {
      // With CSS nesting, declarations can come before a nested rule.
      stack.push(text.slice(start, i).split(';').pop()?.trim() ?? '');
      start = i + 1;
    } else if (ch === '}') {
      const prelude = stack.pop() ?? '';
      const body = text.slice(start, i);
      // A block holding declarations (the innermost one); nested rules
      // already took their own parts out by moving `start`.
      if (prelude && !prelude.startsWith('@font-face') && body.includes(':'))
        out.push({ selector: prelude, body, at: stack.filter((s) => s.startsWith('@')) });
      start = i + 1;
    } else if (ch === ';' && stack.length === 0) start = i + 1;
  }
  return out;
}

function declarations(body) {
  const out = [];
  for (const part of body.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const property = part.slice(0, colon).trim().toLowerCase();
    const value = part
      .slice(colon + 1)
      .replace(/!important/i, '')
      .trim();
    if (property && value && !property.includes('{')) out.push([property, value]);
  }
  return out;
}

/** `#rgb`, `#rrggbb` and opaque `rgb()` as `#rrggbb`; anything else as written. */
function normalize(color) {
  const c = color.trim().toLowerCase();
  let m = /^#([\da-f])([\da-f])([\da-f])([\da-f])?$/.exec(c);
  if (m)
    return normalize(`#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}${m[4] ?? 'f'}${m[4] ?? 'f'}`);
  if (/^#[\da-f]{6}$/.test(c)) return c;
  if (/^#[\da-f]{8}$/.test(c)) return c.endsWith('ff') ? c.slice(0, 7) : c.endsWith('00') ? '' : c;
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(c);
  if (m && (m[4] === undefined || m[4] === '1' || m[4] === '100%'))
    return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  return c.replace(/\s+/g, ' ');
}

class Counter {
  #counts = new Map();
  #notes = new Map();
  /** Counts `key`; `note` (where it was seen) is listed with it. */
  add(key, note) {
    if (!key) return;
    this.#counts.set(key, (this.#counts.get(key) ?? 0) + 1);
    if (note) this.#notes.set(key, new Set([...(this.#notes.get(key) ?? []), note]));
  }
  top(n) {
    return [...this.#counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([value, count]) => {
        const notes = this.#notes.get(value);
        return notes ? { value, count, in: [...notes].slice(0, 3) } : { value, count };
      });
  }
}

/** Splits a selector list on its top-level commas (not those inside `:is()`, `:where()`). */
function splitTop(selector) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      out.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  out.push(selector.slice(start));
  return out;
}

/**
 * The page-level selector a rule is for (`:root`, `html`, `body`, or a dark
 * switch such as `.dark` or `[data-theme=dark]` on them), else undefined.
 */
function pageSelector(selector) {
  for (const part of splitTop(selector)) {
    // The last compound selector, without what's in parentheses.
    const last =
      part
        .replace(/\([^()]*\)/g, '()')
        .trim()
        .split(/[\s>+~]+/)
        .pop() ?? '';
    if (/^(?::root|html|body|:host)(?![\w-])/i.test(last) || DARK_SELECTOR.test(last))
      return short(part.trim().replace(/\s+/g, ' '), 60);
  }
  return undefined;
}

const TABLE_SELECTOR = /(?:^|[\s>+~,(])(?:table|thead|tbody|tr|th|td)(?![\w-])|table|data-?grid/i;
const TABLE_PROPERTY =
  /^(?:background(?:-color)?|color|border(?:-(?:top|bottom|block-end|block-start|collapse|color|width|style|radius))?|padding(?:-inline|-block)?|font-(?:weight|size|family)|text-transform|letter-spacing|box-shadow|line-height|height)$/;

// Fully transparent colours normalize to '' and are left out.
const colorsIn = (value) => (value.match(COLOR) ?? []).map(normalize).filter(Boolean);
const RADIUS = /^[\d.]+(?:px|rem|em)$/;
// A pill (9999px) is no table radius.
const isRadius = (value) => RADIUS.test(value) && Number.parseFloat(value) < 100;

/** `var(--x, fallback)` replaced from the custom properties, a few levels deep. */
function resolveVars(value, props, depth = 0) {
  if (depth > 5 || !value.includes('var(')) return value;
  const next = value.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g,
    (_, name, fallback) => props.get(name) ?? fallback?.trim() ?? '',
  );
  return next === value ? value : resolveVars(next, props, depth + 1);
}
const short = (text, n = 120) => (text.length > n ? `${text.slice(0, n)}…` : text);

async function main(args) {
  const target = args.find((a) => !a.startsWith('--'));
  const maxAt = args.indexOf('--max-sheets');
  const maxSheets = maxAt === -1 ? 8 : Number(args[maxAt + 1]);
  if (!target || !Number.isInteger(maxSheets)) {
    console.error('Usage: node extract-palette.mjs <url> [--max-sheets 8]');
    return 1;
  }

  let page;
  try {
    page = await get(new URL(target).href);
  } catch (error) {
    console.error(
      `Couldn't load ${target}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  const html = page.text;

  const meta = { themeColor: [], colorScheme: undefined };
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = attr(tag, 'name')?.toLowerCase();
    const content = attr(tag, 'content');
    if (name === 'theme-color' && content)
      meta.themeColor.push({ color: content, media: attr(tag, 'media') });
    if (name === 'color-scheme') meta.colorScheme = attr(tag, 'content');
  }
  const title = short(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? '', 80);

  // Stylesheets in document order: linked ones, then inline <style> and style="" attributes.
  const sources = [];
  const queue = [];
  const fontLinks = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel')?.toLowerCase() ?? '';
    const href = attr(tag, 'href');
    if (!href) continue;
    if (FONT_SERVICE.test(href)) fontLinks.push(href);
    else if (
      rel.split(/\s+/).includes('stylesheet') ||
      (rel === 'preload' && attr(tag, 'as') === 'style')
    )
      queue.push(new URL(href, page.url).href);
  }
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) sources.push(m[1] ?? '');
  const inline = [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(';');
  if (inline) sources.push(`[style]{${inline}}`);

  const fetched = [];
  const failed = [];
  const seen = new Set();
  while (queue.length > 0 && fetched.length < maxSheets) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const sheet = await get(url);
      fetched.push(url);
      sources.push(sheet.text);
      for (const m of sheet.text.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)/gi)) {
        const href = m[1] ?? '';
        if (FONT_SERVICE.test(href)) fontLinks.push(href);
        else queue.push(new URL(href, sheet.url).href);
      }
    } catch (error) {
      failed.push({ url, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const colors = new Counter();
  const scheme = () => ({
    page: { background: new Counter(), text: new Counter(), font: new Counter() },
    buttons: { background: new Counter(), text: new Counter() },
    links: new Counter(),
  });
  const light = scheme();
  const darkSide = scheme();
  const fonts = new Counter();
  const radii = new Counter();
  const tables = new Map();
  const custom = { light: new Map(), dark: new Map() };
  let prefersDark = false;
  let darkSelectors = false;
  const colorScheme = new Set(meta.colorScheme ? [meta.colorScheme] : []);

  // Custom properties first (raw, the first definition of each per scheme),
  // so values that go through var() can be resolved.
  const parsed = sources.map((css) => rules(css));
  const raw = { light: new Map(), dark: new Map() };
  for (const rule of parsed.flat()) {
    const dark =
      rule.at.some((a) => /prefers-color-scheme\s*:\s*dark/i.test(a)) ||
      DARK_SELECTOR.test(rule.selector);
    for (const [property, value] of declarations(rule.body))
      if (property.startsWith('--') && !raw[dark ? 'dark' : 'light'].has(property))
        raw[dark ? 'dark' : 'light'].set(property, value);
  }
  const darkProps = new Map([...raw.light, ...raw.dark]);
  for (const [scheme, props] of [
    ['light', raw.light],
    ['dark', darkProps],
  ]) {
    for (const [name, value] of raw[scheme]) {
      const resolved = resolveVars(value, props);
      const found = colorsIn(resolved);
      if (found.length === 1 && resolved.trim().length < 60) custom[scheme].set(name, found[0]);
      else if (/font|family/i.test(name) && /,|serif|sans|mono/i.test(resolved))
        custom[scheme].set(name, short(resolved, 100));
      else if (/radius/i.test(name) && isRadius(resolved.trim())) radii.add(resolved.trim());
    }
  }

  for (const [index, css] of sources.entries()) {
    if (/prefers-color-scheme\s*:\s*dark/i.test(css)) prefersDark = true;
    for (const rule of parsed[index] ?? []) {
      const darkMedia = rule.at.some((a) => /prefers-color-scheme\s*:\s*dark/i.test(a));
      const darkSelector = DARK_SELECTOR.test(rule.selector);
      if (darkSelector) darkSelectors = true;
      const dark = darkMedia || darkSelector;
      const root = pageSelector(rule.selector);
      const isTable = TABLE_SELECTOR.test(rule.selector) && !dark;
      const isButton = BUTTON_SELECTOR.test(rule.selector);
      const isLink = !isButton && LINK_SELECTOR.test(rule.selector);
      const props = dark ? darkProps : raw.light;
      const side = dark ? darkSide : light;
      for (const [property, written] of declarations(rule.body)) {
        if (property.startsWith('--')) continue;
        const value = resolveVars(written, props);
        if (isTable && TABLE_PROPERTY.test(property) && tables.size <= 15) {
          const key = short(rule.selector.replace(/\s+/g, ' '), 80);
          const entry = tables.get(key) ?? {};
          entry[property] = short(value, 80);
          if (tables.size < 15 || tables.has(key)) tables.set(key, entry);
        }
        if (property === 'color-scheme') colorScheme.add(value);
        if (property === 'font-family' && value) fonts.add(short(value.replace(/\s+/g, ' '), 100));
        if (property === 'font' && /,/.test(value))
          fonts.add(short(value.replace(/\s+/g, ' '), 100));
        if (property === 'border-radius' && isRadius(value)) radii.add(value);
        if (root && property === 'font-family')
          side.page.font.add(short(value.replace(/\s+/g, ' '), 100), root);
        const found = colorsIn(value);
        for (const c of found) colors.add(c);
        if (found.length === 0) continue;
        const bg = property === 'background' || property === 'background-color';
        if (root && bg) side.page.background.add(found[0], root);
        if (root && property === 'color') side.page.text.add(found[0], root);
        if (isButton && bg) side.buttons.background.add(found[0]);
        if (isButton && property === 'color') side.buttons.text.add(found[0]);
        if (isLink && property === 'color') side.links.add(found[0]);
      }
    }
  }

  const pick = (map, test) =>
    Object.fromEntries([...map].filter(([name]) => test(name.replace(/^--/, ''))).slice(0, 25));
  const result = {
    url: page.url,
    title,
    meta,
    page: {
      background: light.page.background.top(3),
      text: light.page.text.top(3),
      font: light.page.font.top(4),
    },
    customProperties: {
      brand: pick(custom.light, (n) => BRAND_NAME.test(n)),
      surface: pick(custom.light, (n) => SURFACE_NAME.test(n)),
      text: pick(custom.light, (n) => TEXT_NAME.test(n)),
      fonts: pick(custom.light, (n) => /font|family/i.test(n)),
    },
    buttons: { background: light.buttons.background.top(5), text: light.buttons.text.top(3) },
    links: light.links.top(5),
    tables: Object.fromEntries(tables),
    colors: colors.top(20),
    fonts: fonts.top(6),
    fontLinks: [...new Set(fontLinks)].slice(0, 5),
    radii: radii.top(6),
    dark: {
      prefersColorScheme: prefersDark,
      selectors: darkSelectors,
      colorScheme: [...colorScheme],
      themeColor: meta.themeColor.filter((t) => /dark/i.test(t.media ?? '')).map((t) => t.color),
      customProperties: pick(
        custom.dark,
        (n) => BRAND_NAME.test(n) || SURFACE_NAME.test(n) || TEXT_NAME.test(n),
      ),
      page: {
        background: darkSide.page.background.top(3),
        text: darkSide.page.text.top(3),
      },
      buttons: { background: darkSide.buttons.background.top(3) },
      links: darkSide.links.top(3),
    },
    sheets: {
      read: fetched.length,
      inline: sources.length - fetched.length,
      failed,
      skipped: queue.length,
    },
  };
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
