import { afterEach, describe, expect, test } from 'vitest';
import {
  act,
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactElement,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { cellEditing } from '@argus-table/editing';
import {
  ArgusColumn,
  ArgusColumnGroup,
  ArgusTable,
  type ArgusPlugin,
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

/** The editing plugin, created once. */
const editingPlugins = [cellEditing<Order>()];

/** Focuses a column's cell in the first body row and opens its editor with F2. */
async function startEditing(el: ArgusTableElement, columnId: string) {
  const cell = el.shadowRoot?.querySelector<HTMLElement>(
    `[part~="body"] > [aria-rowindex="2"] > [data-col="${columnId}"]`,
  );
  if (!cell) throw new Error(`no cell in ${columnId}`);
  cell.focus();
  act(() => {
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, composed: true }));
  });
  await settle(el);
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

describe('React content in pinned rows and custom editors', () => {
  const pinnedCell = (el: ArgusTableElement, columnId: string) =>
    el.shadowRoot
      ?.querySelector<HTMLSlotElement>(`[part~="row-pinned-bottom"] [data-col="${columnId}"] slot`)
      ?.assignedElements()[0];

  test('a cell function sees `pinned` for a pinned row', async () => {
    const pinnedColumns: ReactColumnDef<Order>[] = [
      {
        id: 'customer',
        width: 200,
        cell: (order, { pinned }) => <b data-pinned={pinned ?? 'body'}>{order.customer}</b>,
      },
    ];
    const el = await mount(
      <ArgusTable<Order>
        style={size}
        columns={pinnedColumns}
        data={orders(3)}
        pinnedRows={{ bottom: [{ id: 'sum', customer: 'Total', total: 0 }] }}
      />,
    );
    expect(pinnedCell(el, 'customer')?.querySelector('b')?.dataset.pinned).toBe('bottom');
    expect(cells(el, 'customer')[0]?.querySelector('b')?.dataset.pinned).toBe('body');
  });

  test('a function header names its column in text mode', async () => {
    const names: (string | undefined)[] = [];
    const named: ReactColumnDef<Order>[] = [
      {
        id: 'customer',
        width: 200,
        accessor: 'customer',
        header: ({ text }) => (text ? 'Customer' : <i>Customer</i>),
      },
    ];
    const plugins: ArgusPlugin<Order>[] = [
      {
        name: 'names',
        columns: (defs, host) => {
          names.splice(0, Infinity, ...defs.map((d) => host.headerText(d)));
          return undefined;
        },
      },
    ];
    const el = await mount(
      <ArgusTable<Order> style={size} columns={named} data={orders(2)} plugins={plugins} />,
    );
    expect(names).toEqual(['Customer']);
    expect(headerOf(el, 'customer')?.querySelector('i')?.textContent).toBe('Customer');
  });

  test('a custom editor renders JSX in the cell, takes focus and commits', async () => {
    const edited: unknown[] = [];
    const editable: ReactColumnDef<Order>[] = [
      { id: 'id', header: 'Order', accessor: 'id', width: 90 },
      {
        id: 'total',
        header: 'Total',
        accessor: 'total',
        width: 160,
        meta: {
          edit: {
            editor: ({ label, commit }) => (
              <button
                type="button"
                className="three"
                aria-label={label}
                onClick={() => {
                  commit(3);
                }}
              >
                3
              </button>
            ),
          },
        },
      },
    ];
    const el = await mount(
      <ArgusTable<Order>
        style={size}
        columns={editable}
        data={orders(3)}
        plugins={editingPlugins}
        onCellEdit={(e) => {
          edited.push(e.detail.value);
        }}
      />,
    );
    await startEditing(el, 'total');
    const button = el.querySelector<HTMLButtonElement>('button.three');
    expect(button?.getAttribute('aria-label')).toBe('Total, row 1');
    expect(document.activeElement).toBe(button);
    act(() => {
      button?.click();
    });
    await settle(el);
    expect(edited).toEqual([3]);
    expect(el.querySelector('button.three')).toBeNull();
  });
});

/** A scroller of a table, to scroll it by hand. */
async function scrollBody(el: ArgusTableElement, top: number) {
  const scroller = el.shadowRoot?.querySelector<HTMLElement>('[part~="table"]');
  if (!scroller) throw new Error('no scroller');
  const scrolled = new Promise((resolve) => {
    scroller.addEventListener('scroll', resolve, { once: true });
  });
  scroller.scrollTop = top;
  await scrolled;
  await settle(el);
}

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      className="counter"
      onClick={() => {
        setCount(count + 1);
      }}
    >
      {count}
    </button>
  );
}

describe('React content in detail panels', () => {
  const columns: ReactColumnDef<Order>[] = [
    { id: 'customer', header: 'Customer', accessor: 'customer' },
  ];
  const rowIdOf = (order: Order) => order.id;
  const detail = () => <Counter />;

  test('renders rowDetail content and keeps its state across scrolling', async () => {
    const el = await mount(
      <ArgusTable<Order>
        style={size}
        columns={columns}
        data={orders(300)}
        getRowId={rowIdOf}
        rowDetail={detail}
        expanded={['o2']}
      />,
    );
    const counter = () => el.querySelector<HTMLButtonElement>('button.counter');
    act(() => {
      counter()?.click();
    });
    act(() => {
      counter()?.click();
    });
    expect(counter()?.textContent).toBe('2');
    await scrollBody(el, 4000);
    await scrollBody(el, 0);
    expect(counter()?.textContent).toBe('2');
  });

  test('binds expanded two-way', async () => {
    const seen: (readonly string[])[] = [];
    function Table() {
      const [expanded, setExpanded] = useState<readonly string[]>([]);
      return (
        <ArgusTable<Order>
          style={size}
          columns={columns}
          data={orders(20)}
          getRowId={rowIdOf}
          rowDetail={detail}
          expanded={expanded}
          onExpandedChange={(event) => {
            seen.push(event.detail.expanded);
            setExpanded(event.detail.expanded);
          }}
        />
      );
    }
    const el = await mount(<Table />);
    act(() => {
      el.shadowRoot?.querySelector<HTMLButtonElement>('[part~="expand-toggle"]')?.click();
    });
    await settle(el);
    expect(seen).toEqual([['o0']]);
    expect(el.expanded).toEqual(['o0']);
    expect(el.querySelector('button.counter')).not.toBeNull();
  });
});

describe('React tree rows', () => {
  interface Node {
    id: string;
    name: string;
    kids?: Node[];
  }
  const nodes: Node[] = [
    { id: 'a', name: 'A', kids: [{ id: 'a1', name: 'A1' }] },
    { id: 'b', name: 'B' },
  ];
  const nodeColumns: ReactColumnDef<Node>[] = [{ id: 'name', header: 'Name', accessor: 'name' }];
  const nodeId = (node: Node) => node.id;
  const kidsOf = (node: Node) => node.kids;

  test('binds treeExpanded two-way', async () => {
    const seen: (readonly string[])[] = [];
    function Table() {
      const [treeExpanded, setTreeExpanded] = useState<readonly string[]>([]);
      return (
        <ArgusTable<Node>
          style={size}
          columns={nodeColumns}
          data={nodes}
          getRowId={nodeId}
          getSubRows={kidsOf}
          treeExpanded={treeExpanded}
          onTreeExpandedChange={(event) => {
            seen.push(event.detail.treeExpanded);
            setTreeExpanded(event.detail.treeExpanded);
          }}
        />
      );
    }
    const el = await mount(<Table />);
    expect(el.textContent).not.toContain('A1');
    act(() => {
      el.shadowRoot?.querySelector<HTMLButtonElement>('[part~="tree-toggle"]')?.click();
    });
    await settle(el);
    expect(seen).toEqual([['a']]);
    expect(el.treeExpanded).toEqual(['a']);
    expect(el.textContent).toContain('A1');
  });
});
