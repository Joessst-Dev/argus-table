import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import '../theme-creator/theme-creator.js';
import type { ArgusThemeCreator } from '../theme-creator/theme-creator.js';
import { newDraft } from '../theme-creator/presets.js';
import { clearDraft, encodeDraft } from '../theme-creator/share.js';

const meta = {
  title: 'Themes/Theme creator',
  // The creator previews its own theme; the toolbar's would only cover the page.
  globals: { theme: 'none' },
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
  render: () => html`<argus-theme-creator></argus-theme-creator>`,
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * Make your own theme: start from one of the shipped themes, change a few
 * seeds (accent, surface, header, lines, rows, type, depth), fine-tune any
 * token or part, and check contrast in light and dark. Copy or download the
 * CSS, or copy a link that opens the creator with your theme.
 *
 * Or let your coding agent start one: the `argus-table-theme` skill (in the
 * repository's `skills/` folder) turns your brand colours, fonts or website
 * into a link that opens here.
 */
export const Creator: Story = {};

/**
 * The creator's test, out of the sidebar: a play function runs whenever a
 * story is opened, and this one starts over (it clears the saved draft).
 */
export const CreatorTest: Story = {
  tags: ['!dev'],
  beforeEach: () => {
    // Each test run starts from the default theme.
    clearDraft();
  },
  play: async ({ canvasElement }) => {
    const creator = canvasElement.querySelector<ArgusThemeCreator>('argus-theme-creator');
    if (!creator) throw new Error('no creator');
    await creator.updateComplete;
    const root = creator.shadowRoot;
    if (!root) throw new Error('no shadow root');
    const tables = () => [...root.querySelectorAll('argus-table.main')];
    const token = (name: string) =>
      tables().map((t) => getComputedStyle(t).getPropertyValue(name).trim());
    const background = () => tables().map((t) => getComputedStyle(t).backgroundColor);

    // The Material-inspired preset: its surface colour reaches both previews,
    // each in its own scheme.
    const preset = root.querySelector<HTMLSelectElement>('#preset');
    if (!preset) throw new Error('no preset select');
    preset.value = 'material';
    preset.dispatchEvent(new Event('change'));
    await creator.updateComplete;
    await expect(creator.css).toContain('--argus-border-radius: 12px;');
    await waitFor(() => expect(background()).toEqual(['rgb(254, 247, 255)', 'rgb(20, 18, 24)']));

    // The accent changes the focus ring in both schemes.
    const before = token('--argus-focus-ring');
    const accent = root.querySelector<HTMLInputElement>('#accent-light');
    if (!accent) throw new Error('no accent input');
    accent.value = '#0a7d5a';
    accent.dispatchEvent(new Event('input'));
    await creator.updateComplete;
    const after = token('--argus-focus-ring');
    await expect(after[0]).not.toBe(before[0]);
    await expect(after[0]).toContain('#0a7d5a');

    // Uppercase header labels, through ::part(header-cell).
    const uppercase = [...root.querySelectorAll('label')].find((l) =>
      l.textContent.includes('Uppercase header labels'),
    );
    if (!uppercase) throw new Error('no uppercase option');
    await userEvent.click(uppercase);
    await creator.updateComplete;
    const header = tables()[0]?.shadowRoot?.querySelector('[part~="header-cell"]');
    if (!header) throw new Error('no header cell');
    await waitFor(() => expect(getComputedStyle(header).textTransform).toBe('uppercase'));

    // The CSS is a theme: light-dark() colours and the scheme switches.
    await expect(creator.css).toContain('light-dark(');
    await expect(creator.css).toContain("argus-table[data-argus-theme='dark']");

    // A link opened in this tab changes only the hash: the creator opens its
    // theme and takes the hash out of the URL, so a reload keeps changes.
    const text = () => root.textContent;
    location.hash = `theme=${await encodeDraft(newDraft('bootstrap', 'Linked'))}`;
    await waitFor(() => expect(text()).toContain('Opened the theme from the link.'));
    await expect(creator.css).toContain(
      'Linked: an argus-table theme, based on the Bootstrap-inspired theme.',
    );
    await expect(location.hash).toBe('');

    // An unreadable one keeps the current theme, and says so.
    location.hash = 'theme=not-a-theme';
    await waitFor(() =>
      expect(text()).toContain('The link’s theme couldn’t be read; kept the current theme.'),
    );
    await expect(creator.css).toContain('Linked: an argus-table theme');
    history.replaceState(history.state, '', location.pathname + location.search);
  },
};
