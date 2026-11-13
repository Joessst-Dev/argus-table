import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ArgusTable } from './argus-table.js';
import type { ColumnDef, TableLabels } from './index.js';
import { fixture, people, settle, shadow } from './test-utils.js';
import type { Person } from './test-utils.js';

afterEach(() => {
  document.body.replaceChildren();
});

const columns: ColumnDef<Person>[] = [
  { id: 'name', header: 'Name', accessor: 'name', width: 140, filter: 'text' },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, filter: 'number' },
  { id: 'city', header: 'City', accessor: 'address.city', width: 100 },
];

const german: Partial<TableLabels> = {
  noRows: 'Keine Zeilen',
  selectRow: 'Zeile auswählen',
  selectAllRows: 'Alle Zeilen auswählen',
  resizeColumn: 'Spaltenbreite ändern',
  resizeGroup: 'Gruppenbreite ändern',
  filtered: 'Gefiltert',
  retry: 'Erneut versuchen',
  retryRows: ({ first, last }) => `Zeilen ${String(first)} bis ${String(last)} erneut laden`,
  rowCount: ({ count }) => (count === 1 ? 'Eine Zeile' : `${String(count)} Zeilen`),
  columnMoved: ({ column, position, total }) =>
    `${column} ist jetzt Spalte ${String(position)} von ${String(total)}`,
  groupMoved: ({ group, first, last, total }) =>
    `${group} ist jetzt in den Spalten ${String(first)} bis ${String(last)} von ${String(total)}`,
};

const q = (el: ArgusTable<Person>, selector: string) => {
  const found = shadow(el).querySelector(selector);
  if (!found) throw new Error(`nothing matches ${selector}`);
  return found;
};

const region = () => document.querySelector('[data-argus-announcer]');

describe('labels', () => {
  test('replace the built-in labels, and keys left out stay English', async () => {
    const el = await fixture({
      columns: columns.map((c) => ({ ...c, resizable: true })),
      columnGroups: [{ id: 'who', header: 'Who', columns: ['name', 'age'] }],
      data: people(5),
      selectionMode: 'multi',
      selectionCheckboxes: true,
      columnFilters: { age: { kind: 'number', op: 'notEmpty' } },
      labels: { selectRow: 'Zeile auswählen', filtered: 'Gefiltert' },
    });
    expect(q(el, '[part~="row"] [part~="selection-checkbox"]').getAttribute('aria-label')).toBe(
      'Zeile auswählen',
    );
    expect(q(el, '[data-col="age"]').getAttribute('aria-description')).toBe('Gefiltert');
    expect(q(el, '[data-resize-col]').getAttribute('aria-label')).toBe('Resize column');
    expect(
      q(el, '[part~="header-cell"] [part~="selection-checkbox"]').getAttribute('aria-label'),
    ).toBe('Select all rows');

    el.labels = german;
    await settle(el);
    expect(q(el, '[data-resize-col]').getAttribute('aria-label')).toBe('Spaltenbreite ändern');
    expect(q(el, '[data-resize-group]').getAttribute('aria-label')).toBe('Gruppenbreite ändern');
    expect(
      q(el, '[part~="header-cell"] [part~="selection-checkbox"]').getAttribute('aria-label'),
    ).toBe('Alle Zeilen auswählen');

    // `undefined` brings English back, and so does a key set to `undefined`.
    el.labels = undefined;
    await settle(el);
    expect(el.labels).toEqual({});
    expect(q(el, '[data-col="age"]').getAttribute('aria-description')).toBe('Filtered');
    el.labels = { selectRow: undefined };
    await settle(el);
    expect(q(el, '[part~="row"] [part~="selection-checkbox"]').getAttribute('aria-label')).toBe(
      'Select row',
    );
  });

  test('the empty state', async () => {
    const el = await fixture({ columns, data: [], labels: german });
    expect(q(el, '[part="empty"] slot').textContent).toBe('Keine Zeilen');
  });

  test('the Retry button of a failed page', async () => {
    const el = await fixture({
      columns,
      labels: german,
      dataSource: { getRows: () => Promise.reject(new Error('offline')), pageSize: 20 },
    });
    await vi.waitFor(async () => {
      await settle(el);
      const retry = q(el, '[part~="retry"]');
      expect(retry.textContent.trim()).toBe('Erneut versuchen');
      expect(retry.getAttribute('aria-label')).toBe('Zeilen 1 bis 20 erneut laden');
    });
  });

  test('announcements', async () => {
    const el = await fixture({
      columns: columns.map((c) => ({ ...c, reorderable: true })),
      columnGroups: [{ id: 'where', header: 'Where', columns: ['city'] }],
      data: people(30),
      labels: german,
    });
    el.quickFilter = 'Person';
    await settle(el);
    await vi.waitFor(() => {
      expect(region()?.textContent).toBe('30 Zeilen');
    });
    el.quickFilter = 'Person 29';
    await settle(el);
    await vi.waitFor(() => {
      expect(region()?.textContent).toBe('Eine Zeile');
    });

    const keys = { altKey: true, shiftKey: true, bubbles: true, composed: true };
    const name = q(el, '[role="columnheader"][data-col="name"]') as HTMLElement;
    name.focus();
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ...keys }));
    await settle(el);
    await vi.waitFor(() => {
      expect(region()?.textContent).toBe('Name ist jetzt Spalte 2 von 3');
    });

    const group = q(el, '[data-group-key*="where"]') as HTMLElement;
    group.focus();
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', ...keys }));
    await settle(el);
    await vi.waitFor(() => {
      expect(region()?.textContent).toBe('Where ist jetzt in den Spalten 2 bis 2 von 3');
    });
  });
});
