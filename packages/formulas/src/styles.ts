/**
 * The add-on's CSS. Formula headers and error values are light-DOM content of
 * the table, so the sheet goes to the table's root node (the document, or the
 * shadow root the table sits in), once per root. In its own layer, so page CSS wins.
 */
const CSS = `
@layer argus-formulas {
  .argus-formula-header {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35em;
    max-inline-size: 100%;
    min-inline-size: 0;
  }
  .argus-formula-mark {
    flex: none;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
  }
  .argus-formula-label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .argus-formula-error {
    color: var(--argus-formula-error-color, inherit);
  }
}
`;

let sheet: CSSStyleSheet | undefined;
const adopted = new WeakSet<Document | ShadowRoot>();

/** Adds the add-on's sheet to the root node `element` is in, once per root. */
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
