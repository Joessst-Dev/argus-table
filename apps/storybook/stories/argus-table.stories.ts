import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import 'argus-table';

/**
 * Phase 0 skeleton. The element renders an empty `table` part; columns,
 * data and the rest of the API arrive in Phase 1.
 */
const meta = {
  title: 'Components/Table',
  component: 'argus-table',
  render: () => html`<argus-table></argus-table>`,
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Skeleton: Story = {
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('argus-table');
    await expect(table).not.toBeNull();
    await table?.updateComplete;
    await expect(table?.shadowRoot?.querySelector('[part~="table"]')).not.toBeNull();
  },
};
