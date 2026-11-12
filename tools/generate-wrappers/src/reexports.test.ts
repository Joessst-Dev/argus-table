import { describe, expect, test } from 'vitest';
import { compareReexports, exportedTypes } from './reexports.ts';

const table = `
export type CellContent = string;
export type { ArgusPlugin, PluginHost } from './plugins.js';
export type {
  SortState,
  TableState,
} from '@argus-table/core';
`;

describe('exportedTypes', () => {
  test('reads export type declarations and lists', () => {
    expect([...exportedTypes(table)].sort()).toEqual([
      'ArgusPlugin',
      'CellContent',
      'PluginHost',
      'SortState',
      'TableState',
    ]);
  });
});

describe('compareReexports', () => {
  test('passes when the wrapper re-exports every type, aliases aside', () => {
    const wrapper = `
export type { ArgusTable as ArgusTableElement } from 'argus-table';
export type {
  ArgusPlugin,
  CellContent,
  PluginHost,
  SortState,
  TableState,
} from 'argus-table';
export type { ReactColumnDef } from './content.js';`;
    expect(compareReexports(table, wrapper)).toEqual({ missing: [], extra: [] });
  });

  test('lists what is missing and what argus-table no longer has', () => {
    const wrapper = `export type { ArgusPlugin, CellContent, PluginHost, SortState, OldDetail } from 'argus-table';`;
    expect(compareReexports(table, wrapper)).toEqual({
      missing: ['TableState'],
      extra: ['OldDetail'],
    });
  });
});
