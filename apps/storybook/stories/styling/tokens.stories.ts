import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { expect } from 'storybook/test';
import 'argus-table';
import { orderColumns, orders } from '../data.js';

const data = orders(500);

/** Each arg sets the `--argus-*` token of the same name on the table. Empty: theme or default. */
interface Args {
  bg: string;
  fg: string;
  'header-bg': string;
  'header-fg': string;
  'border-color': string;
  'border-width': string;
  border: string;
  'border-radius': string;
  'row-odd-bg': string;
  'row-hover-bg': string;
  'row-height': string;
  'cell-padding-inline': string;
  'focus-ring': string;
  'pinned-shadow': string;
  'resize-handle-color': string;
}

const empty: Args = {
  bg: '',
  fg: '',
  'header-bg': '',
  'header-fg': '',
  'border-color': '',
  'border-width': '',
  border: '',
  'border-radius': '',
  'row-odd-bg': '',
  'row-hover-bg': '',
  'row-height': '',
  'cell-padding-inline': '',
  'focus-ring': '',
  'pinned-shadow': '',
  'resize-handle-color': '',
};

const meta = {
  title: 'Styling/Tokens',
  component: 'argus-table',
  args: empty,
  argTypes: Object.fromEntries(
    Object.keys(empty).map((name) => [
      name,
      { control: 'text', description: `\`--argus-${name}\``, table: { category: 'tokens' } },
    ]),
  ),
  render: (args) => {
    const style = Object.fromEntries(
      Object.entries(args)
        .filter(([, value]) => value !== '')
        .map(([name, value]) => [`--argus-${name}`, value]),
    );
    return html`<argus-table
      style=${styleMap({ blockSize: '360px', ...style })}
      aria-label="Orders"
      .columns=${orderColumns}
      .data=${data}
    ></argus-table>`;
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/**
 * Tokens are CSS custom properties, so they pass into the shadow DOM. Set them
 * on the table, on a parent or in a theme. Try the controls.
 * To build a whole theme (light and dark, contrast checks, CSS to copy), use
 * Themes / Theme creator.
 */
export const Playground: Story = {};

/** Striped rows, a hover colour and taller rows, from tokens alone. */
export const Striped: Story = {
  args: {
    'row-odd-bg': 'light-dark(#f4f6fb, #1a1f2a)',
    'row-hover-bg': 'light-dark(#e6ecfa, #232b3b)',
    'row-height': '44px',
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    const row = table?.shadowRoot?.querySelector<HTMLElement>('[part~="row"]');
    await expect(row?.offsetHeight).toBe(44);
  },
};

/** A border around the table and rounded corners: `--argus-border` and `--argus-border-radius`. */
export const Rounded: Story = {
  args: {
    border: '1px solid light-dark(#d0d5dd, #3a414c)',
    'border-radius': '12px',
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await table?.updateComplete;
    if (!table) return;
    await expect(getComputedStyle(table).borderTopRightRadius).toBe('12px');
    await expect(getComputedStyle(table).borderTopWidth).toBe('1px');
  },
};
