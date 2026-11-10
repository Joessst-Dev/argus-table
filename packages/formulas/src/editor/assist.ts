import { tokenize } from '../engine/tokenize.js';

export type SegmentKind =
  'plain' | 'function' | 'ref' | 'number' | 'text' | 'boolean' | 'operator' | 'name' | 'error';

/** A run of formula text with one colour. */
export interface Segment {
  text: string;
  kind: SegmentKind;
  start: number;
}

/**
 * The formula cut into coloured runs that cover all of it, spaces included,
 * for the editor's highlighting. Never throws: what can't be read is `error`,
 * and a name that isn't a call or `TRUE`/`FALSE` is `name` (also an error).
 */
export function highlight(source: string): Segment[] {
  const tokens = tokenize(source, true);
  const segments: Segment[] = [];
  let at = 0;
  tokens.forEach((token, i) => {
    if (token.kind === 'end') return;
    if (token.start > at) {
      segments.push({ text: source.slice(at, token.start), kind: 'plain', start: at });
    }
    let kind: SegmentKind;
    switch (token.kind) {
      case 'name': {
        const upper = token.value.toUpperCase();
        kind =
          tokens[i + 1]?.kind === 'open'
            ? 'function'
            : upper === 'TRUE' || upper === 'FALSE'
              ? 'boolean'
              : 'name';
        break;
      }
      case 'ref':
        kind = 'ref';
        break;
      case 'number':
        kind = 'number';
        break;
      case 'string':
        kind = 'text';
        break;
      case 'error':
        kind = 'error';
        break;
      default:
        kind = 'operator';
    }
    segments.push({ text: source.slice(token.start, token.end), kind, start: token.start });
    at = token.end;
  });
  if (at < source.length) segments.push({ text: source.slice(at), kind: 'plain', start: at });
  return segments;
}

/** The function call the cursor is in, and which of its arguments (from 0). */
export interface CallContext {
  name: string;
  argument: number;
}

/** The innermost function call around `cursor`, for the argument hint. */
export function callAt(source: string, cursor: number): CallContext | undefined {
  const tokens = tokenize(source, true);
  const stack: { name: string | undefined; argument: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || token.kind === 'end' || token.end > cursor) break;
    const next = tokens[i + 1];
    if (token.kind === 'name' && next?.kind === 'open' && next.end <= cursor) {
      stack.push({ name: token.value.toUpperCase(), argument: 0 });
      i++;
    } else if (token.kind === 'open') {
      stack.push({ name: undefined, argument: 0 });
    } else if (token.kind === 'comma') {
      const top = stack[stack.length - 1];
      if (top) top.argument++;
    } else if (token.kind === 'close') {
      stack.pop();
    }
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    if (entry?.name !== undefined) return { name: entry.name, argument: entry.argument };
  }
  return undefined;
}

export interface Suggestion {
  /** What the list shows. */
  label: string;
  /** What replaces the text from `from` to `to`. */
  insert: string;
  kind: 'column' | 'function' | 'boolean';
}

export interface Completion {
  from: number;
  to: number;
  items: Suggestion[];
}

const IDENTIFIER_END = /[A-Za-z_][A-Za-z0-9_.]*$/;
const IDENTIFIER_START = /^[A-Za-z0-9_.]*/;
const MAX_ITEMS = 12;

/**
 * What can complete the text at `cursor`: column names after an unclosed `[`,
 * or function names (and `TRUE`/`FALSE`) for a name being typed. `undefined`
 * inside text in quotes, or when nothing matches.
 */
export function completionAt(
  source: string,
  cursor: number,
  columns: readonly string[],
  functions: readonly string[],
): Completion | undefined {
  let inText = false;
  let refStart = -1;
  for (let i = 0; i < cursor; i++) {
    const c = source.charAt(i);
    if (inText) {
      if (c === '"') {
        if (source.charAt(i + 1) === '"' && i + 1 < cursor) i++;
        else inText = false;
      }
    } else if (refStart >= 0) {
      if (c === ']') refStart = -1;
    } else if (c === '"') {
      inText = true;
    } else if (c === '[') {
      refStart = i;
    }
  }
  if (inText) return undefined;

  if (refStart >= 0) {
    const typed = source
      .slice(refStart + 1, cursor)
      .trim()
      .toLowerCase();
    const close = source.indexOf(']', cursor);
    const open = source.indexOf('[', cursor);
    const to = close >= 0 && (open < 0 || open > close) ? close + 1 : cursor;
    const matches = columns
      .filter((name) => name.toLowerCase().includes(typed))
      .sort(
        (a, b) =>
          Number(!a.toLowerCase().startsWith(typed)) - Number(!b.toLowerCase().startsWith(typed)),
      )
      .slice(0, MAX_ITEMS);
    if (!matches.length) return undefined;
    return {
      from: refStart,
      to,
      items: matches.map((name) => ({ label: name, insert: `[${name}]`, kind: 'column' })),
    };
  }

  const before = source.slice(0, cursor);
  const word = IDENTIFIER_END.exec(before)?.[0];
  if (!word) return undefined;
  const from = cursor - word.length;
  // Part of a number such as 1e5, or right after a value: not a name.
  if (/[A-Za-z0-9_.\])"]/.test(source.charAt(from - 1))) return undefined;
  const to = cursor + (IDENTIFIER_START.exec(source.slice(cursor))?.[0].length ?? 0);
  const prefix = word.toUpperCase();
  const call = source.charAt(to) === '(';
  const items: Suggestion[] = [
    ...functions
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name): Suggestion => ({
        label: name,
        insert: call ? name : `${name}(`,
        kind: 'function',
      })),
    ...['TRUE', 'FALSE']
      .filter((name) => name.startsWith(prefix) && !call)
      .map((name): Suggestion => ({ label: name, insert: name, kind: 'boolean' })),
  ]
    // Nothing to offer for a name that is already complete.
    .filter((item) => item.label !== source.slice(from, to).toUpperCase() || !call)
    .slice(0, MAX_ITEMS);
  return items.length ? { from, to, items } : undefined;
}
