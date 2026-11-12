// Theme drafts for the argus-table theme creator: validation, and the link
// that opens the creator with a draft. No dependencies and no Node built-ins,
// so it runs in Node 18+ and in browsers alike.
//
// The link format is the creator's own (apps/storybook/theme-creator/share.ts
// in the argus-table repo): `#theme=` and the draft's JSON, deflated
// (`deflate-raw`) and base64url-encoded. A test there checks this file
// against the creator.

export const DEFAULT_BASE_URL = 'https://joessst-dev.github.io/argus-table/';
export const STORY_ID = 'themes-theme-creator--creator';
export const HASH_KEY = 'theme';

/** The shipped themes a draft can start from, and `blank` (seeds only). */
export const PRESETS = ['default', 'material', 'fluent', 'bootstrap', 'minimal'];
export const BASES = [...PRESETS, 'blank'];
export const DENSITIES = ['compact', 'comfortable', 'spacious'];

const color = { kind: 'color' };
const bool = { kind: 'boolean' };
const text = { kind: 'string' };
const range = (min, max) => ({ kind: 'number', min, max });
const perDensity = (min, max) => ({ kind: 'density', min, max });

/** Every seed and its fields. */
export const SEEDS = {
  accent: color,
  surface: color,
  text: color,
  header: {
    style: { kind: 'enum', values: ['body', 'tinted', 'accent'] },
    strength: range(0, 100),
    muted: bool,
  },
  lines: { strength: range(0, 100), width: range(0, 8), outline: bool, radius: range(0, 32) },
  rows: {
    stripes: bool,
    hover: bool,
    height: perDensity(20, 120),
    padding: perDensity(0, 48),
  },
  type: { family: text, size: text, weight: text, mono: text },
  depth: { pinned: range(0, 100), popover: range(0, 100) },
};

/** The curated `::part()` options. */
export const PART_OPTIONS = {
  headerSize: text,
  headerWeight: text,
  uppercase: bool,
  sortedAccent: bool,
  tabularNums: bool,
  pinnedBold: bool,
  pinnedSeparator: bool,
  checkboxAccent: bool,
  skeletonRadius: bool,
};

/** Every token a theme can set: the table's and those of its add-ons. */
export const TOKENS = [
  '--argus-bg',
  '--argus-fg',
  '--argus-font',
  '--argus-header-bg',
  '--argus-header-fg',
  '--argus-border-color',
  '--argus-border-width',
  '--argus-border',
  '--argus-border-radius',
  '--argus-row-height',
  '--argus-cell-padding-inline',
  '--argus-cell-padding-block',
  '--argus-row-odd-bg',
  '--argus-pinned-shadow',
  '--argus-resize-handle-color',
  '--argus-focus-ring',
  '--argus-filter-indicator-color',
  '--argus-drop-indicator-color',
  '--argus-row-hover-bg',
  '--argus-row-pinned-bg',
  '--argus-skeleton-bg',
  '--argus-row-selected-bg',
  '--argus-menu-bg',
  '--argus-menu-fg',
  '--argus-menu-shadow',
  '--argus-menu-item-active-bg',
  '--argus-menu-danger-fg',
  '--argus-menu-detail-font',
  '--argus-dialog-bg',
  '--argus-dialog-fg',
  '--argus-dialog-accent',
  '--argus-dialog-accent-fg',
  '--argus-dialog-shadow',
  '--argus-dialog-backdrop',
  '--argus-formula-error-fg',
  '--argus-formula-font',
  '--argus-formula-input-bg',
  '--argus-formula-function-fg',
  '--argus-formula-ref-bg',
  '--argus-formula-ref-fg',
  '--argus-formula-number-fg',
  '--argus-formula-text-fg',
];

const DRAFT_KEYS = ['v', 'name', 'preset', 'seeds', 'overrides', 'parts', 'removedParts'];

// A colour the creator can read: hex, a colour function or a named colour.
// No var(), light-dark() or system colours: seeds are plain colours.
const COLOR =
  /^(?:#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|[a-z]+)$/i;
const NOT_A_SEED_COLOR = /^(?:currentcolor|transparent|inherit|initial|unset|canvas|canvastext)$/i;

const isRecord = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const suggest = (name, known) => {
  const hit = known.find((k) => k.toLowerCase() === String(name).toLowerCase());
  return hit ? ` (did you mean "${hit}"?)` : ` (known: ${known.join(', ')})`;
};

function checkColor(value, path, errors) {
  if (typeof value !== 'string' || !COLOR.test(value.trim()) || NOT_A_SEED_COLOR.test(value)) {
    errors.push(
      `${path}: expected a plain CSS colour such as "#2f5bd3", got ${JSON.stringify(value)}`,
    );
    return false;
  }
  return true;
}

function checkField(spec, value, path, errors) {
  switch (spec.kind) {
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path}: expected true or false`);
      return;
    case 'string':
      if (typeof value !== 'string') errors.push(`${path}: expected a string`);
      return;
    case 'enum':
      if (!spec.values.includes(value))
        errors.push(`${path}: expected one of ${spec.values.map((v) => `"${v}"`).join(', ')}`);
      return;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value))
        errors.push(`${path}: expected a number`);
      else if (value < spec.min || value > spec.max)
        errors.push(`${path}: ${String(value)} is outside ${String(spec.min)}–${String(spec.max)}`);
      return;
    case 'density':
      if (!isRecord(value)) {
        errors.push(`${path}: expected { compact, comfortable, spacious } in px`);
        return;
      }
      for (const [key, n] of Object.entries(value)) {
        if (!DENSITIES.includes(key))
          errors.push(`${path}.${key}: unknown density${suggest(key, DENSITIES)}`);
        else
          checkField({ kind: 'number', min: spec.min, max: spec.max }, n, `${path}.${key}`, errors);
      }
      return;
  }
}

function checkSeeds(seeds, errors) {
  if (!isRecord(seeds)) {
    errors.push('seeds: expected an object');
    return;
  }
  const names = Object.keys(SEEDS);
  for (const [name, value] of Object.entries(seeds)) {
    const spec = SEEDS[name];
    if (!spec) {
      errors.push(`seeds.${name}: unknown seed${suggest(name, names)}`);
      continue;
    }
    if (spec === color) {
      if (!isRecord(value) || (value.light === undefined && value.dark === undefined)) {
        errors.push(
          `seeds.${name}: expected { "light": colour, "dark": colour } (either may be left out)`,
        );
        continue;
      }
      for (const key of Object.keys(value))
        if (key !== 'light' && key !== 'dark')
          errors.push(`seeds.${name}.${key}: expected light or dark`);
      if (value.light !== undefined) checkColor(value.light, `seeds.${name}.light`, errors);
      if (value.dark !== undefined) checkColor(value.dark, `seeds.${name}.dark`, errors);
      continue;
    }
    if (!isRecord(value)) {
      errors.push(`seeds.${name}: expected an object`);
      continue;
    }
    const fields = Object.keys(spec);
    for (const [field, fieldValue] of Object.entries(value)) {
      const fieldSpec = spec[field];
      if (!fieldSpec) errors.push(`seeds.${name}.${field}: unknown field${suggest(field, fields)}`);
      else checkField(fieldSpec, fieldValue, `seeds.${name}.${field}`, errors);
    }
  }
}

function checkValue(value, path, errors) {
  if (typeof value === 'string') {
    if (value.trim() === '') errors.push(`${path}: empty value`);
    else if (/[;{}]/.test(value)) errors.push(`${path}: a value can't hold ";", "{" or "}"`);
    return;
  }
  if (isRecord(value) && typeof value.light === 'string' && typeof value.dark === 'string') {
    for (const key of Object.keys(value))
      if (key !== 'light' && key !== 'dark') errors.push(`${path}.${key}: expected light or dark`);
    checkValue(value.light, `${path}.light`, errors);
    checkValue(value.dark, `${path}.dark`, errors);
    return;
  }
  errors.push(`${path}: expected a CSS value, or { "light": value, "dark": value }`);
}

/**
 * Checks a draft and fills in what may be left out (`v`, `name`, `preset` and
 * the empty records). Returns the draft as the creator stores it, with the
 * problems found; a draft with errors makes no link.
 */
export function validateDraft(input) {
  const errors = [];
  const warnings = [];
  if (!isRecord(input))
    return { draft: undefined, errors: ['The draft must be a JSON object.'], warnings };

  for (const key of Object.keys(input))
    if (!DRAFT_KEYS.includes(key)) errors.push(`${key}: unknown key${suggest(key, DRAFT_KEYS)}`);
  if (input.v !== undefined && input.v !== 1) errors.push('v: only version 1 exists');
  if (input.name !== undefined && typeof input.name !== 'string')
    errors.push('name: expected a string');
  const preset = input.preset ?? 'default';
  if (!BASES.includes(preset))
    errors.push(`preset: unknown base "${String(preset)}"${suggest(preset, BASES)}`);

  const seeds = input.seeds ?? {};
  checkSeeds(seeds, errors);

  const parts = input.parts ?? {};
  if (!isRecord(parts)) errors.push('parts: expected an object');
  else
    for (const [name, value] of Object.entries(parts)) {
      const spec = PART_OPTIONS[name];
      if (!spec)
        errors.push(
          `parts.${name}: unknown part option${suggest(name, Object.keys(PART_OPTIONS))}`,
        );
      else checkField(spec, value, `parts.${name}`, errors);
    }

  const overrides = input.overrides ?? {};
  if (!isRecord(overrides)) errors.push('overrides: expected an object');
  else
    for (const [name, value] of Object.entries(overrides)) {
      if (!TOKENS.includes(name)) {
        errors.push(
          `overrides.${name}: unknown token${TOKENS.includes(`--argus-${name}`) ? ` (did you mean "--argus-${name}"?)` : ''}`,
        );
        continue;
      }
      checkValue(value, `overrides.${name}`, errors);
    }

  const removedParts = input.removedParts ?? [];
  if (!Array.isArray(removedParts) || removedParts.some((p) => typeof p !== 'string'))
    errors.push('removedParts: expected an array of strings');

  if (isRecord(seeds))
    for (const name of ['accent', 'surface', 'text']) {
      if (!isRecord(seeds[name])) continue;
      if (seeds[name].dark === undefined)
        warnings.push(
          name === 'surface'
            ? 'seeds.surface has no dark colour: it keeps the base theme’s.'
            : `seeds.${name} has no dark colour: the creator derives one.`,
        );
      if (seeds[name].light === undefined)
        warnings.push(`seeds.${name} has no light colour: it keeps the base theme’s.`);
    }

  const draft = {
    v: 1,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'My theme',
    preset,
    seeds,
    overrides,
    parts,
    removedParts,
  };
  return { draft: errors.length === 0 ? draft : undefined, errors, warnings };
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const fromBase64Url = (text) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const body = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

/** A draft as the creator's link encodes it. */
export async function encodeDraft(draft) {
  const json = new TextEncoder().encode(JSON.stringify(draft));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** The draft in a creator link (or its encoded part), as stored; undefined when unreadable. */
export async function decodeLink(link) {
  const text = link.includes('#')
    ? new URLSearchParams(link.slice(link.indexOf('#') + 1)).get(HASH_KEY)
    : link;
  if (!text) return undefined;
  try {
    const bytes = await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/** The link that opens the theme creator with a (valid) draft. */
export async function themeLink(draft, baseUrl = DEFAULT_BASE_URL) {
  const url = new URL('iframe.html', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  url.search = new URLSearchParams({ id: STORY_ID, viewMode: 'story' }).toString();
  url.hash = `${HASH_KEY}=${await encodeDraft(draft)}`;
  return url.href;
}
