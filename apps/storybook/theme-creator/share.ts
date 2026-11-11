// Drafts in links (`#theme=…`, deflated JSON in base64url) and in
// localStorage. A draft built on a shipped preset leaves its base out of the
// link: it's read from the preset again on load.
import type { ThemeDraft } from './model.js';
import { isPreset, newDraft, presetTheme } from './presets.js';

export const STORAGE_KEY = 'argus-theme-creator:draft';
export const HASH_KEY = 'theme';

type Stored = Omit<ThemeDraft, 'base'> & { base?: ThemeDraft['base'] };

function toStored(draft: ThemeDraft): Stored {
  if (!isPreset(draft.preset)) return draft;
  const stored: Stored = { ...draft };
  delete stored.base;
  return stored;
}

/** A stored draft back to a full one; undefined when it isn't one. */
export function fromStored(value: unknown): ThemeDraft | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Partial<Stored>;
  if (v.v !== 1 || typeof v.preset !== 'string') return undefined;
  const base = isPreset(v.preset) ? presetTheme(v.preset) : v.base;
  if (!base || typeof base !== 'object' || typeof base.tokens !== 'object') return undefined;
  const fresh = newDraft('default');
  const record = (x: unknown): object =>
    typeof x === 'object' && x !== null && !Array.isArray(x) ? x : {};
  return {
    v: 1,
    name: typeof v.name === 'string' ? v.name : fresh.name,
    preset: v.preset,
    base: {
      tokens: record(base.tokens) as ThemeDraft['base']['tokens'],
      density: record(base.density),
      parts: Array.isArray(base.parts) ? base.parts : [],
    },
    seeds: record(v.seeds),
    overrides: record(v.overrides) as ThemeDraft['overrides'],
    parts: record(v.parts),
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
