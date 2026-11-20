import { describe, expect, it, vi } from 'vitest';
import { buildGroups } from './group-rows.js';

interface Sale {
  region?: string | null;
  status: string;
  amount: number;
  day?: Date;
}

const sales: Sale[] = [
  { region: 'EU', status: 'Open', amount: 10 },
  { region: 'APAC', status: 'Done', amount: 5 },
  { region: 'EU', status: 'Done', amount: 7 },
  { region: undefined, status: 'Open', amount: 1 },
  { region: 'APAC', status: 'Open', amount: 3 },
  { region: '', status: 'Done', amount: 2 },
];

const column = (id: keyof Sale, aggregate?: 'sum') => ({
  id,
  getValue: (row: Sale) => row[id],
  aggregate,
});

const all = sales.map((_, i) => i);
/** Groups with data ids that are the indexes. */
const build = (
  data: readonly Sale[],
  filtered: readonly number[],
  grouping: Parameters<typeof buildGroups<Sale>>[2],
  totalled: Parameters<typeof buildGroups<Sale>>[3],
) => {
  const ids = data.map((_, i) => String(i));
  return buildGroups(data, filtered, grouping, totalled, ids, (id) => {
    const i = ids.indexOf(id);
    return i === -1 ? undefined : i;
  });
};

describe('buildGroups', () => {
  it('one level: groups by value, ascending, the empty group last', () => {
    const g = build(sales, all, [column('region')], []);
    expect(g.size).toBe(6);
    expect(g.groups).toBe(3);
    const infos = [6, 7, 8].map((row) => g.info(row));
    expect(infos.map((i) => i?.value)).toEqual(['APAC', 'EU', undefined]);
    expect(infos.map((i) => i?.count)).toEqual([2, 2, 2]);
    expect(infos[0]).toEqual({
      id: '\u0000g["region","APAC"]',
      groupColumnId: 'region',
      value: 'APAC',
      count: 2,
      depth: 0,
      totals: {},
    });
    expect(g.info(8)?.id).toBe('\u0000g["region",null]');
    // Data rows sit under their group, one level down.
    expect([...g.parent.slice(0, 6)]).toEqual([7, 6, 7, 8, 6, 8]);
    expect([...g.depth.slice(0, 9)]).toEqual([1, 1, 1, 1, 1, 1, 0, 0, 0]);
    expect(g.info(0)).toBeUndefined();
    expect(g.filtered).toEqual([0, 1, 2, 3, 4, 5]);
    expect(g.groupRows).toEqual([6, 7, 8]);
  });

  it('two levels: nested groups, ids along the path, counts of every row under', () => {
    const g = build(sales, all, [column('region'), column('status')], []);
    // APAC, EU, empty, then APAC's Done and Open, EU's Done and Open, empty's Done and Open.
    expect(g.groups).toBe(9);
    const eu = g.indexOf('\u0000g["region","EU"]') ?? -1;
    const euOpen = g.indexOf('\u0000g["region","EU","status","Open"]') ?? -1;
    expect(g.info(eu)?.count).toBe(2);
    expect(g.parent[euOpen]).toBe(eu);
    expect(g.info(euOpen)).toMatchObject({ depth: 1, count: 1, groupColumnId: 'status' });
    expect(g.parent[0]).toBe(euOpen);
    expect(g.depth[0]).toBe(2);
    // A parent's index is below its children's.
    expect(eu).toBeLessThan(euOpen);
  });

  it('only filtered rows: groups with none left don’t exist, counts and totals cover the rest', () => {
    const g = build(sales, [0, 1, 2], [column('region')], [column('amount', 'sum')]);
    expect(g.groups).toBe(2);
    expect(g.info(6)).toMatchObject({ value: 'APAC', count: 1, totals: { amount: 5 } });
    expect(g.info(7)).toMatchObject({ value: 'EU', count: 2, totals: { amount: 17 } });
    // Rows the filters drop have no parent and aren't kept.
    expect(g.parent[3]).toBe(-1);
    expect(g.filtered).toEqual([0, 1, 2]);
    expect(g.groupRows).toEqual([6, 7]);
  });

  it('dates group by time; undefined, null and empty text share the empty group', () => {
    const rows: Sale[] = [
      { status: 'a', amount: 0, day: new Date(2026, 0, 1) },
      { status: 'b', amount: 0, day: new Date(2026, 0, 1) },
      { status: 'c', amount: 0, region: null },
    ];
    const byDay = build(rows, [0, 1], [column('day')], []);
    expect(byDay.groups).toBe(1);
    expect(byDay.info(3)?.id).toBe(`\u0000g["day",${String(new Date(2026, 0, 1).getTime())}]`);
    expect(byDay.info(3)?.value).toBeInstanceOf(Date);
    const byRegion = build(sales, [3, 5], [column('region')], []);
    expect(byRegion.groups).toBe(1);
    expect(byRegion.info(6)).toMatchObject({ value: undefined, count: 2 });
  });

  it('each group has one hidden child that keeps its id out of branch selection', () => {
    const g = build(sales, all, [column('region')], []);
    const apac = 6;
    const hidden = 6 + 3;
    expect(g.parent[hidden]).toBe(apac);
    expect(g.ids[hidden]).toBe('\u0000\u0000g["region","APAC"]');
    // Two rows and the hidden child.
    expect(g.childCount[apac]).toBe(3);
    expect(g.rows.length).toBe(6 + 2 * 3);
    expect(g.rows[apac]).toBeUndefined();
  });

  it('sort keys: the value in its own column, the total in a totalled one', () => {
    const g = build(sales, all, [column('region')], [column('amount', 'sum')]);
    expect(g.key(6, 'region')).toBe('APAC');
    expect(g.key(6, 'amount')).toBe(8);
    expect(g.key(6, 'status')).toBeUndefined();
    expect(g.key(0, 'region')).toBeUndefined();
  });

  it('reads each grouping and each totalled value once per row', () => {
    const region = vi.fn((row: Sale) => row.region);
    const amount = vi.fn((row: Sale) => row.amount);
    build(
      sales,
      all,
      [{ id: 'region', getValue: region, aggregate: undefined }],
      [{ id: 'amount', getValue: amount, aggregate: 'sum' }],
    );
    expect(region).toHaveBeenCalledTimes(6);
    expect(amount).toHaveBeenCalledTimes(6);
  });

  it('ids hold values JSON can’t: Infinity apart from the empty group', () => {
    const rows: Sale[] = [
      { status: 'a', amount: Infinity },
      { status: 'b', amount: Number.NaN },
    ];
    const g = build(rows, [0, 1], [column('amount')], []);
    expect([g.info(2)?.id, g.info(3)?.id]).toEqual([
      '\u0000g["amount","Infinity"]',
      '\u0000g["amount",null]',
    ]);
  });
});
