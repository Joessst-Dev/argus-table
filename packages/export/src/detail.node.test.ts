import { describe, expect, test, vi } from 'vitest';
import { collectDetails } from './detail.js';
import type { ExportDetail } from './collect.js';

interface Row {
  id: string;
}
interface Line {
  product: string;
  qty: number;
}

const items = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    row: { id: `r${String(i)}` },
    rowId: `r${String(i)}`,
  }));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const columns = [
  { id: 'product', header: 'Product' },
  { id: 'qty', header: 'Qty' },
];

describe('collectDetails', () => {
  test('runs at most 6 rows() at a time and keeps row order', async () => {
    const pending: { row: Row; resolve: (lines: Line[]) => void }[] = [];
    const detail: ExportDetail<Row, Line> = {
      columns,
      rows: (row) =>
        new Promise<Line[]>((resolve) => {
          pending.push({ row, resolve });
        }),
    };
    const done = collectDetails(items(20), detail, undefined, undefined);
    await tick();
    expect(pending).toHaveLength(6);
    // Answer whatever is pending, newest first, until every row has been asked.
    while (pending.length > 0) {
      for (const call of pending.splice(0).reverse()) {
        call.resolve([{ product: call.row.id, qty: 1 }]);
      }
      await tick();
      expect(pending.length).toBeLessThanOrEqual(6);
    }
    const result = await done;
    expect(result.map((lines) => lines?.[0]?.[0])).toEqual(items(20).map((i) => i.rowId));
  });

  test('skips undefined items and rows expandable rejects', async () => {
    const rows = vi.fn<ExportDetail<Row, Line>['rows']>((row) => [{ product: row.id, qty: 1 }]);
    const list = [undefined, ...items(3)];
    const result = await collectDetails(
      list,
      { columns, rows },
      (row: Row) => row.id !== 'r1',
      undefined,
    );
    expect(result).toEqual([undefined, [['r0', 1]], undefined, [['r2', 1]]]);
    expect(rows.mock.calls.map(([row]) => row.id)).toEqual(['r0', 'r2']);
    expect(rows.mock.calls[0]?.[1]).toEqual({ rowId: 'r0', signal: undefined });
  });

  test('yields every 50 rows', async () => {
    let ran = false;
    setTimeout(() => {
      ran = true;
    }, 0);
    let seenBeforeLast = false;
    const detail: ExportDetail<Row, Line> = {
      columns,
      rows: (row) => {
        if (row.id === 'r119') seenBeforeLast = ran;
        return [];
      },
    };
    await collectDetails(items(120), detail, undefined, undefined);
    expect(seenBeforeLast).toBe(true);
  });

  test('rejects on a rejected rows() or an abort, starting no more calls', async () => {
    const failing: ExportDetail<Row, Line> = {
      columns,
      rows: (row) => (row.id === 'r1' ? Promise.reject(new Error('no lines')) : []),
    };
    await expect(collectDetails(items(10), failing, undefined, undefined)).rejects.toThrow(
      'no lines',
    );

    const controller = new AbortController();
    const rows = vi.fn<ExportDetail<Row, Line>['rows']>(() => {
      controller.abort(new Error('stop'));
      return new Promise<Line[]>((resolve) => {
        setTimeout(() => {
          resolve([]);
        }, 5);
      });
    });
    await expect(
      collectDetails(items(40), { columns, rows }, undefined, controller.signal),
    ).rejects.toThrow('stop');
    expect(rows.mock.calls.length).toBeLessThanOrEqual(6);
  });

  test('writes values through value() or the property named by id, made plain', async () => {
    const when = new Date(2026, 0, 2);
    const detail: ExportDetail<Row, { qty: number; when: Date; meta: object }> = {
      columns: [
        { id: 'qty', header: 'Qty', value: (l) => l.qty * 10 },
        { id: 'when', header: 'When' },
        { id: 'meta', header: 'Meta' },
        { id: 'missing', header: 'Missing' },
      ],
      rows: () => [{ qty: 2, when, meta: { a: 1 } }],
    };
    const [lines] = await collectDetails(items(1), detail, undefined, undefined);
    expect(lines).toEqual([[20, when, '{"a":1}', null]]);
  });
});
