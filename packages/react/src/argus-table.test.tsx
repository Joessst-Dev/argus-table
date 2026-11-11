import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, createRef, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  ArgusColumn,
  ArgusTable,
  type ArgusTableElement,
  type ColumnDef,
  type SelectionState,
  type SortChangeDetail,
  type SortState,
} from './index.js';

// React warns when a state update happens outside act() unless this is set.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Order {
  id: string;
  customer: string;
  total: number;
}

const orders: Order[] = Array.from({ length: 50 }, (_, i) => ({
  id: `o${String(i)}`,
  customer: `Customer ${String(i)}`,
  total: (i * 37) % 100,
}));

const columns: ColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  { id: 'customer', header: 'Customer', accessor: 'customer', width: 200 },
  { id: 'total', header: 'Total', accessor: 'total', width: 100, sortable: true },
];

/** A table the size `fixture()` uses: virtualization renders nothing in a 0×0 box. */
const size = { inlineSize: '600px', blockSize: '400px' };

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
});

async function mount(node: ReactElement): Promise<ArgusTableElement> {
  container = document.createElement('div');
  document.body.append(container);
  const r = createRoot(container);
  root = r;
  act(() => {
    r.render(node);
  });
  const el = container.querySelector('argus-table');
  if (!el) throw new Error('no <argus-table>');
  await settle(el);
  return el;
}

async function rerender(node: ReactElement, el: ArgusTableElement) {
  act(() => {
    root?.render(node);
  });
  await settle(el);
}

/** The update, two frames (resize observers, virtualizer), and the follow-up update. */
async function settle(el: ArgusTableElement) {
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
}

const shadow = (el: HTMLElement) => {
  if (!el.shadowRoot) throw new Error('no shadow root');
  return el.shadowRoot;
};

const headers = (el: ArgusTableElement) => [
  ...shadow(el).querySelectorAll<HTMLElement>('[part~="header-cell"]'),
];

const headerText = (el: ArgusTableElement) =>
  headers(el).map((h) => h.querySelector('slot')?.assignedElements()[0]?.textContent ?? '');

const firstCell = (el: ArgusTableElement) => {
  const cell = shadow(el).querySelector<HTMLElement>('[part~="row"] [part~="cell"]');
  if (!cell) throw new Error('no body cell');
  return cell;
};

describe('<ArgusTable>', () => {
  test('sets its props as element properties and passes HTML attributes through', async () => {
    const getRowId = (o: Order) => o.id;
    const el = await mount(
      <ArgusTable<Order>
        aria-label="Orders"
        className="orders"
        style={size}
        columns={columns}
        data={orders}
        density="compact"
        overscan={3}
        getRowId={getRowId}
        pinnedRows={{ bottom: [{ id: 'sum', customer: 'Total', total: 1 }] }}
      />,
    );

    expect(el.columns).toBe(columns);
    expect(el.data).toBe(orders);
    expect(el.density).toBe('compact');
    expect(el.getAttribute('density')).toBe('compact');
    expect(el.overscan).toBe(3);
    expect(el.getRowId).toBe(getRowId);
    expect(el.pinnedRows?.bottom).toHaveLength(1);
    expect(el.getAttribute('aria-label')).toBe('Orders');
    expect(el.className).toBe('orders');
    expect(el.style.inlineSize).toBe('600px');
    expect(headerText(el)).toEqual(['Order', 'Customer', 'Total']);
  });

  test('calls the on* props with the element events', async () => {
    const onCellClick = vi.fn();
    const onRowClick = vi.fn();
    const onSortChange = vi.fn();
    const el = await mount(
      <ArgusTable<Order>
        style={size}
        columns={columns}
        data={orders}
        onCellClick={onCellClick}
        onRowClick={onRowClick}
        onSortChange={onSortChange}
      />,
    );

    firstCell(el).click();
    expect(onCellClick).toHaveBeenCalledOnce();
    expect(onRowClick).toHaveBeenCalledOnce();
    const cellEvent = onCellClick.mock.calls[0]?.[0] as CustomEvent<{ row: Order }>;
    expect(cellEvent).toBeInstanceOf(CustomEvent);
    expect(cellEvent.detail.row).toBe(orders[0]);

    headers(el)[2]?.click();
    await settle(el);
    expect(onSortChange).toHaveBeenCalledOnce();
    expect(onSortChange.mock.calls[0]?.[0]).toMatchObject({
      detail: { sorting: [{ id: 'total', desc: false }] },
    });
  });

  test('replaces and removes handlers between renders', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const el = await mount(
      <ArgusTable<Order> style={size} columns={columns} data={orders} onRowClick={first} />,
    );
    await rerender(
      <ArgusTable<Order> style={size} columns={columns} data={orders} onRowClick={second} />,
      el,
    );
    firstCell(el).click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();

    await rerender(<ArgusTable<Order> style={size} columns={columns} data={orders} />, el);
    firstCell(el).click();
    expect(second).toHaveBeenCalledOnce();
  });

  test('ignores the events of a table nested in a cell', async () => {
    const nested = document.createElement('argus-table');
    nested.columns = [{ id: 'x', header: 'X', accessor: () => 'inner' }];
    nested.data = [{}];
    nested.style.cssText = 'inline-size: 200px; block-size: 100px';
    const outer: ColumnDef<Order>[] = [
      { id: 'inner', header: 'Inner', cell: () => nested, width: 220 },
    ];
    const onRowClick = vi.fn();
    const el = await mount(
      <ArgusTable<Order>
        style={size}
        columns={outer}
        data={orders.slice(0, 1)}
        onRowClick={onRowClick}
      />,
    );
    await settle(nested);
    expect(el.contains(nested)).toBe(true);

    firstCell(nested).click();
    // The click reaches the outer table, which fires its own row click once.
    expect(onRowClick).toHaveBeenCalledOnce();
    expect((onRowClick.mock.calls[0]?.[0] as Event).target).toBe(el);
  });

  test('leaves sorting uncontrolled when the prop is not set', async () => {
    const el = await mount(<ArgusTable<Order> style={size} columns={columns} data={orders} />);
    headers(el)[2]?.click();
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
  });

  test('controls sorting with the sorting and onSortChange props', async () => {
    const proposals: SortState[] = [];
    let accept = false;

    function Orders() {
      const [sorting, setSorting] = useState<SortState>([]);
      return (
        <ArgusTable<Order>
          style={size}
          columns={columns}
          data={orders}
          sorting={sorting}
          onSortChange={(e: CustomEvent<SortChangeDetail>) => {
            proposals.push(e.detail.sorting);
            if (accept) setSorting(e.detail.sorting);
          }}
        />
      );
    }

    const el = await mount(<Orders />);

    // Controlled: the click only proposes an order.
    act(() => headers(el)[2]?.click());
    await settle(el);
    expect(proposals).toEqual([[{ id: 'total', desc: false }]]);
    expect(el.sorting).toEqual([]);

    // Accepted: the table sorts once the prop changes.
    accept = true;
    act(() => headers(el)[2]?.click());
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
    expect(headers(el)[2]?.getAttribute('aria-sort')).toBe('ascending');
  });

  test('controls selection with the selection and onRowSelect props', async () => {
    const proposals: SelectionState[] = [];

    function Orders() {
      const [selection, setSelection] = useState<SelectionState>([]);
      return (
        <ArgusTable<Order>
          style={size}
          columns={columns}
          data={orders}
          getRowId={(o) => o.id}
          selectionMode="multi"
          selection={selection}
          onRowSelect={(e) => {
            proposals.push(e.detail.selection);
            setSelection(e.detail.selection);
          }}
        />
      );
    }

    const el = await mount(<Orders />);
    const cell = el.shadowRoot?.querySelector<HTMLElement>(
      '[role="row"][aria-rowindex="4"] > [data-col="customer"]',
    );
    act(() => cell?.click());
    await settle(el);
    expect(proposals).toEqual([['o2']]);
    expect(el.selection).toEqual(['o2']);
    expect(cell?.parentElement?.getAttribute('aria-selected')).toBe('true');
  });

  test('hands state back and keeps working when props go away', async () => {
    const el = await mount(
      <ArgusTable<Order> style={size} columns={columns} data={orders} sorting={[]} overscan={2} />,
    );
    await rerender(<ArgusTable<Order> style={size} />, el);
    expect(el.columns).toEqual([]);
    expect(el.data).toEqual([]);
    expect(el.overscan).toBe(6);

    // Uncontrolled again: a click sorts by itself.
    await rerender(<ArgusTable<Order> style={size} columns={columns} data={orders} />, el);
    headers(el)[2]?.click();
    await settle(el);
    expect(el.sorting).toEqual([{ id: 'total', desc: false }]);
  });

  test('gives a ref to the element, for its methods', async () => {
    const ref = createRef<ArgusTableElement<Order>>();
    const el = await mount(
      <ArgusTable<Order> ref={ref} style={size} columns={columns} data={orders} />,
    );
    expect(ref.current).toBe(el);
    await expect(ref.current?.refresh()).resolves.toBeUndefined();
    await ref.current?.setState({ sorting: [{ id: 'total', desc: true }] });
    expect(ref.current?.getState().sorting).toEqual([{ id: 'total', desc: true }]);
  });
});

describe('<ArgusColumn>', () => {
  function Declarative({ ids }: { ids: readonly string[] }) {
    return (
      <ArgusTable<Order> style={size} data={orders}>
        {ids.map((id) => (
          <ArgusColumn<Order>
            key={id}
            columnId={id}
            header={id.toUpperCase()}
            accessor={id}
            sortable={id === 'total'}
            width={id === 'customer' ? 'auto' : 100}
          />
        ))}
      </ArgusTable>
    );
  }

  test('builds the columns from children', async () => {
    const el = await mount(<Declarative ids={['id', 'customer', 'total']} />);
    expect(headerText(el)).toEqual(['ID', 'CUSTOMER', 'TOTAL']);
    expect(firstCell(el).querySelector('slot')?.assignedElements()[0]?.textContent).toBe('o0');
  });

  test('follows children React adds, removes and moves while rows are rendered', async () => {
    const el = await mount(<Declarative ids={['id', 'customer']} />);

    await rerender(<Declarative ids={['id', 'customer', 'total']} />, el);
    expect(headerText(el)).toEqual(['ID', 'CUSTOMER', 'TOTAL']);

    await rerender(<Declarative ids={['total', 'id', 'customer']} />, el);
    expect(headerText(el)).toEqual(['TOTAL', 'ID', 'CUSTOMER']);

    await rerender(<Declarative ids={['total', 'customer']} />, el);
    expect(headerText(el)).toEqual(['TOTAL', 'CUSTOMER']);

    // React's children and the table's own light-DOM content stay apart.
    const columnEls = el.querySelectorAll(':scope > argus-column');
    expect([...columnEls].map((c) => (c as HTMLElement & { columnId: string }).columnId)).toEqual([
      'total',
      'customer',
    ]);
    expect(el.querySelectorAll(':scope > [slot]').length).toBeGreaterThan(0);

    // Unmounting removes React's nodes without touching the table's.
    act(() => {
      root?.unmount();
    });
    root = undefined;
    expect(container?.childElementCount).toBe(0);
  });
});
