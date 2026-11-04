import type { ArgusTable } from './argus-table.js';
import './argus-table.js';

export interface Person {
  id: string;
  name: string;
  age: number;
  address: { city: string };
}

export function people(count: number): Person[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${String(i)}`,
    name: `Person ${String(i)}`,
    age: i % 90,
    address: { city: `City ${String(i % 7)}` },
  }));
}

/** Mounts a sized table: virtualization renders nothing in a 0×0 box. */
export async function fixture<T = Person>(
  props: Partial<ArgusTable<T>> = {},
  size = { width: 800, height: 400 },
): Promise<ArgusTable<T>> {
  const el = document.createElement('argus-table') as unknown as ArgusTable<T>;
  Object.assign(el, props);
  el.style.inlineSize = `${String(size.width)}px`;
  el.style.blockSize = `${String(size.height)}px`;
  document.body.append(el);
  await settle(el);
  return el;
}

/** Waits for the update, a frame (resize observers, virtualizer) and the follow-up update. */
export async function settle(el: HTMLElement & { updateComplete: Promise<boolean> }) {
  await el.updateComplete;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  await el.updateComplete;
}

export const shadow = (el: HTMLElement) => {
  if (!el.shadowRoot) throw new Error('no shadow root');
  return el.shadowRoot;
};

export const bodyRows = (el: HTMLElement) => [
  ...shadow(el).querySelectorAll<HTMLElement>('[part~="row"]'),
];

/** The light-DOM element slotted into a shadow cell. */
export function slotted(cell: Element): Element | undefined {
  return cell.querySelector('slot')?.assignedElements()[0];
}

/** Visible text of each cell in a row, in column order. */
export const rowText = (row: Element) =>
  [...row.querySelectorAll('[part~="cell"]')].map((c) => slotted(c)?.textContent ?? '');

/** Rows sorted by aria-rowindex (DOM order is pool order). */
export const rowsInOrder = (el: HTMLElement) =>
  bodyRows(el).sort(
    (a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')),
  );

export async function scrollTo(
  el: HTMLElement & { updateComplete: Promise<boolean> },
  top: number,
) {
  const scroller = shadow(el).querySelector<HTMLElement>('[part~="table"]');
  if (!scroller) throw new Error('no scroller');
  const scrolled = new Promise((resolve) => {
    scroller.addEventListener('scroll', resolve, { once: true });
  });
  scroller.scrollTop = top;
  await scrolled;
  await settle(el);
}
