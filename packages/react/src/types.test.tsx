// Type-level checks, run by `typecheck` (and as an empty test by vitest).
import { test } from 'vitest';
import { createRef } from 'react';
import {
  ArgusColumn,
  ArgusTable,
  type ArgusPlugin,
  type ArgusTableElement,
  type ColumnDef,
  type RowClickDetail,
} from './index.js';

interface Order {
  id: string;
  total: number;
}

const orders: Order[] = [];
const columns: ColumnDef<Order>[] = [{ id: 'total', accessor: (o) => o.total }];

export const inferred = (
  <ArgusTable
    columns={columns}
    data={orders}
    onRowClick={(e) => {
      // The row type is inferred from `data` and `columns`.
      const row: Order = e.detail.row;
      const detail: RowClickDetail<Order> = e.detail;
      return [row, detail];
    }}
    onCellClick={(e) => e.detail.row.total.toFixed()}
    onSortChange={(e) => e.detail.sorting.map((s) => s.id)}
    onColumnResize={(e) => e.detail.sizing}
    onColumnReorder={(e) => e.detail.order}
    selectionMode="multi"
    selectionCheckboxes
    onRowSelect={(e) => e.detail.selection.join()}
    onRangeChange={(e) => e.detail.start + e.detail.end}
    onLoadError={(e) => e.detail.error}
  />
);

export const ref = createRef<ArgusTableElement<Order>>();
export const withRef = <ArgusTable<Order> ref={ref} data={orders} />;

export const wrongRows = (
  // @ts-expect-error: `data` must hold the row type given explicitly.
  <ArgusTable<Order> data={[{ id: 1 }]} />
);

// A plugin for the row type, kept outside the component so its identity is stable.
const logKeys: ArgusPlugin<Order> = {
  name: 'log-keys',
  keydown: (event, target, host) => {
    host.element.data.map((o) => o.total);
    return event.key === target.columnId;
  },
};
export const withPlugins = <ArgusTable data={orders} plugins={[logKeys]} />;

export const wrongPlugin = (
  // @ts-expect-error: a plugin needs a name.
  <ArgusTable data={orders} plugins={[{ keydown: () => true }]} />
);

// @ts-expect-error: not an event of the table.
export const unknownEvent = <ArgusTable onRowDoubleClick={() => undefined} />;

// @ts-expect-error: density is a keyword.
export const badDensity = <ArgusTable density="cozy" />;

export const column = (
  <ArgusColumn<Order>
    columnId="total"
    header="Total"
    accessor={(o) => o.total}
    width="auto"
    pin="end"
    align="end"
    sortable
  />
);

// @ts-expect-error: `pin` is 'start' or 'end'.
export const badPin = <ArgusColumn columnId="x" pin="left" />;

test('types compile', () => {
  // Checked by `tsc`; nothing to run.
});
