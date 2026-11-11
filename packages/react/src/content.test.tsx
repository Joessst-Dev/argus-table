import { afterEach, describe, expect, test } from 'vitest';
import { act, createContext, useContext, useLayoutEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  ArgusColumn,
  ArgusColumnGroup,
  ArgusTable,
  type ArgusTableElement,
  type ReactColumnDef,
} from './index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Order {
  id: string;
  customer: string;
  total: number;
}

const orders = (count: number): Order[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `o${String(i)}`,
    customer: `Customer ${String(i)}`,
    total: (i * 37) % 100,
  }));

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

async function settle(el: ArgusTableElement) {
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
}

/** Each rendered body row's cell content in a column, in row order. */
function cells(el: ArgusTableElement, columnId: string): (Element | undefined)[] {
  return [...(el.shadowRoot?.querySelectorAll<HTMLElement>('[part~="row"]') ?? [])]
    .sort((a, b) => Number(a.ariaRowIndex) - Number(b.ariaRowIndex))
    .map((row) => row.querySelector<HTMLSlotElement>(`[data-col="${columnId}"] slot`))
    .map((slot) => slot?.assignedElements()[0]);
}

const headerOf = (el: ArgusTableElement, id: string) =>
  el.shadowRoot
    ?.querySelector<HTMLSlotElement>(`[role="columnheader"][data-col="${id}"] slot`)
    ?.assignedElements()[0];

/** Counts mounts and unmounts of `<Badge>`s. */
const counts = { mounts: 0, unmounts: 0 };
const Currency = createContext('EUR');

function Badge({ order }: { order: Order }) {
  const currency = useContext(Currency);
  useLayoutEffect(() => {
    counts.mounts++;
    return () => {
      counts.unmounts++;
    };
  }, []);
  return (
    <b className="badge">
      {order.customer}: {order.total} {currency}
    </b>
  );
}

const columns: ReactColumnDef<Order>[] = [
  { id: 'id', header: 'Order', accessor: 'id', width: 90 },
  {
    id: 'customer',
    header: <i className="jsx-header">Customer</i>,
    width: 260,
    cell: (order) => <Badge order={order} />,
  },
  { id: 'total', header: 'Total', accessor: 'total', width: 90 },
];

describe('React content in cells and headers', () => {
  test('renders JSX from cell and header, with the app’s context', async () => {
    const el = await mount(
      <Currency.Provider value="CHF">
        <ArgusTable<Order> style={size} columns={columns} data={orders(3)} />
      </Currency.Provider>,
    );
    expect(cells(el, 'customer').map((c) => c?.textContent)).toEqual([
      'Customer 0: 0 CHF',
      'Customer 1: 37 CHF',
      'Customer 2: 74 CHF',
    ]);
    expect(cells(el, 'customer')[0]?.querySelector('.argus-content > b.badge')).not.toBeNull();
    expect(headerOf(el, 'customer')?.querySelector('i.jsx-header')?.textContent).toBe('Customer');
    // Plain columns still render through Lit.
    expect(cells(el, 'id')[0]?.textContent).toBe('o0');
  });

  test('renders JSX in column group headers, from columnGroups and <ArgusColumnGroup>', async () => {
    const groupOf = (el: ArgusTableElement) =>
      el.shadowRoot
        ?.querySelector<HTMLSlotElement>('[part~="header-group-cell"] slot')
        ?.assignedElements()[0];
    const el = await mount(
      <ArgusTable<Order>
        style={size}
        columns={columns}
        columnGroups={[
          { id: 'g', header: <u className="jsx-group">Who</u>, columns: ['customer'] },
        ]}
        data={orders(3)}
      />,
    );
    expect(groupOf(el)?.querySelector('u.jsx-group')?.textContent).toBe('Who');
    act(() => {
      root?.unmount();
    });
    container?.remove();
    const declarative = await mount(
      <ArgusTable<Order> style={size} data={orders(3)}>
        <ArgusColumnGroup groupId="g" header={<s className="jsx-group">Order</s>}>
          <ArgusColumn<Order> columnId="id" header="Id" accessor="id" />
          <ArgusColumn<Order> columnId="total" header="Total" accessor="total" />
        </ArgusColumnGroup>
      </ArgusTable>,
    );
    expect(groupOf(declarative)?.querySelector('s.jsx-group')?.textContent).toBe('Order');
  });

  test('pooled cells keep their components while scrolling: no remounts', async () => {
    counts.mounts = 0;
    counts.unmounts = 0;
    const el = await mount(
      <ArgusTable<Order> style={size} columns={columns} data={orders(10_000)} />,
    );
    const mounted = counts.mounts;
    expect(mounted).toBeGreaterThan(5);
    await act(async () => {
      await el.scrollToRow(5000);
    });
    await settle(el);
    expect(cells(el, 'customer').map((c) => c?.textContent)).toContain('Customer 5000: 0 EUR');
    expect(counts.mounts).toBe(mounted);
    expect(counts.unmounts).toBe(0);
  });

  test('unmounts content whose cells go away, and everything with the table', async () => {
    counts.mounts = 0;
    counts.unmounts = 0;
    const el = await mount(<ArgusTable<Order> style={size} columns={columns} data={orders(5)} />);
    expect(counts.mounts).toBe(5);
    await rerender(<ArgusTable<Order> style={size} columns={columns} data={orders(2)} />, el);
    expect(counts.unmounts).toBe(3);
    await rerender(
      <ArgusTable<Order>
        style={size}
        columns={columns.filter((c) => c.id !== 'customer')}
        data={orders(2)}
      />,
      el,
    );
    expect(counts.unmounts).toBe(5);
    expect(el.querySelector('.badge')).toBeNull();
    await rerender(<ArgusTable<Order> style={size} columns={columns} data={orders(2)} />, el);
    expect(counts.mounts).toBe(7);
    act(() => {
      root?.unmount();
    });
    root = undefined;
    expect(counts.unmounts).toBe(7);
  });

  test('auto width measures JSX content', async () => {
    const wide: ReactColumnDef<Order>[] = [
      {
        id: 'customer',
        header: 'C',
        width: 'auto',
        cell: (o) => <span>{`${o.customer} `.repeat(8)}</span>,
      },
    ];
    const el = await mount(<ArgusTable<Order> style={size} columns={wide} data={orders(3)} />);
    const header = el.shadowRoot?.querySelector('[role="columnheader"][data-col="customer"]');
    expect(header?.getBoundingClientRect().width).toBeGreaterThan(400);
  });

  test("rowHeight='auto' measures JSX content", async () => {
    const tall: ReactColumnDef<Order>[] = [
      { id: 'customer', header: 'C', accessor: 'customer', width: 200 },
      {
        id: 'pic',
        header: 'P',
        width: 100,
        cell: (o) => <div style={{ blockSize: o.total % 2 === 0 ? 90 : 10 }}>{o.id}</div>,
      },
    ];
    const el = await mount(
      <ArgusTable<Order> style={size} rowHeight="auto" columns={tall} data={orders(20)} />,
    );
    const rows = [...(el.shadowRoot?.querySelectorAll('[part~="body"] > [role="row"]') ?? [])].sort(
      (a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')),
    );
    // Order 0's total is 0 (a 90 px box), order 1's 37.
    expect(rows[0]?.getBoundingClientRect().height).toBeGreaterThanOrEqual(90);
    expect(Math.round(rows[1]?.getBoundingClientRect().height ?? 0)).toBe(40);
    expect(rows[1]?.getBoundingClientRect().top).toBeCloseTo(
      rows[0]?.getBoundingClientRect().bottom ?? 0,
      0,
    );
  });

  test('mixes JSX, nodes and text in one column', async () => {
    const mixed: ReactColumnDef<Order>[] = [
      {
        id: 'x',
        width: 200,
        cell: (o, ctx) => {
          if (ctx.index === 0) return <em>jsx</em>;
          if (ctx.index === 1) return document.createTextNode('node');
          if (ctx.index === 2) return 42;
          return `text ${o.id}`;
        },
      },
    ];
    const el = await mount(<ArgusTable<Order> style={size} columns={mixed} data={orders(4)} />);
    expect(cells(el, 'x').map((c) => c?.textContent.trim())).toEqual([
      'jsx',
      'node',
      '42',
      'text o3',
    ]);
  });
});
