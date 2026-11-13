import { compress, concat, type Bytes } from '../compress.js';
import { isDay, plainText, type ExportSheet, type ExportValue } from '../sheet.js';
import { textWidth } from './metrics.js';

/** Options for PDF. */
export interface PdfOptions {
  /** Default `'a4'`. */
  pageSize?: 'a4' | 'letter';
  /** Default: landscape when the columns don't fit across a portrait page at full size. */
  orientation?: 'portrait' | 'landscape';
  /** A heading on the first page, and the document's title. */
  title?: string;
}

/** What the PDF writer needs besides the sheet. */
export interface PdfText {
  /** Each page's footer. */
  footer: (item: { page: number; pages: number }) => string;
  /** Locale for dates, as the table shows them. Default: the browser's. */
  locale?: string | undefined;
}

// Points (1/72 in).
const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGIN = 36;
const FONT = 9;
const ROW = 16;
const PAD = 4;
const TITLE = 14;
const FOOTER = 8;
/** CSS px to pt, the most a column is scaled. */
const PX = 0.75;
const ELLIPSIS = 0x85;

// WinAnsi codes 0x80–0x9F that aren't Latin-1.
const WIN_ANSI: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

/**
 * Text as WinAnsi codes, the encoding of the base-14 fonts: Latin-1 and a few
 * more (€, „, …, –, —). Whitespace becomes a space, anything else `?`.
 */
export function winAnsi(text: string): number[] {
  const codes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0x3f;
    if ((cp >= 0x20 && cp < 0x7f) || (cp >= 0xa0 && cp <= 0xff)) codes.push(cp);
    else if (WIN_ANSI[cp] !== undefined) codes.push(WIN_ANSI[cp]);
    else codes.push(/\s/.test(char) ? 0x20 : 0x3f);
  }
  return codes;
}

/** Codes cut to fit `width` points, ending in `…` when cut. */
export function fit(codes: number[], width: number, bold: boolean, size = FONT): number[] {
  if (textWidth(codes, bold, size) <= width) return codes;
  const room = width - textWidth([ELLIPSIS], bold, size);
  let used = 0;
  let end = 0;
  for (const code of codes) {
    used += textWidth([code], bold, size);
    if (used > room) break;
    end++;
  }
  return [...codes.slice(0, end), ELLIPSIS];
}

const num = (n: number) => String(Math.round(n * 100) / 100);
const hex = (codes: readonly number[]) =>
  codes.map((c) => c.toString(16).padStart(2, '0')).join('');

/** A text string for the document's metadata: UTF-16BE with its byte order mark. */
const utf16 = (text: string) => {
  let units = '';
  // JavaScript strings are UTF-16 already: write their code units.
  for (let i = 0; i < text.length; i++) units += text.charCodeAt(i).toString(16).padStart(4, '0');
  return `<FEFF${units}>`;
};

type Align = ExportSheet['columns'][number]['align'];

/** A value as the table shows it: dates in the locale, the rest as plain text. */
function display(value: ExportValue, locale: string | undefined): string {
  if (value instanceof Date) {
    return isDay(value) ? value.toLocaleDateString(locale) : value.toLocaleString(locale);
  }
  return plainText(value);
}

/**
 * The sheet as a PDF: pages of rows under the header rows, which repeat on each
 * page, the columns scaled to the page's width (at most their width in the
 * table), text cut with `…` to fit. It uses the base-14 Helvetica fonts, so text
 * outside WinAnsi (Latin-1 and a few more) shows as `?`.
 */
export async function toPdf(
  sheet: ExportSheet,
  options: PdfOptions,
  text: PdfText,
): Promise<Bytes> {
  const { columns, groups, rows } = sheet;
  const [short, long] = SIZES[options.pageSize ?? 'a4'];
  const tablePx = columns.reduce((n, c) => n + c.width, 0) || 1;
  const landscape = options.orientation
    ? options.orientation === 'landscape'
    : tablePx * PX > short - 2 * MARGIN;
  const [width, height] = landscape ? [long, short] : [short, long];
  const scale = Math.min(PX, (width - 2 * MARGIN) / tablePx);
  const widths = columns.map((c) => c.width * scale);
  const starts = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((n, w) => n + w, 0));
  const tableWidth = widths.reduce((n, w) => n + w, 0);
  const title = options.title ? winAnsi(options.title) : undefined;

  const ops: string[] = [];
  const textAt = (codes: number[], x: number, y: number, bold: boolean, size = FONT) => {
    if (codes.length) {
      ops.push(
        `BT /F${bold ? '2' : '1'} ${String(size)} Tf ${num(x)} ${num(y)} Td <${hex(codes)}> Tj ET`,
      );
    }
  };
  /** Text in a cell from `x`, `w` wide, with its baseline for a row whose bottom is at `y`. */
  const cellText = (
    value: string,
    x: number,
    w: number,
    y: number,
    bold: boolean,
    align: Align,
  ) => {
    const codes = fit(winAnsi(value), w - 2 * PAD, bold);
    const free = w - 2 * PAD - textWidth(codes, bold, FONT);
    const dx = align === 'end' ? free : align === 'center' ? free / 2 : 0;
    textAt(codes, x + PAD + dx, y + (ROW - FONT * 0.7) / 2, bold);
  };
  const fill = (x: number, y: number, w: number) => {
    ops.push(`0.93 g ${num(x + 0.5)} ${num(y)} ${num(w - 1)} ${String(ROW - 1)} re f 0 g`);
  };
  const rule = (y: number, gray: number, lineWidth: number) => {
    ops.push(
      `${String(gray)} G ${String(lineWidth)} w ${num(MARGIN)} ${num(y)} m ${num(MARGIN + tableWidth)} ${num(y)} l S`,
    );
  };
  /** Draws the header rows from `top` down; returns the y below them. */
  const header = (top: number) => {
    let y = top;
    for (const row of groups) {
      y -= ROW;
      let at = 0;
      for (const group of row) {
        const x = starts[at] ?? MARGIN;
        const w = widths.slice(at, at + group.span).reduce((n, v) => n + v, 0);
        if (group.text) {
          fill(x, y, w);
          cellText(group.text, x, w, y, true, 'center');
        }
        at += group.span;
      }
    }
    y -= ROW;
    columns.forEach((c, i) => {
      const x = starts[i] ?? MARGIN;
      const w = widths[i] ?? 0;
      fill(x, y, w);
      cellText(c.header, x, w, y, true, c.align);
    });
    rule(y, 0.6, 0.5);
    return y;
  };

  const top = height - MARGIN;
  const headerHeight = (groups.length + 1) * ROW;
  const firstTop = title ? top - TITLE - 10 : top;
  const fits = (from: number) => Math.max(1, Math.floor((from - MARGIN - headerHeight) / ROW));
  const pages: ExportValue[][][] = [];
  for (let at = 0; at < rows.length || pages.length === 0;) {
    const count = fits(pages.length ? top : firstTop);
    pages.push(rows.slice(at, at + count));
    at += count;
  }

  const contents: string[] = pages.map((pageRows, p) => {
    ops.length = 0;
    if (title && p === 0)
      textAt(fit(title, width - 2 * MARGIN, true, TITLE), MARGIN, top - TITLE, true, TITLE);
    let y = header(p === 0 ? firstTop : top);
    for (const values of pageRows) {
      y -= ROW;
      values.forEach((value, i) => {
        cellText(
          display(value, text.locale),
          starts[i] ?? MARGIN,
          widths[i] ?? 0,
          y,
          false,
          columns[i]?.align ?? 'start',
        );
      });
      rule(y, 0.85, 0.25);
    }
    const foot = winAnsi(text.footer({ page: p + 1, pages: pages.length }));
    textAt(foot, (width - textWidth(foot, false, FOOTER)) / 2, MARGIN / 2, false, FOOTER);
    return ops.join('\n');
  });

  // Objects: 1 catalog, 2 page tree, 3 and 4 the fonts, 5 the info, then a page and its content per page.
  const encoder = new TextEncoder();
  const objects: Bytes[] = [];
  const pageRef = (p: number) => `${String(6 + p * 2)} 0 R`;
  const font = (name: string) =>
    `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
  const dict = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, p) => pageRef(p)).join(' ')}] /Count ${String(pages.length)} >>`,
    font('Helvetica'),
    font('Helvetica-Bold'),
    `<< /Producer (argus-table)${options.title ? ` /Title ${utf16(options.title)}` : ''} >>`,
  ];
  for (const d of dict) objects.push(encoder.encode(d));
  for (const [p, content] of contents.entries()) {
    objects.push(
      encoder.encode(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(width)} ${num(height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${String(7 + p * 2)} 0 R >>`,
      ),
    );
    const stream = await compress(encoder.encode(content), 'deflate');
    objects.push(
      concat([
        encoder.encode(`<< /Length ${String(stream.length)} /Filter /FlateDecode >>\nstream\n`),
        stream,
        encoder.encode('\nendstream'),
      ]),
    );
  }

  // A binary comment after the header tells tools the file has 8-bit bytes.
  const parts: Bytes[] = [
    concat([
      encoder.encode('%PDF-1.4\n%'),
      new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]),
      encoder.encode('\n'),
    ]),
  ];
  let offset = parts[0]?.length ?? 0;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(offset);
    const part = concat([
      encoder.encode(`${String(i + 1)} 0 obj\n`),
      body,
      encoder.encode('\nendobj\n'),
    ]);
    parts.push(part);
    offset += part.length;
  });
  const size = String(objects.length + 1);
  parts.push(
    encoder.encode(
      `xref\n0 ${size}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${size} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${String(offset)}\n%%EOF\n`,
    ),
  );
  return concat(parts);
}
