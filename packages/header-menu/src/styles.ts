/**
 * The add-on's CSS. The button and the menu are light-DOM content of the table,
 * so the sheet goes to the table's root node (the document, or the shadow root
 * the table sits in), once per root. In its own layer, so page CSS wins.
 *
 * One fallback per token and role, shared by the add-ons: `--argus-border-color`
 * falls back to 20% of the text colour for lines (separators, popup edges) and
 * 30% for form controls, so their edges stay visible; `--argus-menu-item-active-bg`
 * to 10%.
 */
const CSS = `
@layer argus-header-menu {
  /* The header content grows, so the button sits at the inline end. */
  argus-table > :has(> .argus-header-menu-header) {
    flex: 1 1 auto;
  }
  .argus-header-menu-header {
    display: flex;
    align-items: center;
    gap: 0.25em;
    min-inline-size: 0;
  }
  .argus-header-menu-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .argus-header-menu-button {
    flex: none;
    display: inline-grid;
    place-items: center;
    inline-size: 1.5em;
    block-size: 1.5em;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    opacity: 0.6;
    cursor: pointer;
  }
  .argus-header-menu-button:hover,
  .argus-header-menu-button[aria-expanded='true'] {
    opacity: 1;
    background: var(--argus-menu-item-active-bg, color-mix(in srgb, currentColor 10%, transparent));
  }
  .argus-header-menu-button svg {
    inline-size: 1em;
    block-size: 1em;
  }
  .argus-header-menu,
  .argus-header-filter {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 4px 0;
    min-inline-size: 11em;
    box-sizing: border-box;
    border: var(--argus-border-width, 1px) solid
      var(--argus-border-color, color-mix(in srgb, currentColor 20%, transparent));
    border-radius: 4px;
    background: var(--argus-menu-bg, var(--argus-bg, Canvas));
    color: var(--argus-menu-fg, var(--argus-fg, CanvasText));
    box-shadow: var(--argus-menu-shadow, 0 4px 16px rgb(0 0 0 / 0.16));
    font: var(--argus-font, inherit);
    font-weight: normal;
    text-align: start;
    white-space: nowrap;
  }
  .argus-header-filter {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    inline-size: 15em;
    white-space: normal;
  }
  .argus-header-filter-field {
    display: grid;
    gap: 2px;
    font-size: 0.85em;
  }
  .argus-header-filter :is(input:not([type='checkbox']), select, button) {
    box-sizing: border-box;
    min-inline-size: 0;
    padding: 4px 6px;
    border: var(--argus-border-width, 1px) solid
      var(--argus-border-color, color-mix(in srgb, currentColor 30%, transparent));
    border-radius: 4px;
    background: var(--argus-menu-bg, var(--argus-bg, Canvas));
    color: inherit;
    font: inherit;
    font-size: 1rem;
  }
  .argus-header-filter :is(input, select, button):focus-visible {
    outline: var(--argus-focus-ring, 2px solid Highlight);
    outline-offset: 1px;
  }
  .argus-header-filter-values {
    display: grid;
    max-block-size: 14em;
    overflow: auto;
  }
  .argus-header-filter-check {
    display: flex;
    align-items: center;
    gap: 0.4em;
    padding-block: 2px;
    overflow-wrap: anywhere;
  }
  .argus-header-filter-check input {
    flex: none;
    margin: 0;
  }
  .argus-header-filter-all {
    padding-block-end: 4px;
    border-block-end: 1px solid
      var(--argus-border-color, color-mix(in srgb, currentColor 20%, transparent));
  }
  .argus-header-filter-note {
    margin: 0;
    font-size: 0.85em;
    opacity: 0.75;
  }
  .argus-header-filter-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  .argus-header-filter-button {
    cursor: pointer;
  }
  .argus-header-filter-button:hover {
    background: var(--argus-menu-item-active-bg, color-mix(in srgb, currentColor 10%, transparent));
  }
  .argus-header-menu-item {
    display: flex;
    align-items: center;
    gap: 0.5em;
    inline-size: 100%;
    margin: 0;
    padding: 6px 12px 6px 8px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .argus-header-menu-item::before {
    content: '';
    inline-size: 1em;
    text-align: center;
  }
  .argus-header-menu-item[aria-checked='true']::before {
    content: '\\2713' / '';
  }
  .argus-header-menu-item:hover,
  .argus-header-menu-item:focus {
    background: var(--argus-menu-item-active-bg, color-mix(in srgb, currentColor 10%, transparent));
    outline: none;
  }
  .argus-header-menu-item:focus-visible {
    outline: var(--argus-focus-ring, 2px solid Highlight);
    outline-offset: -2px;
  }
  .argus-header-menu-item-label {
    flex: 1 1 auto;
  }
  .argus-header-menu-item-detail {
    max-inline-size: 16em;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.7;
    font-family: var(--argus-menu-detail-font, ui-monospace, monospace);
    font-size: 0.85em;
  }
  .argus-header-menu-item-danger {
    color: var(--argus-menu-danger-fg, inherit);
  }
  .argus-header-menu-group-label {
    padding: 6px 12px 2px calc(8px + 1.5em);
    font-size: 0.85em;
    font-weight: 600;
    opacity: 0.75;
  }
  .argus-header-menu [role='separator'] {
    block-size: 1px;
    margin-block: 4px;
    background: var(--argus-border-color, color-mix(in srgb, currentColor 20%, transparent));
  }
  @media (forced-colors: active) {
    .argus-header-menu,
    .argus-header-filter {
      border-color: CanvasText;
    }
    .argus-header-menu-item:focus,
    .argus-header-menu-item:hover {
      background: Highlight;
      color: HighlightText;
    }
  }
}
`;

let sheet: CSSStyleSheet | undefined;
const adopted = new WeakSet<Document | ShadowRoot>();

/** Adds the add-on's sheet to the root node a table is in, once. */
export function adoptStyles(element: Element): void {
  const root = element.getRootNode();
  if (!(root instanceof Document || root instanceof ShadowRoot) || adopted.has(root)) return;
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
  }
  if (!root.adoptedStyleSheets.includes(sheet)) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  }
  adopted.add(root);
}
