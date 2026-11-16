/**
 * The add-on's CSS. Editors are light-DOM content of the table's cells, so the
 * sheet goes to the table's root node (the document, or the shadow root the
 * table sits in), once per root. In its own layer, so page CSS wins. Inputs
 * inherit the cell's font, colour and alignment; the validation message is a
 * popover in the top layer, so the cell doesn't clip it.
 */
const CSS = `
@layer argus-editing {
  /* The cell content grows, so the editor fills the cell. */
  argus-table > :has(> .argus-edit) {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  .argus-edit {
    display: block;
    inline-size: 100%;
  }
  .argus-edit-input {
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    padding: 0.15em 0.35em;
    border: 1px solid
      var(
        --argus-editor-border-color,
        var(--argus-border-color, color-mix(in srgb, currentColor 30%, transparent))
      );
    border-radius: 3px;
    background: var(--argus-editor-bg, var(--argus-bg, Canvas));
    color: inherit;
    font: inherit;
    text-align: inherit;
  }
  .argus-edit-input:focus-visible {
    outline: var(--argus-focus-ring, 2px solid Highlight);
    outline-offset: -1px;
  }
  .argus-edit-input[aria-invalid='true'] {
    border-color: var(--argus-editor-error-color, currentColor);
    border-style: dashed;
  }
  .argus-edit-check {
    margin: 0;
  }
  .argus-edit-error {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 0.25em 0.5em;
    border: 1px solid var(--argus-editor-error-color, currentColor);
    border-radius: 4px;
    background: var(--argus-editor-bg, var(--argus-bg, Canvas));
    color: var(--argus-editor-error-color, var(--argus-fg, CanvasText));
    font: inherit;
    font-size: 0.875em;
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
