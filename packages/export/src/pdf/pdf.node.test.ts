import { describe, expect, test } from 'vitest';
import type { ExportSheet } from '../sheet.js';
import { inflate } from '../test/unzip.js';
import { textWidth } from './metrics.js';
import { fit, toPdf, winAnsi } from './pdf.js';

const latin1 = new TextDecoder('latin1');
const column = (id: string, width = 100, align: 'start' | 'center' | 'end' = 'start') => ({
  id,
  header: id,
  align,
  width,
  pin: undefined,
});
const footer = ({ page, pages }: { page: number; pages: number }) =>
  `${String(page)}/${String(pages)}`;

/** The text a content stream shows, decoded from its hex strings. */
const shown = (content: string) =>
  [...content.matchAll(/<([0-9a-f]*)> Tj/g)].map((m) =>
    String.fromCharCode(...(m[1]?.match(/../g) ?? []).map((h) => parseInt(h, 16))),
  );

/** The document as text, and its pages' content streams inflated. */
async function read(bytes: Uint8Array<ArrayBuffer>) {
  const text = latin1.decode(bytes);
  const contents: string[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf('stream\n', from);
    if (start === -1) break;
    const end = text.indexOf('\nendstream', start);
    const data = bytes.slice(start + 7, end);
    contents.push(new TextDecoder().decode(await inflate(data, 'deflate')));
    from = end + 10;
  }
  return { text, contents };
}

describe('pdf text', () => {
  test('winAnsi keeps Latin-1 and WinAnsi’s extras, replaces the rest', () => {
    expect(winAnsi('Größe €5 – “ok”…')).toEqual([
      0x47, 0x72, 0xf6, 0xdf, 0x65, 0x20, 0x80, 0x35, 0x20, 0x96, 0x20, 0x93, 0x6f, 0x6b, 0x94,
      0x85,
    ]);
    expect(winAnsi('日本\tx')).toEqual([0x3f, 0x3f, 0x20, 0x78]);
  });

  test('textWidth uses Helvetica’s metrics', () => {
    expect(textWidth(winAnsi('Aa0'), false, 10)).toBeCloseTo(17.79);
    expect(textWidth(winAnsi('A'), true, 1000)).toBe(722);
  });

  test('fit cuts text with an ellipsis', () => {
    const codes = winAnsi('A long piece of text');
    expect(fit(codes, 1000, false)).toEqual(codes);
    const cut = fit(codes, 40, false);
    expect(cut.at(-1)).toBe(0x85);
    expect(textWidth(cut, false, 9)).toBeLessThanOrEqual(40);
  });
});

describe('toPdf', () => {
  test('writes a valid file structure with an xref that points at each object', async () => {
    const sheet: ExportSheet = {
      columns: [column('name'), column('n', 60, 'end')],
      groups: [],
      rows: [
        ['Ann', 1],
        ['Bob', 2],
      ],
    };
    const bytes = await toPdf(sheet, { title: 'People ✓' }, { footer });
    const { text, contents } = await read(bytes);
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.endsWith('%%EOF\n')).toBe(true);
    const xrefAt = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...text.slice(xrefAt).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(7);
    offsets.forEach((offset, i) => {
      expect(text.slice(offset).startsWith(`${String(i + 1)} 0 obj\n`)).toBe(true);
    });
    expect(text).toContain('/Title <FEFF00500065006f0070006c006500202713>');
    expect(contents).toHaveLength(1);
    expect(shown(contents[0] ?? '')).toEqual([
      'People ?',
      'name',
      'n',
      'Ann',
      '1',
      'Bob',
      '2',
      '1/1',
    ]);
  });

  test('repeats the header rows on every page and numbers the pages', async () => {
    const sheet: ExportSheet = {
      columns: [column('a'), column('b')],
      groups: [[{ text: 'Both', span: 2 }]],
      rows: Array.from({ length: 100 }, (_, i) => [`row ${String(i)}`, i]),
    };
    const { text, contents } = await read(await toPdf(sheet, { pageSize: 'letter' }, { footer }));
    expect(text).toContain('/MediaBox [0 0 612 792]');
    expect(contents.length).toBeGreaterThan(1);
    const pages = contents.map(shown);
    for (const [i, page] of pages.entries()) {
      expect(page.slice(0, 3)).toEqual(['Both', 'a', 'b']);
      expect(page.at(-1)).toBe(`${String(i + 1)}/${String(pages.length)}`);
    }
    const rows = pages.flatMap((page) => page.filter((t) => t.startsWith('row ')));
    expect(rows).toEqual(Array.from({ length: 100 }, (_, i) => `row ${String(i)}`));
  });

  test('turns to landscape for wide tables and writes one page without rows', async () => {
    const wide: ExportSheet = { columns: [column('a', 900)], groups: [], rows: [] };
    const { text, contents } = await read(await toPdf(wide, {}, { footer }));
    expect(text).toContain('/MediaBox [0 0 841.89 595.28]');
    expect(contents).toHaveLength(1);
    const narrow = await read(await toPdf({ ...wide, columns: [column('a')] }, {}, { footer }));
    expect(narrow.text).toContain('/MediaBox [0 0 595.28 841.89]');
    const forced = await read(
      await toPdf({ ...wide, columns: [column('a')] }, { orientation: 'landscape' }, { footer }),
    );
    expect(forced.text).toContain('/MediaBox [0 0 841.89 595.28]');
  });
});
