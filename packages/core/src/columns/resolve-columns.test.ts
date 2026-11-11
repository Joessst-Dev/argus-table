import { describe, expect, it } from 'vitest';
import { DEFAULT_MIN_WIDTH, DEFAULT_WIDTH, readPath, resolveColumns } from './resolve-columns.js';

interface Order {
  id: number;
  customer: { name: string; address?: { city: string } | null };
  total: number;
}

const order: Order = { id: 7, customer: { name: 'Ada', address: { city: 'Bonn' } }, total: 12 };

describe('readPath', () => {
  it('reads nested properties', () => {
    expect(readPath(order, 'customer.name')).toBe('Ada');
    expect(readPath(order, 'customer.address.city')).toBe('Bonn');
    expect(readPath(order, 'id')).toBe(7);
  });

  it('stops at null or undefined like optional chaining', () => {
    const noAddress: Order = { ...order, customer: { name: 'Bo', address: null } };
    expect(readPath(noAddress, 'customer.address.city')).toBeUndefined();
    expect(readPath(order, 'missing.deeper')).toBeUndefined();
    expect(readPath(null, 'a')).toBeUndefined();
  });

  it('reads array indices', () => {
    expect(readPath({ tags: ['a', 'b'] }, 'tags.1')).toBe('b');
  });
});

describe('resolveColumns', () => {
  it('applies defaults', () => {
    const [col] = resolveColumns<Order, string>([{ id: 'id', accessor: 'id' }]);
    expect(col).toMatchObject({
      id: 'id',
      index: 0,
      width: DEFAULT_WIDTH,
      flex: undefined,
      minWidth: DEFAULT_MIN_WIDTH,
      maxWidth: Number.POSITIVE_INFINITY,
      pin: undefined,
      hidden: false,
      sortable: false,
      resizable: true,
      pinnable: true,
      hideable: true,
      align: 'start',
      wrap: false,
      hasAccessor: true,
    });
  });

  it('reads values through path and function accessors', () => {
    const [path, fn, none] = resolveColumns<Order, string>([
      { id: 'customer', accessor: 'customer.name' },
      { id: 'double', accessor: (row, index) => row.total * 2 + index },
      { id: 'actions' },
    ]);
    expect(path?.getValue(order, 0)).toBe('Ada');
    expect(fn?.getValue(order, 3)).toBe(27);
    expect(none?.getValue(order, 0)).toBeUndefined();
    expect(none?.hasAccessor).toBe(false);
  });

  it('clamps fixed widths into min/max', () => {
    const cols = resolveColumns<Order, string>([
      { id: 'a', width: 10, minWidth: 60 },
      { id: 'b', width: 900, maxWidth: 300 },
      { id: 'c', width: 120 },
    ]);
    expect(cols.map((c) => c.width)).toEqual([60, 300, 120]);
  });

  it('raises maxWidth to minWidth when they conflict', () => {
    const [col] = resolveColumns<Order, string>([{ id: 'a', minWidth: 200, maxWidth: 100 }]);
    expect(col?.maxWidth).toBe(200);
    expect(col?.width).toBe(200);
  });

  it('turns { flex } into a share with the min width as base', () => {
    const [flex, bad] = resolveColumns<Order, string>([
      { id: 'a', width: { flex: 2 }, minWidth: 80 },
      { id: 'b', width: { flex: 0 } },
    ]);
    expect(flex).toMatchObject({ flex: 2, width: 80 });
    // A non-positive flex falls back to the default fixed width.
    expect(bad).toMatchObject({ flex: undefined, width: DEFAULT_WIDTH });
  });

  it('keeps a width for flex columns while they are pinned, which need a known width', () => {
    const [col, narrow, fixed] = resolveColumns<Order, string>([
      { id: 'a', width: { flex: 1 }, pin: 'start' },
      { id: 'b', width: { flex: 1 }, maxWidth: 90 },
      { id: 'c', width: 70 },
    ]);
    // The model drops flex while a column is pinned and uses `pinnedWidth` instead.
    expect(col).toMatchObject({ flex: 1, pinnedWidth: DEFAULT_WIDTH, pin: 'start' });
    expect(narrow).toMatchObject({ flex: 1, pinnedWidth: 90 });
    expect(fixed).toMatchObject({ width: 70, pinnedWidth: 70 });
  });

  it('reads hidden, pinnable and hideable', () => {
    const [col] = resolveColumns<Order, string>([
      { id: 'a', hidden: true, pinnable: false, hideable: false },
    ]);
    expect(col).toMatchObject({ hidden: true, pinnable: false, hideable: false });
  });

  it("resolves width 'auto' to the clamped default until it is measured", () => {
    const [plain, narrow, pinned] = resolveColumns<Order, string>([
      { id: 'a', width: 'auto' },
      { id: 'b', width: 'auto', maxWidth: 100 },
      { id: 'c', width: 'auto', pin: 'end' },
    ]);
    expect(plain).toMatchObject({ auto: true, flex: undefined, width: DEFAULT_WIDTH });
    expect(narrow).toMatchObject({ auto: true, width: 100 });
    // Pinned columns may be auto: the measured width is a known px.
    expect(pinned).toMatchObject({ auto: true, pin: 'end' });
    expect(resolveColumns<Order, string>([{ id: 'd', width: 90 }])[0]?.auto).toBe(false);
  });

  it('wraps only when wrap is true', () => {
    const cols = resolveColumns<Order, string>([
      { id: 'a', wrap: true },
      { id: 'b', wrap: false },
      { id: 'c' },
    ]);
    expect(cols.map((c) => c.wrap)).toEqual([true, false, false]);
  });

  it('keeps only valid pins and alignment', () => {
    const cols = resolveColumns<Order, string>([
      { id: 'a', pin: 'start', align: 'end', sortable: true, resizable: false },
      // @ts-expect-error -- runtime guard for values from untyped callers
      { id: 'b', pin: 'left' },
    ]);
    expect(cols[0]).toMatchObject({ pin: 'start', align: 'end', sortable: true, resizable: false });
    expect(cols[1]?.pin).toBeUndefined();
  });

  it('rejects empty and duplicate ids', () => {
    expect(() => resolveColumns([{ id: '' }])).toThrow(/non-empty string id/);
    expect(() => resolveColumns([{ id: 'a' }, { id: 'a' }])).toThrow(/'a' is used more than once/);
  });
});
