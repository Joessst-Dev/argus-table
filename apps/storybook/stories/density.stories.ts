import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import 'argus-table';
import { orderColumns, orders } from './data.js';

const data = orders(200);

const meta = {
  title: 'Features/Density',
  component: 'argus-table',
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * The `density` attribute sets the default row height and cell padding:
 * compact 32 px / 8 px, comfortable 40 px / 12 px, spacious 52 px / 16 px.
 * `--argus-row-height`, `--argus-cell-padding-inline` or `row-height` override them.
 */
export const AllThree: Story = {
  render: () =>
    html`${(['compact', 'comfortable', 'spacious'] as const).map(
      (density) =>
        html`<h3>${density}</h3>
          <argus-table
            style="block-size: 200px"
            density=${density}
            aria-label="Orders, ${density}"
            .columns=${orderColumns}
            .data=${data}
          ></argus-table>`,
    )}`,
  // The toolbar's density override would make all three the same.
  globals: { density: 'story' },
  play: async ({ canvasElement }) => {
    const tables = [...canvasElement.querySelectorAll('argus-table')];
    await Promise.all(tables.map((t) => t.updateComplete));
    const heights = tables.map(
      (t) => t.shadowRoot?.querySelector<HTMLElement>('[part~="row"]')?.offsetHeight,
    );
    await expect(heights).toEqual([32, 40, 52]);
  },
};
