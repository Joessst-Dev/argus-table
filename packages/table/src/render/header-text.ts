import type { GroupHeaderContext, HeaderContext } from '../types.js';

/**
 * A header's name as plain text: a string or number header as text, or what a
 * header function returns in text mode. `undefined` for content (a template, a
 * node, framework content), a missing header or blank text.
 */
export function headerText(
  header: unknown,
  context: HeaderContext | GroupHeaderContext,
): string | undefined {
  const own =
    typeof header === 'function' ? (header as (c: typeof context) => unknown)(context) : header;
  const text = typeof own === 'string' ? own.trim() : typeof own === 'number' ? String(own) : '';
  return text || undefined;
}
