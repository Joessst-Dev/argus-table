import { afterEach, expect, test } from 'vitest';
import { ArgusTable } from './index.js';

afterEach(() => {
  document.body.replaceChildren();
});

async function mount(): Promise<ArgusTable> {
  const el = document.createElement('argus-table');
  document.body.append(el);
  await el.updateComplete;
  return el;
}

test('registers <argus-table> and upgrades it to ArgusTable', async () => {
  const el = await mount();
  expect(customElements.get('argus-table')).toBe(ArgusTable);
  expect(el).toBeInstanceOf(ArgusTable);
});

test('renders the table part inside an open shadow root', async () => {
  const el = await mount();
  expect(el.shadowRoot).not.toBeNull();
  expect(el.shadowRoot?.querySelector('[part~="table"]')).not.toBeNull();
});

// `computedRole` is not in every engine yet (Chromium ships it behind a flag),
// so this check runs only where the browser can report the computed role.
test.runIf('computedRole' in Element.prototype)(
  'exposes the grid role through ElementInternals, not a host attribute',
  async () => {
    const el = await mount();
    expect(el.hasAttribute('role')).toBe(false);
    expect((el as unknown as { computedRole: string | null }).computedRole).toBe('grid');
  },
);
