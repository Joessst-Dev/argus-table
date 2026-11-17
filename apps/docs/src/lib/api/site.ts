// What the API pages share: the sources they read, and the links between them.
import { resolve } from 'node:path';
import manifest from 'argus-table/custom-elements.json';
import { ELEMENT_TAGS, elementReference, type ElementRef } from './elements';
import { anchorOf, linkTypes, renderDoc } from './render';
import { readTypes, type TypeRef } from './types';

/** The repository root (`astro.config.mjs` defines it). */
const repo = __REPO_ROOT__;

let cache: TypeRef[] | undefined;

/** The public types of `argus-table`, read once per build. */
export function publicTypes(): TypeRef[] {
  cache ??= readTypes(
    resolve(repo, 'packages/table/src/index.ts'),
    resolve(repo, 'packages/table/tsconfig.json'),
  );
  return cache;
}

export const elementOf = (tag: Parameters<typeof elementReference>[1]): ElementRef =>
  elementReference(manifest, tag);

/** A site path under the base, e.g. `api/types/`. */
export const sitePath = (path: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path}`;

/** Where a type name links: an element class to its page, a type to its entry. */
function linkTargets(): ReadonlyMap<string, string> {
  const targets = new Map(
    publicTypes().map((t) => [t.name, sitePath(`api/types/#${anchorOf(t.name)}`)] as const),
  );
  for (const tag of ELEMENT_TAGS) targets.set(elementOf(tag).className, sitePath(`api/${tag}/`));
  return targets;
}

/** A type text as HTML in `<code>`, with links to the types and element pages. */
export function typeHtml(type: string): string {
  const targets = linkTargets();
  const known = new Set(targets.keys());
  return `<code>${linkTypes(type, known, (name) => targets.get(name) ?? '')}</code>`;
}

/** An add-on's README on GitHub, where its event detail types are documented. */
export const addonReadme = (pkg: string) =>
  `https://github.com/Joessst-Dev/argus-table/blob/main/packages/${pkg.replace('@argus-table/', '')}/README.md`;

/** A JSDoc text as HTML, or a dash for none. */
export const docHtml = (text: string) => renderDoc(text) || '—';

/** Inline code, escaped. */
export const code = (text: string) =>
  `<code>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;

/** The id of a row: `property-columnsizing`. */
export const rowId = (section: string, name: string) => `${section}-${name.toLowerCase()}`;
