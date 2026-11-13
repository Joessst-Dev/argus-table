import type { Bytes } from '../compress.js';
import { isDay, type ExportSheet, type ExportValue } from '../sheet.js';
import { zip } from './zip.js';

/** Options for Excel workbooks. */
export interface XlsxOptions {
  /** The worksheet's name, at most 31 characters, without `[]:*?/\`. Default `Sheet1`. */
  sheetName?: string;
}

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
/** Excel's limit on a cell's text. */
const MAX_TEXT = 32767;

// Characters XML 1.0 can't hold.
// eslint-disable-next-line no-control-regex
const INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Text escaped for XML content and attribute values. */
export const xml = (text: string) =>
  text
    .replace(INVALID, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** The column's letters: 0 → `A`, 26 → `AA`. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

/** A sheet name Excel accepts. */
export function sheetName(name: string | undefined): string {
  const clean = (name ?? '')
    .replace(/[[\]:*?/\\]/g, ' ')
    .slice(0, 31)
    .replace(/^'+|'+$/g, '')
    .trim();
  return clean || 'Sheet1';
}

const EPOCH = Date.UTC(1899, 11, 30);
/** Excel's serial number for a date, from its local date and time (its 1900 system). */
export const serial = (date: Date) =>
  (Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ) -
    EPOCH) /
  864e5;

// Cell styles: 4 kinds × 3 alignments, at kind * 3 + alignment.
const KINDS = [
  { numFmt: 0, font: 0 }, // plain
  { numFmt: 0, font: 1 }, // header (bold)
  { numFmt: 14, font: 0 }, // date (built-in, short date in Excel's locale)
  { numFmt: 22, font: 0 }, // date and time (built-in)
];
const ALIGNS = ['', 'center', 'right'];
const PLAIN = 0;
const HEADER = 1;
const DATE = 2;
const DATETIME = 3;
const alignIndex = { start: 0, center: 1, end: 2 } as const;

const STYLES = `${HEAD}<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${String(KINDS.length * ALIGNS.length)}">${KINDS.flatMap(
  ({ numFmt, font }) =>
    ALIGNS.map(
      (align) =>
        `<xf numFmtId="${String(numFmt)}" fontId="${String(font)}" fillId="0" borderId="0" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ''}${font ? ' applyFont="1"' : ''}${align ? ` applyAlignment="1"><alignment horizontal="${align}"/></xf>` : '/>'}`,
    ),
).join(
  '',
)}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const text = (ref: string, style: number, value: string) =>
  `<c r="${ref}" s="${String(style)}" t="inlineStr"><is><t xml:space="preserve">${xml(value.slice(0, MAX_TEXT))}</t></is></c>`;

/** One cell, typed: numbers, booleans and dates as values, the rest as text. */
function cell(ref: string, value: ExportValue, align: number): string {
  if (value === null) return '';
  if (typeof value === 'number')
    return `<c r="${ref}" s="${String(align)}"><v>${String(value)}</v></c>`;
  if (typeof value === 'boolean') {
    return `<c r="${ref}" s="${String(align)}" t="b"><v>${value ? '1' : '0'}</v></c>`;
  }
  if (value instanceof Date) {
    const n = serial(value);
    // Excel's dates start in 1900 (and count a 29 February that wasn't); earlier ones stay text.
    if (n >= 61) {
      const kind = isDay(value) ? DATE : DATETIME;
      return `<c r="${ref}" s="${String(kind * 3 + align)}"><v>${String(n)}</v></c>`;
    }
    return text(ref, PLAIN * 3 + align, value.toISOString());
  }
  return text(ref, PLAIN * 3 + align, value);
}

/** The worksheet's XML. */
function worksheet(sheet: ExportSheet, name: string): { xml: string; filter: string | undefined } {
  const { columns, groups, rows } = sheet;
  const headerRows = groups.length + 1;
  const last = columnName(Math.max(0, columns.length - 1));
  const aligns = columns.map((c) => alignIndex[c.align]);
  const out: string[] = [];
  const merges: string[] = [];

  groups.forEach((row, level) => {
    const r = String(level + 1);
    let at = 0;
    const cells = row.map((group) => {
      const ref = `${columnName(at)}${r}`;
      if (group.span > 1) merges.push(`${ref}:${columnName(at + group.span - 1)}${r}`);
      at += group.span;
      return group.text ? text(ref, HEADER * 3 + 1, group.text) : '';
    });
    out.push(`<row r="${r}">${cells.join('')}</row>`);
  });
  const h = String(headerRows);
  out.push(
    `<row r="${h}">${columns.map((c, i) => text(`${columnName(i)}${h}`, HEADER * 3 + (aligns[i] ?? 0), c.header)).join('')}</row>`,
  );
  rows.forEach((values, index) => {
    const r = String(headerRows + 1 + index);
    out.push(
      `<row r="${r}">${values.map((v, i) => cell(`${columnName(i)}${r}`, v, aligns[i] ?? 0)).join('')}</row>`,
    );
  });

  // Freeze the header rows and the columns pinned to the start.
  const pinned = columns.findIndex((c) => c.pin !== 'start');
  const x = pinned === -1 ? 0 : pinned;
  const topLeft = `${columnName(x)}${String(headerRows + 1)}`;
  const pane = `<pane${x ? ` xSplit="${String(x)}"` : ''} ySplit="${h}" topLeftCell="${topLeft}" activePane="${x ? 'bottomRight' : 'bottomLeft'}" state="frozen"/>`;
  const cols = columns
    .map((c, i) => {
      const n = String(i + 1);
      // Excel's width unit is the width of a digit, about 7 px in Calibri 11.
      const width = Math.min(255, Math.max(2, Math.round((c.width / 7 + 0.7) * 100) / 100));
      return `<col min="${n}" max="${n}" width="${String(width)}" customWidth="1"/>`;
    })
    .join('');
  const range = columns.length ? `A${h}:${last}${String(headerRows + rows.length)}` : undefined;
  const xmlText = `${HEAD}<worksheet xmlns="${MAIN}" xmlns:r="${REL}"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${out.join('')}</sheetData>${range ? `<autoFilter ref="${range}"/>` : ''}${merges.length ? `<mergeCells count="${String(merges.length)}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}</worksheet>`;
  // The defined name Excel keeps for an auto filter, with absolute references.
  const filter = range
    ? `'${name.replaceAll("'", "''")}'!${range.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}`
    : undefined;
  return { xml: xmlText, filter };
}

/** The sheet as an Excel workbook (.xlsx) with one worksheet. */
export async function toXlsx(sheet: ExportSheet, options: XlsxOptions = {}): Promise<Bytes> {
  const name = sheetName(options.sheetName);
  const { xml: sheetXml, filter } = worksheet(sheet, name);
  const encoder = new TextEncoder();
  const files: Record<string, string> = {
    '[Content_Types].xml': `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${TYPE}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${TYPE}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${TYPE}.styles+xml"/></Types>`,
    '_rels/.rels': `${HEAD}<Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${HEAD}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets>${filter ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${xml(filter)}</definedName></definedNames>` : ''}</workbook>`,
    'xl/_rels/workbook.xml.rels': `${HEAD}<Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': STYLES,
    'xl/worksheets/sheet1.xml': sheetXml,
  };
  return zip(
    Object.entries(files).map(([path, content]) => ({ name: path, data: encoder.encode(content) })),
  );
}
