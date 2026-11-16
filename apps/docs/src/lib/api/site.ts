// What the API pages share: the sources they read, and the links between them.
import { resolve } from 'node:path';
import manifest from 'argus-table/custom-elements.json';
import { elementReference, type ElementRef } from './elements';
import { anchorOf, linkTypes, renderDoc } from './render';
import { readTypes, type TypeRef } from './types';

/** The repository root: Astro builds and checks from the docs app's folder. */
const repo = resolve(process.cwd(), '../..');

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

/** A type text as HTML in `<code>`, with links to the types page. */
export function typeHtml(type: string): string {
  const known = new Set(publicTypes().map((t) => t.name));
  return `<code>${linkTypes(type, known, (name) => sitePath(`api/types/#${anchorOf(name)}`))}</code>`;
}

/** A JSDoc text as HTML, or a dash for none. */
export const docHtml = (text: string) => renderDoc(text) || '—';

/** Inline code, escaped. */
export const code = (text: string) =>
  `<code>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;

/** The id of a row: `property-columnsizing`. */
export const rowId = (section: string, name: string) => `${section}-${name.toLowerCase()}`;
