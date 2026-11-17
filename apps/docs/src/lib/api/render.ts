// Rendering for the API reference: JSDoc as Markdown, and type texts escaped
// with links to the public types they name.
import { Marked } from 'marked';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const marked = new Marked({
  async: false,
  gfm: true,
  // JSDoc mentions elements (`<template>` children): text, never markup.
  renderer: {
    html: ({ text }) => escape(text),
  },
});

/** JSDoc text as HTML; `''` for none. */
export function renderDoc(markdown: string): string {
  return markdown.trim() === '' ? '' : (marked.parse(markdown) as string);
}

/** The anchor of a type on the types page: `ColumnDef` → `columndef`. */
export const anchorOf = (name: string) => name.toLowerCase();

/** A type text as escaped HTML, each known type name a link to `href(name)`. */
export function linkTypes(
  type: string,
  known: ReadonlySet<string>,
  href: (name: string) => string,
): string {
  return type
    .split(/\b([A-Za-z_$][\w$]*)\b/)
    .map((part, i) =>
      i % 2 === 1 && known.has(part) ? `<a href="${escape(href(part))}">${part}</a>` : escape(part),
    )
    .join('');
}
