// Drafts in links (`#theme=…`, deflated JSON in base64url) and in
// localStorage. A draft built on a shipped preset leaves its base out of the
// link: it's read from the preset again on load. Links may be written by hand
// or by an agent (the argus-table-theme skill in skills/, whose
// scripts/draft.mjs writes this format), so a draft is checked as it's read:
// touched seeds are completed from the base, and what isn't a draft's is left
// out.
import { parseColor } from './color.js';
import { DEFAULT_SEEDS, autoDarkAccent, autoText, readSeeds } from './derive.js';
import {
  SEED_NAMES,
  emptyTheme,
  type ParsedTheme,
  type PartOptions,
  type Seeds,
  type ThemeDraft,
  type Value,
} from './model.js';
import { isPreset, newDraft, presetTheme } from './presets.js';
import { PART_OPTION_NAMES, readPartOptions } from './resolve.js';

export const STORAGE_KEY = 'argus-theme-creator:draft';
export const HASH_KEY = 'theme';

type Stored = Omit<ThemeDraft, 'base'> & { base?: ThemeDraft['base'] };

function toStored(draft: ThemeDraft): Stored {
  if (!isPreset(draft.preset)) return draft;
  const stored: Stored = { ...draft };
  delete stored.base;
  return stored;
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const record = (x: unknown): Record<string, unknown> => (isRecord(x) ? x : {});

const SEED_CHOICES: Readonly<Record<string, readonly unknown[]>> = {
  'header.style': ['body', 'tinted', 'accent'],
};
const COLOR_SEEDS = new Set(['accent', 'surface', 'text']);

/** `given` where it has the shape of `base`, else `base`; records field by field. */
function shaped(base: unknown, given: unknown, path: string): unknown {
  if (isRecord(base)) {
    const own = record(given);
    return Object.fromEntries(
      Object.entries(base).map(([key, value]) => [key, shaped(value, own[key], `${path}.${key}`)]),
    );
  }
  if (typeof given !== typeof base || (typeof given === 'number' && !Number.isFinite(given)))
    return base;
  const choices = SEED_CHOICES[path];
  if (choices && !choices.includes(given)) return base;
  if (COLOR_SEEDS.has(path.split('.')[0] ?? '') && !parseColor(given as string)) return base;
  return given;
}

/**
 * The touched seeds, each completed from the base's (every seed for a blank
 * start, which has no base to read). A colour without its dark side gets one
 * the way the creator's controls pick it.
 */
function completeSeeds(value: unknown, base: Seeds, all: boolean): Partial<Seeds> {
  const own = record(value);
  const out: Record<string, unknown> = {};
  for (const name of SEED_NAMES)
    if (all || own[name] !== undefined) out[name] = shaped(base[name], own[name], name);
  const seeds = out as Partial<Seeds>;
  const lacksDark = (name: 'accent' | 'text') => {
    const given = record(own[name]);
    return seeds[name] !== undefined && given.light !== undefined && given.dark === undefined;
  };
  const surfaceDark = (seeds.surface ?? base.surface).dark;
  if (seeds.accent && lacksDark('accent'))
    seeds.accent = { ...seeds.accent, dark: autoDarkAccent(seeds.accent.light, surfaceDark) };
  if (seeds.text && lacksDark('text')) seeds.text = { ...seeds.text, dark: autoText(surfaceDark) };
  return seeds;
}

/** The part options that have the type of an option. */
function checkParts(value: unknown, base: PartOptions): Partial<PartOptions> {
  const own = record(value);
  return Object.fromEntries(
    PART_OPTION_NAMES.filter(
      (name) => own[name] !== undefined && typeof own[name] === typeof base[name],
    ).map((name) => [name, own[name]]),
  );
}

const isValue = (x: unknown): x is Value =>
  typeof x === 'string' ||
  (isRecord(x) && typeof x.light === 'string' && typeof x.dark === 'string');

/** Overrides of `--argus-*` tokens with a value or a pair. */
function checkOverrides(value: unknown): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(record(value))
      .filter(
        (entry): entry is [string, Value] => entry[0].startsWith('--argus-') && isValue(entry[1]),
      )
      .map(([name, v]) => [name, typeof v === 'string' ? v : { light: v.light, dark: v.dark }]),
  );
}

/** A stored draft back to a full one; undefined when it isn't one. */
export function fromStored(value: unknown): ThemeDraft | undefined {
  if (!isRecord(value)) return undefined;
  const v = value as Partial<Stored>;
  if (v.v !== 1 || typeof v.preset !== 'string') return undefined;
  // A blank start written without its base (by hand or by an agent) starts
  // from nothing, with the blank draft's part options.
  const blank = v.preset === 'blank' && v.base === undefined;
  const base = isPreset(v.preset) ? presetTheme(v.preset) : blank ? emptyTheme() : v.base;
  if (!isRecord(base) || !isRecord(base.tokens)) return undefined;
  const fresh = newDraft('default');
  const theme: ParsedTheme = {
    tokens: base.tokens,
    density: record(base.density),
    parts: Array.isArray(base.parts) ? base.parts : [],
  };
  const parts = checkParts(v.parts, readPartOptions(theme.parts));
  return {
    v: 1,
    name: typeof v.name === 'string' ? v.name : fresh.name,
    preset: v.preset,
    base: theme,
    seeds: completeSeeds(
      v.seeds,
      v.preset === 'blank' ? DEFAULT_SEEDS : readSeeds(theme),
      v.preset === 'blank',
    ),
    overrides: checkOverrides(v.overrides),
    parts: blank ? { ...newDraft('blank').parts, ...parts } : parts,
    removedParts: Array.isArray(v.removedParts)
      ? v.removedParts.filter((p) => typeof p === 'string')
      : [],
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
) {
  const body = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

export async function encodeDraft(draft: ThemeDraft): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toStored(draft)));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeDraft(text: string): Promise<ThemeDraft | undefined> {
  try {
    const bytes = await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw'));
    return fromStored(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return undefined;
  }
}

/** The encoded draft in a URL's hash (`#theme=…`), if any. */
export function hashDraft(url: string): string | undefined {
  const hash = new URL(url).hash.slice(1);
  return new URLSearchParams(hash).get(HASH_KEY) ?? undefined;
}

/**
 * A link to the creator on its own page (the story's iframe), which keeps the
 * hash; the Storybook manager's URL doesn't carry one reliably.
 */
export async function shareLink(draft: ThemeDraft, location: Location): Promise<string> {
  const url = new URL('iframe.html', location.href);
  url.search = new URLSearchParams({
    id: 'themes-theme-creator--creator',
    viewMode: 'story',
  }).toString();
  url.hash = `${HASH_KEY}=${await encodeDraft(draft)}`;
  return url.href;
}

export function saveDraft(draft: ThemeDraft, storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(toStored(draft)));
  } catch {
    // Storage full or blocked: the draft lives on in the page.
  }
}

export function loadDraft(storage: Storage = localStorage): ThemeDraft | undefined {
  try {
    const text = storage.getItem(STORAGE_KEY);
    return text ? fromStored(JSON.parse(text)) : undefined;
  } catch {
    return undefined;
  }
}

export function clearDraft(storage: Storage = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
