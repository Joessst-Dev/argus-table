// Seeds: a few high-level choices, each of which writes a group of tokens for
// both schemes. `readSeeds` estimates the seeds of a base theme, so untouched
// seeds show (and feed into touched ones) what the base theme does.
import {
  ensureContrast,
  formatColor,
  mix,
  onColor,
  parseColor,
  toOklch,
  fromOklch,
  type Rgb,
} from './color.js';
import {
  DENSITIES,
  type Density,
  type ParsedTheme,
  type SchemeName,
  type SeedName,
  type Seeds,
  type Value,
} from './model.js';
import { colorIn, lookupIn, pairText, resolveColor } from './values.js';

const WHITE: Rgb = { r: 1, g: 1, b: 1, a: 1 };
const BLACK: Rgb = { r: 0, g: 0, b: 0, a: 1 };

/** The element's sizes per density when a theme sets none. */
export const ELEMENT_SIZES: Seeds['rows'] = {
  stripes: false,
  hover: false,
  height: { compact: 32, comfortable: 40, spacious: 52 },
  padding: { compact: 8, comfortable: 12, spacious: 16 },
};

/** The seeds of a theme with nothing set: the default theme's look. */
export const DEFAULT_SEEDS: Seeds = {
  accent: { light: '#2f5bd3', dark: '#8aa6f2' },
  surface: { light: '#ffffff', dark: '#14171c' },
  text: { light: '#1f2329', dark: '#e6e8eb' },
  header: { style: 'tinted', strength: 30, muted: false },
  lines: { strength: 25, width: 1, outline: false, radius: 0 },
  rows: { ...ELEMENT_SIZES, hover: true },
  type: { family: '', size: '', weight: '', mono: '' },
  depth: { pinned: 35, popover: 50 },
};

const clamp = (n: number, lo = 0, hi = 100) => Math.round(Math.min(hi, Math.max(lo, n)));
const px = (value: Value | undefined) =>
  typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;

const same = (a: Rgb | undefined, b: Rgb | undefined) =>
  a !== undefined && b !== undefined && formatColor(a) === formatColor(b);

/** How far `c` is from `a` towards `b` in OKLCH lightness (0–1). */
function towards(a: Rgb, b: Rgb, c: Rgb): number {
  const la = toOklch(a).l;
  const lb = toOklch(b).l;
  const lc = toOklch(c).l;
  return Math.abs(lb - la) < 1e-3 ? 0 : (lc - la) / (lb - la);
}

const FONT =
  /^(?:(normal|bold|\d{3})\s+)?(?:(normal|italic)\s+)?([\d.]+(?:[a-z]+|%))(?:\/[\d.]+[a-z%]*)?\s+(.+)$/i;

/** A theme's seeds, estimated from what it sets. */
export function readSeeds(base: ParsedTheme): Seeds {
  const lookup = lookupIn(base.tokens);
  const per = <T>(fn: (scheme: SchemeName) => T) => ({ light: fn('light'), dark: fn('dark') });
  const color = (name: string, scheme: SchemeName) => {
    const value = lookup(name);
    if (value === undefined) return undefined;
    const text = typeof value === 'string' ? value : value[scheme];
    return resolveColor(text, scheme, lookup) ?? colorIn(text, scheme, lookup);
  };
  const hexOr = (rgb: Rgb | undefined, fallback: string) => (rgb ? formatColor(rgb) : fallback);

  const accent = per(
    (s) =>
      ['--argus-resize-handle-color', '--argus-drop-indicator-color', '--argus-focus-ring']
        .filter((name) => base.tokens[name] !== undefined)
        .map((name) => color(name, s))
        .find((c) => c !== undefined) ?? parseColor(DEFAULT_SEEDS.accent[s]),
  );
  const surface = per((s) => color('--argus-bg', s));
  const text = per((s) => color('--argus-fg', s));
  const headerBg = per((s) => color('--argus-header-bg', s));
  const headerFg = per((s) => color('--argus-header-fg', s));
  const border = per((s) => color('--argus-border-color', s));

  const header: Seeds['header'] = { ...DEFAULT_SEEDS.header };
  const { light: bg, dark: bgDark } = surface;
  const { light: fg } = text;
  if (bg && fg && headerBg.light) {
    if (same(headerBg.light, bg) && same(headerBg.dark, bgDark)) {
      header.style = 'body';
      header.strength = 0;
    } else {
      const accentLight = accent.light;
      const chroma = toOklch(headerBg.light).c;
      header.style = accentLight && chroma > 0.02 ? 'accent' : 'tinted';
      const toward = header.style === 'accent' && accentLight ? accentLight : fg;
      const amount = towards(bg, toward, headerBg.light);
      header.strength = clamp((amount / (header.style === 'accent' ? 0.2 : 0.12)) * 100);
    }
    header.muted = headerFg.light !== undefined && !same(headerFg.light, fg);
  }

  const lines: Seeds['lines'] = {
    strength: DEFAULT_SEEDS.lines.strength,
    width: px(lookup('--argus-border-width')) || 1,
    outline: (base.tokens['--argus-border'] ?? 'none') !== 'none',
    radius: px(base.tokens['--argus-border-radius']) || 0,
  };
  if (bg && fg && border.light)
    lines.strength = clamp((towards(bg, fg, border.light) - 0.06) / 0.0018);

  const rows: Seeds['rows'] = {
    stripes: !same(color('--argus-row-odd-bg', 'light'), bg),
    hover:
      base.tokens['--argus-row-hover-bg'] !== undefined &&
      !same(color('--argus-row-hover-bg', 'light'), color('--argus-row-odd-bg', 'light')),
    height: { ...ELEMENT_SIZES.height },
    padding: { ...ELEMENT_SIZES.padding },
  };
  for (const density of DENSITIES) {
    // A token without a density selector applies to every density.
    const sizes = { ...base.tokens, ...base.density[density] };
    rows.height[density] = px(sizes['--argus-row-height']) || ELEMENT_SIZES.height[density];
    rows.padding[density] =
      px(sizes['--argus-cell-padding-inline']) || ELEMENT_SIZES.padding[density];
  }

  const type: Seeds['type'] = { ...DEFAULT_SEEDS.type };
  const font = base.tokens['--argus-font'];
  if (typeof font === 'string' && font !== 'inherit') {
    const match = FONT.exec(font);
    if (match) {
      type.weight = match[1] ?? '';
      type.size = match[3] ?? '';
      type.family = match[4] ?? '';
    } else type.family = font;
  }
  const mono = base.tokens['--argus-formula-font'];
  if (typeof mono === 'string') type.mono = mono;

  const depth: Seeds['depth'] = { ...DEFAULT_SEEDS.depth };
  const shadow = base.tokens['--argus-pinned-shadow'];
  if (shadow === 'none') depth.pinned = 0;
  else if (typeof shadow === 'string') {
    const x = Number.parseFloat(shadow);
    if (!Number.isNaN(x)) depth.pinned = clamp((x - 2) / 0.06);
  }

  const hexPair = (pair: Record<SchemeName, Rgb | undefined>, fallback: Seeds['accent']) => ({
    light: hexOr(pair.light, fallback.light),
    dark: hexOr(pair.dark, fallback.dark),
  });
  return {
    accent: hexPair(accent, DEFAULT_SEEDS.accent),
    surface: hexPair(surface, DEFAULT_SEEDS.surface),
    text: hexPair(text, DEFAULT_SEEDS.text),
    header,
    lines,
    rows,
    type,
    depth,
  };
}

/** A text colour that reads well on `bg`, tinted with its hue. */
export function autoText(bg: string): string {
  const background = parseColor(bg) ?? WHITE;
  const { l, h, c } = toOklch(background);
  const dark = l > 0.6;
  const base = fromOklch({ l: dark ? 0.22 : 0.94, c: Math.min(c, 0.015), h, a: 1 });
  return formatColor(ensureContrast(base, background, 7));
}

/** The dark-scheme accent for a light one: lifted until it reads on the dark surface. */
export function autoDarkAccent(accent: string, darkSurface: string): string {
  const a = parseColor(accent) ?? BLACK;
  const bg = parseColor(darkSurface) ?? BLACK;
  const lifted = fromOklch({ ...toOklch(a), l: Math.max(toOklch(a).l, 0.72) });
  return formatColor(ensureContrast(lifted, bg, 4.5));
}

/** Seeds with their colours parsed, per scheme. */
interface Colors {
  bg: Rgb;
  fg: Rgb;
  accent: Rgb;
}

/** A seed, or one field of it: `surface`, `lines.radius`. */
export type SeedPath = SeedName | `${SeedName}.${string}`;

interface Derivation {
  token: string;
  /** What this token follows; it's written when one of them changed. */
  deps: (seeds: Seeds) => SeedPath[];
  value: (seeds: Seeds, colors: Record<SchemeName, Colors>) => Value;
}

const perScheme = (
  colors: Record<SchemeName, Colors>,
  fn: (c: Colors, scheme: SchemeName) => Rgb,
): string => pairText(fn(colors.light, 'light'), fn(colors.dark, 'dark'));

/** `strength` (0–100) of the border, as an amount of the text colour in the background. */
const borderAmount = (seeds: Seeds) => 0.06 + seeds.lines.strength * 0.0018;

const shadowAlpha = (light: number, dark: number) =>
  `light-dark(rgb(0 0 0 / ${light.toFixed(2)}), rgb(0 0 0 / ${dark.toFixed(2)}))`;

function popoverShadow(strength: number, scale: number): string {
  if (strength === 0) return 'none';
  const y = Math.round((2 + strength * 0.04) * scale);
  const blur = Math.round((8 + strength * 0.16) * scale);
  return `0 ${String(y)}px ${String(blur)}px ${shadowAlpha(0.08 + strength * 0.0016, 0.3 + strength * 0.004)}`;
}

const accentPair = (colors: Record<SchemeName, Colors>) => perScheme(colors, (c) => c.accent);

const DERIVATIONS: Derivation[] = [
  { token: '--argus-bg', deps: () => ['surface'], value: (_, c) => perScheme(c, (x) => x.bg) },
  { token: '--argus-fg', deps: () => ['text'], value: (_, c) => perScheme(c, (x) => x.fg) },
  {
    token: '--argus-header-bg',
    deps: ({ header }) =>
      header.style === 'body'
        ? ['header.style']
        : header.style === 'accent'
          ? ['header.style', 'header.strength', 'surface', 'accent']
          : ['header.style', 'header.strength', 'surface', 'text'],
    value: ({ header }, c) =>
      header.style === 'body'
        ? 'var(--argus-bg)'
        : perScheme(c, (x) =>
            header.style === 'accent'
              ? mix(x.bg, x.accent, (header.strength / 100) * 0.2)
              : mix(x.bg, x.fg, (header.strength / 100) * 0.12),
          ),
  },
  {
    token: '--argus-header-fg',
    deps: ({ header }) => (header.muted ? ['header.muted', 'surface', 'text'] : ['header.muted']),
    value: ({ header }, c) =>
      header.muted ? perScheme(c, (x) => mix(x.fg, x.bg, 0.28)) : 'var(--argus-fg)',
  },
  {
    token: '--argus-border-color',
    deps: () => ['lines.strength', 'surface', 'text'],
    value: (seeds, c) => perScheme(c, (x) => mix(x.bg, x.fg, borderAmount(seeds))),
  },
  {
    token: '--argus-border-width',
    deps: () => ['lines.width'],
    value: ({ lines }) => `${String(lines.width)}px`,
  },
  {
    token: '--argus-border',
    deps: ({ lines }) =>
      lines.outline
        ? ['lines.outline', 'lines.width', 'lines.strength', 'surface', 'text']
        : ['lines.outline'],
    value: (seeds, c) =>
      seeds.lines.outline
        ? `${String(seeds.lines.width)}px solid ${perScheme(c, (x) => mix(x.bg, x.fg, borderAmount(seeds) + 0.06))}`
        : 'none',
  },
  {
    token: '--argus-border-radius',
    deps: () => ['lines.radius'],
    value: ({ lines }) => (lines.radius === 0 ? '0' : `${String(lines.radius)}px`),
  },
  {
    token: '--argus-row-odd-bg',
    deps: ({ rows }) => (rows.stripes ? ['rows.stripes', 'surface', 'text'] : ['rows.stripes']),
    value: ({ rows }, c) =>
      rows.stripes ? perScheme(c, (x) => mix(x.bg, x.fg, 0.035)) : 'var(--argus-bg)',
  },
  {
    token: '--argus-row-hover-bg',
    deps: ({ rows }) => (rows.hover ? ['rows.hover', 'surface', 'text'] : ['rows.hover']),
    // `initial`: the element's own fallback, no change on hover.
    value: ({ rows }, c) =>
      rows.hover ? perScheme(c, (x, s) => mix(x.bg, x.fg, s === 'light' ? 0.05 : 0.08)) : 'initial',
  },
  {
    token: '--argus-row-selected-bg',
    deps: () => ['accent', 'surface'],
    value: (_, c) => perScheme(c, (x, s) => mix(x.bg, x.accent, s === 'light' ? 0.14 : 0.28)),
  },
  {
    token: '--argus-row-pinned-bg',
    deps: ({ header }) =>
      header.style === 'body' ? ['header.style', 'surface', 'text'] : ['header.style'],
    value: ({ header }, c) =>
      header.style === 'body'
        ? perScheme(c, (x) => mix(x.bg, x.fg, 0.025))
        : 'var(--argus-header-bg)',
  },
  {
    token: '--argus-skeleton-bg',
    deps: () => ['surface', 'text'],
    value: (_, c) => perScheme(c, (x) => mix(x.bg, x.fg, 0.1)),
  },
  {
    token: '--argus-pinned-shadow',
    deps: () => ['depth.pinned'],
    value: ({ depth }) => {
      if (depth.pinned === 0) return 'none';
      const x = Math.round(2 + depth.pinned * 0.06);
      const blur = Math.round(3 + depth.pinned * 0.09);
      return `${String(x)}px 0 ${String(blur)}px -${String(x)}px ${shadowAlpha(0.06 + depth.pinned * 0.0016, 0.3 + depth.pinned * 0.004)}`;
    },
  },
  ...[
    '--argus-resize-handle-color',
    '--argus-drop-indicator-color',
    '--argus-filter-indicator-color',
  ].map((token): Derivation => ({ token, deps: () => ['accent'], value: (_, c) => accentPair(c) })),
  {
    token: '--argus-focus-ring',
    deps: () => ['accent'],
    value: (_, c) => `2px solid ${accentPair(c)}`,
  },
  {
    token: '--argus-font',
    deps: () => ['type.family', 'type.size', 'type.weight'],
    value: ({ type }) => {
      if (type.family.trim() === '') return 'inherit';
      const weight = type.weight.trim() || '400';
      const size = type.size.trim() || '1em';
      return `${weight} ${size}/1.4 ${type.family.trim()}`;
    },
  },
  {
    token: '--argus-menu-item-active-bg',
    deps: () => ['surface', 'text'],
    value: (_, c) => perScheme(c, (x) => mix(x.bg, x.fg, 0.08)),
  },
  {
    token: '--argus-menu-shadow',
    deps: () => ['depth.popover'],
    value: ({ depth }) => popoverShadow(depth.popover, 1),
  },
  {
    token: '--argus-menu-detail-font',
    deps: ({ type }) => (type.mono.trim() ? ['type.mono'] : []),
    value: ({ type }) => type.mono.trim(),
  },
  {
    token: '--argus-dialog-accent',
    deps: () => ['accent'],
    value: (_, c) => accentPair(c),
  },
  {
    token: '--argus-dialog-accent-fg',
    deps: () => ['accent'],
    value: (_, c) => perScheme(c, (x) => onColor(x.accent)),
  },
  {
    token: '--argus-dialog-shadow',
    deps: () => ['depth.popover'],
    value: ({ depth }) => popoverShadow(depth.popover, 2.5),
  },
  {
    token: '--argus-formula-font',
    deps: ({ type }) => (type.mono.trim() ? ['type.mono'] : []),
    value: ({ type }) => type.mono.trim(),
  },
  {
    token: '--argus-formula-function-fg',
    deps: () => ['accent', 'surface'],
    value: (_, c) => perScheme(c, (x) => ensureContrast(x.accent, x.bg, 4.5)),
  },
  {
    token: '--argus-formula-ref-bg',
    deps: () => ['accent', 'surface'],
    value: (_, c) => perScheme(c, (x, s) => mix(x.bg, x.accent, s === 'light' ? 0.12 : 0.25)),
  },
];

const seedOf = (path: SeedPath) => path.split('.')[0] as SeedName;

/** The tokens each seed writes (for the UI). */
export function tokensOf(seed: SeedName, seeds: Seeds): string[] {
  const out = DERIVATIONS.filter((d) => d.deps(seeds).some((p) => seedOf(p) === seed)).map(
    (d) => d.token,
  );
  if (seed === 'rows') out.push('--argus-row-height', '--argus-cell-padding-inline');
  return out;
}

/**
 * Whether a seed path differs between the touched seeds and the base theme's:
 * a seed the user set back to the base's values changes nothing.
 */
export function changedPaths(touched: Partial<Seeds>, base: Seeds): (path: SeedPath) => boolean {
  return (path) => {
    const [seed, field] = path.split('.') as [SeedName, string | undefined];
    const own = touched[seed];
    if (own === undefined) return false;
    const pick = (value: object) =>
      JSON.stringify(field === undefined ? value : (value as Record<string, unknown>)[field]);
    return pick(own) !== pick(base[seed]);
  };
}

/** Parsed seed colours for both schemes. */
export function seedColors(seeds: Seeds): Record<SchemeName, Colors> {
  const colors = (scheme: SchemeName): Colors => ({
    bg: parseColor(seeds.surface[scheme]) ?? WHITE,
    fg: parseColor(seeds.text[scheme]) ?? BLACK,
    accent: parseColor(seeds.accent[scheme]) ?? BLACK,
  });
  return { light: colors('light'), dark: colors('dark') };
}

/**
 * The tokens that follow from the changed seeds, with the other seeds at
 * their effective (base) values. Row sizes go to `density` too.
 */
export function deriveTokens(
  seeds: Seeds,
  changed: (path: SeedPath) => boolean,
): { tokens: Record<string, Value>; density?: Partial<Record<Density, Record<string, Value>>> } {
  const colors = seedColors(seeds);
  const tokens: Record<string, Value> = {};
  for (const derivation of DERIVATIONS) {
    if (!derivation.deps(seeds).some(changed)) continue;
    tokens[derivation.token] = derivation.value(seeds, colors);
  }
  if (!changed('rows.height') && !changed('rows.padding')) return { tokens };
  const { height, padding } = seeds.rows;
  tokens['--argus-row-height'] = `${String(height.comfortable)}px`;
  tokens['--argus-cell-padding-inline'] = `${String(padding.comfortable)}px`;
  const density: Partial<Record<Density, Record<string, Value>>> = {};
  for (const d of ['compact', 'spacious'] as const)
    density[d] = {
      '--argus-row-height': `${String(height[d])}px`,
      '--argus-cell-padding-inline': `${String(padding[d])}px`,
    };
  return { tokens, density };
}

/** A stronger line than the borders, for separators (pinned rows). */
export function separatorColor(seeds: Seeds): string {
  return perScheme(seedColors(seeds), (x) => mix(x.bg, x.fg, borderAmount(seeds) + 0.08));
}

export const accentText = (seeds: Seeds): string => accentPair(seedColors(seeds));
