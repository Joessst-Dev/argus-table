# Testing Lit elements in argus-table

- `packages/core`: plain Vitest (Node), no DOM.
- `packages/table`: Vitest **browser mode** with the Playwright provider, Chromium + Firefox + WebKit in CI. Each controller has a test file next to it.
- Storybook stories double as tests (Storybook Vitest addon + a11y addon).
- Visual regressions: Playwright screenshots per theme.

## Fixture helper

```ts
export async function fixture<T extends HTMLElement>(
  tag: keyof HTMLElementTagNameMap,
  props: Partial<T> = {},
  size = { width: 800, height: 400 },
): Promise<T> {
  const el = Object.assign(document.createElement(tag), props) as unknown as T & { updateComplete: Promise<boolean> };
  el.style.cssText = `display:block;width:${size.width}px;height:${size.height}px`;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

afterEach(() => document.body.replaceChildren());
```

Give the element a real size: virtualization renders nothing in a 0×0 box.

## Patterns

**Virtualization renders only the window**
```ts
const el = await fixture<ArgusTable>('argus-table', { columns, data: makeRows(100_000), rowHeight: 40 });
const rows = el.shadowRoot!.querySelectorAll('[part~="row"]:not([part~="row-pinned"])');
expect(rows.length).toBeLessThan(40); // ~400px / 40px + overscan
```

**Scrolling** (wait for the scroll event, then the update)
```ts
const body = el.shadowRoot!.querySelector<HTMLElement>('[part~="body"]')!;
body.scrollTop = 40 * 5000;
await new Promise((r) => body.addEventListener('scroll', r, { once: true }));
await new Promise(requestAnimationFrame);
await el.updateComplete;
expect(firstRenderedRow(el).getAttribute('aria-rowindex')).toBe(String(5000 + 2)); // +1 header, 1-based
```

**Keyboard and focus**: use `userEvent` from `@vitest/browser/context` (real key events), then check `el.shadowRoot!.activeElement`.

**Controlled vs uncontrolled**: test both. Uncontrolled: click header → event fires and the header shows `aria-sort`. Controlled (`el.sorting = []` first): click → event fires, but `aria-sort` doesn't change until the test sets `el.sorting`.

**Fake data source**
```ts
const calls: GetRowsRequest[] = [];
const dataSource = {
  async getRows(req: GetRowsRequest) {
    calls.push(req);
    return { rows: makeRows(req.end - req.start, req.start) }; // no total: unknown size
  },
};
```
Assert debouncing (fast scroll → few calls), abort (earlier signals aborted), skeleton parts while pending, and `argus-load-error` when `getRows` rejects.

**Events cross the shadow boundary**: listen on `document` and assert the event arrives (`composed: true`, `bubbles: true`).

## Things not to test

- Lit itself (that a property binding sets a property).
- Exact pixel output in unit tests: that's what the visual tests per theme are for.
- Private fields: test through properties, events, parts and roles.
