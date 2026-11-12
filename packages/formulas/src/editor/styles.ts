/**
 * The formula editor's CSS, loaded with the editor. The dialog sits in a
 * header's light-DOM content, so it inherits the table's tokens; it resets
 * what a header passes down (bold, no wrapping, ellipsis). Colours come from
 * tokens with neutral fallbacks. In its own layer, so page CSS wins.
 */
const CSS = `
@layer argus-formulas {
  .argus-formula-editor {
    box-sizing: border-box;
    inline-size: min(36rem, calc(100vw - 2rem));
    max-block-size: calc(100vh - 2rem);
    padding: 20px;
    border: var(--argus-border-width, 1px) solid
      var(--argus-border-color, color-mix(in srgb, currentColor 20%, transparent));
    border-radius: 8px;
    background: var(--argus-dialog-bg, var(--argus-menu-bg, var(--argus-bg, Canvas)));
    color: var(--argus-dialog-fg, var(--argus-menu-fg, var(--argus-fg, CanvasText)));
    box-shadow: var(--argus-dialog-shadow, 0 20px 48px rgb(0 0 0 / 0.28));
    font: var(--argus-font, inherit);
    font-weight: normal;
    text-align: start;
    white-space: normal;
    overflow: auto;
    cursor: auto;
  }
  .argus-formula-editor::backdrop {
    background: var(--argus-dialog-backdrop, rgb(0 0 0 / 0.4));
  }
  .argus-formula-editor form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .argus-formula-editor-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .argus-formula-editor h2 {
    margin: 0;
    font-size: 1.15em;
    font-weight: 600;
  }
  .argus-formula-editor button,
  .argus-formula-editor input {
    font: inherit;
    color: inherit;
  }
  .argus-formula-editor button {
    min-block-size: 2.25em;
    padding: 0 12px;
    border: var(--argus-border-width, 1px) solid
      var(--argus-border-color, color-mix(in srgb, currentColor 25%, transparent));
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .argus-formula-editor button:hover {
    background: var(--argus-menu-item-active-bg, color-mix(in srgb, currentColor 8%, transparent));
  }
  .argus-formula-editor :focus-visible {
    outline: var(--argus-focus-ring, 2px solid Highlight);
    outline-offset: 1px;
  }
  .argus-formula-editor .argus-formula-close {
    display: grid;
    place-items: center;
    inline-size: 2em;
    min-block-size: 2em;
    padding: 0;
    border: 0;
  }
  .argus-formula-close svg {
    inline-size: 1.1em;
    block-size: 1.1em;
  }
  .argus-formula-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .argus-formula-row > label {
    font-weight: 500;
  }
  .argus-formula-editor input {
    box-sizing: border-box;
    inline-size: 100%;
    min-block-size: 2.5em;
    padding: 0 10px;
    border: var(--argus-border-width, 1px) solid
      var(--argus-border-color, color-mix(in srgb, currentColor 30%, transparent));
    border-radius: 6px;
    background: var(--argus-bg, Canvas);
  }
  .argus-formula-editor input[aria-invalid='true'] {
    border-color: var(--argus-formula-error-color, currentColor);
  }
  .argus-formula-field {
    position: relative;
    font-family: var(--argus-formula-font, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace);
  }
  .argus-formula-field input,
  .argus-formula-mirror {
    font-family: inherit;
    font-size: inherit;
    letter-spacing: normal;
  }
  /* The input's text is invisible; the coloured copy behind it shows through. */
  .argus-formula-field input {
    position: relative;
    background: transparent;
    color: transparent;
    caret-color: var(--argus-dialog-fg, var(--argus-fg, CanvasText));
  }
  .argus-formula-field input::placeholder {
    color: var(--argus-dialog-fg, var(--argus-fg, CanvasText));
    opacity: 0.55;
  }
  .argus-formula-field input::selection {
    color: transparent;
    background: color-mix(in srgb, Highlight 35%, transparent);
  }
  .argus-formula-mirror {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0 10px;
    border: var(--argus-border-width, 1px) solid transparent;
    border-radius: 6px;
    background: var(--argus-formula-input-bg, var(--argus-bg, Canvas));
    white-space: pre;
    overflow: hidden;
  }
  .argus-formula-function {
    color: var(--argus-formula-function-color, inherit);
    font-weight: 600;
  }
  .argus-formula-ref,
  .argus-formula-range {
    border-radius: 3px;
    background: var(--argus-formula-ref-bg, color-mix(in srgb, currentColor 10%, transparent));
    color: var(--argus-formula-ref-color, inherit);
  }
  /* A whole column: its brackets doubled, and in bold. */
  .argus-formula-range {
    font-weight: 600;
  }
  .argus-formula-number {
    color: var(--argus-formula-number-color, inherit);
  }
  .argus-formula-text {
    color: var(--argus-formula-text-color, inherit);
  }
  .argus-formula-name,
  .argus-formula-bad {
    text-decoration: underline wavy var(--argus-formula-error-color, currentColor);
    text-decoration-skip-ink: none;
  }
  .argus-formula-suggestions {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: calc(100% + 2px);
    z-index: 1;
    min-inline-size: 14em;
    max-block-size: 14em;
    margin: 0;
    padding: 4px 0;
    overflow: auto;
    list-style: none;
    border: var(--argus-border-width, 1px) solid
      var(--argus-border-color, color-mix(in srgb, currentColor 20%, transparent));
    border-radius: 6px;
    background: var(--argus-menu-bg, var(--argus-bg, Canvas));
    color: var(--argus-menu-fg, var(--argus-fg, CanvasText));
    box-shadow: var(--argus-menu-shadow, 0 4px 16px rgb(0 0 0 / 0.16));
  }
  .argus-formula-suggestions li {
    display: flex;
    justify-content: space-between;
    gap: 1em;
    padding: 4px 10px;
    cursor: pointer;
  }
  .argus-formula-suggestions li[aria-selected='true'] {
    background: var(--argus-menu-item-active-bg, color-mix(in srgb, currentColor 12%, transparent));
  }
  .argus-formula-suggestion-kind,
  .argus-formula-hint span,
  .argus-formula-note,
  .argus-formula-preview-head span + span {
    opacity: 0.8;
    font-family: var(--argus-font, inherit);
  }
  .argus-formula-hint {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--argus-header-bg, color-mix(in srgb, currentColor 6%, transparent));
  }
  .argus-formula-hint strong {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .argus-formula-hint code {
    font-family: var(--argus-formula-font, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace);
  }
  .argus-formula-problem {
    margin: 0;
    color: var(--argus-formula-error-color, inherit);
  }
  .argus-formula-insert,
  .argus-formula-functions [role='group'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .argus-formula-functions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .argus-formula-functions-group {
    min-inline-size: 3.5em;
    font-weight: 500;
  }
  .argus-formula-editor .argus-formula-chip {
    min-block-size: 1.9em;
    padding: 0 10px;
    border-radius: 999px;
  }
  .argus-formula-editor .argus-formula-chip-function {
    font-family: var(--argus-formula-font, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace);
    font-size: 0.85em;
  }
  .argus-formula-editor .argus-formula-all {
    margin-inline-start: auto;
    border: 0;
    text-decoration: underline;
  }
  .argus-formula-preview-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-weight: 500;
  }
  .argus-formula-preview {
    inline-size: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .argus-formula-preview th,
  .argus-formula-preview td {
    padding: 6px 10px;
    border-block-end: var(--argus-border-width, 1px) solid
      var(--argus-border-color, color-mix(in srgb, currentColor 15%, transparent));
    text-align: start;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-inline-size: 12em;
  }
  .argus-formula-preview th {
    background: var(--argus-header-bg, color-mix(in srgb, currentColor 6%, transparent));
    color: var(--argus-header-fg, inherit);
    font-weight: 600;
  }
  .argus-formula-preview [data-align='end'] {
    text-align: end;
  }
  .argus-formula-note {
    margin: 0;
  }
  .argus-formula-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .argus-formula-editor .argus-formula-primary {
    border-color: transparent;
    background: var(--argus-dialog-accent, Highlight);
    color: var(--argus-dialog-accent-fg, HighlightText);
    font-weight: 500;
  }
  .argus-formula-editor .argus-formula-primary:hover {
    background: var(--argus-dialog-accent, Highlight);
    filter: brightness(1.08);
  }
  @media (forced-colors: active) {
    .argus-formula-field input {
      color: CanvasText;
    }
    .argus-formula-mirror {
      visibility: hidden;
    }
    .argus-formula-suggestions li[aria-selected='true'] {
      background: Highlight;
      color: HighlightText;
    }
  }
}
`;

let sheet: CSSStyleSheet | undefined;
const adopted = new WeakSet<Document | ShadowRoot>();

/** Adds the editor's sheet to the root node `element` is in, once per root. */
export function adoptEditorStyles(element: Element): void {
  const root = element.getRootNode();
  if (!(root instanceof Document || root instanceof ShadowRoot) || adopted.has(root)) return;
  sheet ??= new CSSStyleSheet();
  sheet.replaceSync(CSS);
  if (!root.adoptedStyleSheets.includes(sheet)) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  }
  adopted.add(root);
}
