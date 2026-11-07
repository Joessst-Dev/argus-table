import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { ArgusTable, DataSource, LoadErrorDetail } from 'argus-table';
import 'argus-table';
import { orderColumns, orders, type Order } from './data.js';

interface ServerOptions {
  /** Send the total with every page. Default: `true`. */
  total?: boolean;
  /** Pages (by `start / pageSize`) whose first request fails. */
  failOnce?: number[];
  /** Simulated latency range in ms. */
  latency?: [number, number];
}

/**
 * A pretend server over an array: sorts by `sorting`, answers after a random
 * delay, honours the abort signal, and fails some pages once.
 */
function fakeServer(rows: Order[], options: ServerOptions = {}): DataSource<Order> {
  const { total = true, failOnce = [], latency = [150, 500] } = options;
  const failing = new Set(failOnce);
  const pageSize = 100;
  return {
    pageSize,
    getRows: ({ start, end, sorting, signal }) =>
      new Promise((resolve, reject) => {
        const delay = latency[0] + Math.random() * (latency[1] - latency[0]);
        const timer = setTimeout(() => {
          const page = Math.floor(start / pageSize);
          if (failing.delete(page)) {
            reject(new Error(`Rows ${String(start)}–${String(end)} timed out`));
            return;
          }
          let sorted = rows;
          const [by] = sorting;
          if (by) {
            const key = by.id as keyof Order;
            const dir = by.desc ? -1 : 1;
            sorted = [...rows].sort((a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : 0));
          }
          resolve({ rows: sorted.slice(start, end), total: total ? rows.length : undefined });
        }, delay);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason as Error);
        });
      }),
  };
}

const meta = {
  title: 'Features/Infinite loading',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

async function tableIn(canvasElement: HTMLElement): Promise<ArgusTable<Order>> {
  const table = canvasElement.querySelector<ArgusTable<Order>>('argus-table');
  if (!table) throw new Error('no table');
  await table.updateComplete;
  return table;
}

/** Text of the first cell in the first rendered row (by `aria-rowindex`). */
function firstCellText(table: ArgusTable<Order>): string {
  const row = table.shadowRoot?.querySelector('[part~="row"][aria-rowindex="2"]');
  const slot = row?.querySelector('slot');
  return (slot?.assignedNodes() ?? []).map((n) => n.textContent).join('');
}

const data = orders(100_000);

/**
 * `dataSource` instead of `data`: the table asks `getRows({ start, end, sorting,
 * signal })` for the pages in view (`end` exclusive) and shows skeleton rows
 * until they arrive. Fast scrolling loads only where it stops, and pages that
 * scroll away are aborted through `signal`. Sorting happens on the server: a
 * new order reloads from the top. This server sends the total, 100,000 rows.
 */
export const KnownTotal: Story = {
  render: () =>
    html`<argus-table
      aria-label="Orders"
      style="block-size: 420px"
      .columns=${orderColumns}
      .dataSource=${fakeServer(data)}
    ></argus-table>`,
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    await waitFor(() => expect(firstCellText(table)).toBe('o1'), { timeout: 3000 });
  },
};

/**
 * Without a `total`, the table keeps one page of skeletons below the last row it
 * has, and a page with fewer rows than asked for marks the end. `aria-rowcount`
 * is -1 until then, which tells screen readers the size is unknown. This server
 * has 2,350 rows.
 */
export const UnknownTotal: Story = {
  render: () =>
    html`<argus-table
      aria-label="Orders"
      style="block-size: 420px"
      .columns=${orderColumns}
      .dataSource=${fakeServer(orders(2_350), { total: false })}
    ></argus-table>`,
};

/**
 * A page that fails shows its rows as error skeletons, fires `argus-load-error`
 * and puts a Retry button in its first visible row (Enter on any cell of the row
 * retries too). Here the first page fails once; the log below lists the errors.
 * `refresh()` drops every page and loads the rows in view again.
 */
export const FailedPage: Story = {
  render: () => {
    const log = (event: CustomEvent<LoadErrorDetail>) => {
      const out = document.querySelector('#load-log');
      const { error, start, end } = event.detail;
      if (out)
        out.textContent = `argus-load-error: rows ${String(start)}–${String(end)}, ${String(error)}`;
    };
    return html`<argus-table
        aria-label="Orders"
        style="block-size: 420px"
        .columns=${orderColumns}
        .dataSource=${fakeServer(data, { failOnce: [0], latency: [100, 200] })}
        @argus-load-error=${log}
      ></argus-table>
      <p id="load-log" role="status"></p>`;
  },
  play: async ({ canvasElement }) => {
    const table = await tableIn(canvasElement);
    const retry = await waitFor(
      () => {
        const button = table.shadowRoot?.querySelector<HTMLElement>('[part~="retry"]');
        if (!button) throw new Error('no Retry yet');
        return button;
      },
      { timeout: 3000 },
    );
    await expect(retry.getAttribute('aria-label')).toBe('Retry loading rows 1 to 100');
    await userEvent.click(retry);
    await waitFor(() => expect(firstCellText(table)).toBe('o1'), { timeout: 3000 });
  },
};
