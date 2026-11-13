import { describe, expect, test } from 'vitest';
import { toCsv } from './csv.js';
import type { ExportSheet } from './sheet.js';

const column = (id: string, header = id) => ({
  id,
  header,
  align: 'start' as const,
  width: 100,
  pin: undefined,
});

describe('toCsv', () => {
  test('writes headers and typed values, quoting what needs it', () => {
    const sheet: ExportSheet = {
      columns: [column('a', 'Name'), column('b', 'Note'), column('c', 'n')],
      groups: [],
      rows: [
        ['Ann', 'says "hi", twice', 3.5],
        ['Bob', 'two\nlines', null],
        [true, new Date(2026, 10, 13), new Date(2026, 10, 13, 9, 5, 7)],
      ],
    };
    expect(toCsv(sheet, { bom: false })).toBe(
      'Name,Note,n\r\nAnn,"says ""hi"", twice",3.5\r\nBob,"two\nlines",\r\ntrue,2026-11-13,2026-11-13 09:05:07\r\n',
    );
  });

  test('starts with a byte order mark by default and takes another delimiter', () => {
    const sheet: ExportSheet = {
      columns: [column('a'), column('b')],
      groups: [],
      rows: [['x;y', 1]],
    };
    expect(toCsv(sheet)).toBe('﻿a,b\r\nx;y,1\r\n');
    expect(toCsv(sheet, { delimiter: ';', bom: false })).toBe('a;b\r\n"x;y";1\r\n');
  });

  test('escapes text a spreadsheet would run as a formula, never numbers', () => {
    const sheet: ExportSheet = {
      columns: [column('a'), column('b'), column('c'), column('d')],
      groups: [],
      rows: [['=1+1', '@SUM(A1)', '-x', -5]],
    };
    expect(toCsv(sheet, { bom: false }).split('\r\n')[1]).toBe("'=1+1,'@SUM(A1),'-x,-5");
    expect(toCsv(sheet, { bom: false, escapeFormulas: false }).split('\r\n')[1]).toBe(
      '=1+1,@SUM(A1),-x,-5',
    );
  });

  test('writes group header rows above the column headers', () => {
    const sheet: ExportSheet = {
      columns: [column('a'), column('b'), column('c')],
      groups: [
        [
          { text: 'Who', span: 2 },
          { text: '', span: 1 },
        ],
      ],
      rows: [],
    };
    expect(toCsv(sheet, { bom: false })).toBe('Who,,\r\na,b,c\r\n');
  });
});
