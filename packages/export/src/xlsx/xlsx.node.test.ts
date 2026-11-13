import { describe, expect, test } from 'vitest';
import type { ExportSheet } from '../sheet.js';
import { unzip } from '../test/unzip.js';
import { columnName, serial, sheetName, toXlsx, xml } from './xlsx.js';

const column = (id: string, extra: Partial<ExportSheet['columns'][number]> = {}) => ({
  id,
  header: id.toUpperCase(),
  align: 'start' as const,
  width: 70,
  pin: undefined,
  ...extra,
});

const sheetXml = async (sheet: ExportSheet, name?: string) => {
  const files = await unzip(await toXlsx(sheet, { sheetName: name }));
  return { files, sheet: files.get('xl/worksheets/sheet1.xml') ?? '' };
};

describe('xlsx helpers', () => {
  test('columnName counts like Excel', () => {
    expect([0, 25, 26, 51, 52, 701, 702].map(columnName)).toEqual([
      'A',
      'Z',
      'AA',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
    ]);
  });

  test('serial is Excel’s day number, from local time', () => {
    expect(serial(new Date(1900, 2, 1))).toBe(61);
    expect(serial(new Date(2026, 10, 13))).toBe(46339);
    expect(serial(new Date(2026, 10, 13, 18))).toBe(46339.75);
  });

  test('sheetName drops what Excel refuses', () => {
    expect(sheetName('Q1/Q2: [draft]?')).toBe('Q1 Q2   draft');
    expect(sheetName("'quoted'")).toBe('quoted');
    expect(sheetName('x'.repeat(40))).toHaveLength(31);
    expect(sheetName(undefined)).toBe('Sheet1');
    expect(sheetName(' / ')).toBe('Sheet1');
  });

  test('xml escapes markup and drops characters XML can’t hold', () => {
    expect(xml('a<b & "c"\u0001>')).toBe('a&lt;b &amp; &quot;c&quot;&gt;');
  });
});

describe('toXlsx', () => {
  test('writes a workbook with typed cells', async () => {
    const { files, sheet } = await sheetXml({
      columns: [column('name'), column('n', { align: 'end' }), column('ok'), column('when')],
      groups: [],
      rows: [
        ['Ann & <Bob>', 42.5, true, new Date(2026, 10, 13)],
        [null, -1, false, new Date(2026, 10, 13, 18)],
      ],
    });
    expect([...files.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(sheet).toContain(
      '<c r="A1" s="3" t="inlineStr"><is><t xml:space="preserve">NAME</t></is></c>',
    );
    expect(sheet).toContain('<c r="B1" s="5" t="inlineStr">');
    expect(sheet).toContain('<t xml:space="preserve">Ann &amp; &lt;Bob&gt;</t>');
    expect(sheet).toContain('<c r="B2" s="2"><v>42.5</v></c>');
    expect(sheet).toContain('<c r="C2" s="0" t="b"><v>1</v></c>');
    expect(sheet).toContain('<c r="D2" s="6"><v>46339</v></c>');
    expect(sheet).toContain('<c r="D3" s="9"><v>46339.75</v></c>');
    // An empty value has no cell.
    expect(sheet).toContain('<row r="3"><c r="B3"');
    expect(sheet).toContain('<autoFilter ref="A1:D3"/>');
    expect(sheet).toContain(
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    );
    expect(files.get('xl/workbook.xml')).toContain(
      '<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'Sheet1\'!$A$1:$D$3</definedName>',
    );
    expect(files.get('xl/styles.xml')).toContain('<cellXfs count="12">');
  });

  test('merges group headers, freezes pinned columns and sizes columns', async () => {
    const { files, sheet } = await sheetXml(
      {
        columns: [column('a', { pin: 'start', width: 140 }), column('b'), column('c')],
        groups: [
          [
            { text: 'Who', span: 2 },
            { text: '', span: 1 },
          ],
        ],
        rows: [['x', 'y', 'z']],
      },
      "Bob's",
    );
    expect(sheet).toContain('<row r="1"><c r="A1" s="4" t="inlineStr">');
    expect(sheet).toContain('<mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>');
    expect(sheet).toContain(
      '<pane xSplit="1" ySplit="2" topLeftCell="B3" activePane="bottomRight" state="frozen"/>',
    );
    expect(sheet).toContain('<col min="1" max="1" width="20.7" customWidth="1"/>');
    expect(sheet).toContain('<autoFilter ref="A2:C3"/>');
    const workbook = files.get('xl/workbook.xml') ?? '';
    expect(workbook).toContain('<sheet name="Bob\'s" sheetId="1" r:id="rId1"/>');
    expect(workbook).toContain("'Bob''s'!$A$2:$C$3");
  });

  test('keeps dates before 1900 as text', async () => {
    const date = new Date(Date.UTC(1850, 0, 1));
    const { sheet } = await sheetXml({ columns: [column('d')], groups: [], rows: [[date]] });
    expect(sheet).toContain(`<t xml:space="preserve">${date.toISOString()}</t>`);
  });
});
