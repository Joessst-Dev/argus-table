// Every token a theme can set: the table's own, read from the Custom Elements
// Manifest (the element's JSDoc), and those of the header-menu and formulas
// add-ons, listed here (a test checks the list against their sources).
import manifest from 'argus-table/custom-elements.json';

/** How the creator edits a token. */
export type TokenKind =
  /** A colour: a picker per scheme. */
  | 'color'
  /** A length: one text field. */
  | 'length'
  /** Text: a font, a shadow, a border shorthand; a field per scheme when it holds colours. */
  | 'text';

export type TokenGroup = 'table' | 'header-menu' | 'formulas';

export interface TokenInfo {
  name: string;
  group: TokenGroup;
  kind: TokenKind;
  description: string;
  /** The element's or add-on's default, as documented. */
  default?: string;
}

interface ManifestCssProperty {
  name: string;
  description?: string;
  default?: string;
}

interface ManifestDeclaration {
  tagName?: string;
  cssProperties?: ManifestCssProperty[];
  cssParts?: { name: string; description?: string }[];
}

const declaration = (manifest as { modules: { declarations?: ManifestDeclaration[] }[] }).modules
  .flatMap((m) => m.declarations ?? [])
  .find((d) => d.tagName === 'argus-table');

const LENGTHS = new Set([
  '--argus-border-width',
  '--argus-border-radius',
  '--argus-row-height',
  '--argus-cell-padding-inline',
  '--argus-cell-padding-block',
]);
const TEXTS = new Set([
  '--argus-font',
  '--argus-border',
  '--argus-pinned-shadow',
  '--argus-focus-ring',
  '--argus-menu-shadow',
  '--argus-menu-detail-font',
  '--argus-dialog-shadow',
  '--argus-formula-font',
]);
const kindOf = (name: string): TokenKind =>
  LENGTHS.has(name) ? 'length' : TEXTS.has(name) ? 'text' : 'color';

const tableTokens: TokenInfo[] = (declaration?.cssProperties ?? []).map((p) => ({
  name: p.name,
  group: 'table',
  kind: kindOf(p.name),
  description: p.description ?? '',
  ...(p.default === undefined ? {} : { default: p.default }),
}));

const addon = (
  group: TokenGroup,
  name: string,
  description: string,
  defaultValue?: string,
): TokenInfo => ({
  name,
  group,
  kind: kindOf(name),
  description,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
});

// From packages/header-menu/README.md and packages/formulas/README.md.
const addonTokens: TokenInfo[] = [
  addon('header-menu', '--argus-menu-bg', 'Background of the column menu.', 'var(--argus-bg)'),
  addon('header-menu', '--argus-menu-fg', 'Text colour of the column menu.', 'var(--argus-fg)'),
  addon(
    'header-menu',
    '--argus-menu-shadow',
    'Shadow under the column menu.',
    '0 4px 16px rgb(0 0 0 / 0.16)',
  ),
  addon(
    'header-menu',
    '--argus-menu-item-active-bg',
    'Background of the hovered or focused menu item. Default: the text colour at 10%.',
  ),
  addon(
    'header-menu',
    '--argus-menu-danger-fg',
    'Text colour of destructive menu items (removing a formula column).',
    'inherit',
  ),
  addon(
    'header-menu',
    '--argus-menu-detail-font',
    'Font of details in the menu (a formula).',
    'ui-monospace, monospace',
  ),
  addon(
    'formulas',
    '--argus-dialog-bg',
    'Background of the formula editor.',
    'var(--argus-menu-bg)',
  ),
  addon(
    'formulas',
    '--argus-dialog-fg',
    'Text colour of the formula editor.',
    'var(--argus-menu-fg)',
  ),
  addon('formulas', '--argus-dialog-accent', 'The editor’s save button.', 'Highlight'),
  addon('formulas', '--argus-dialog-accent-fg', 'Text on the save button.', 'HighlightText'),
  addon(
    'formulas',
    '--argus-dialog-shadow',
    'Shadow under the formula editor.',
    '0 20px 48px rgb(0 0 0 / 0.28)',
  ),
  addon('formulas', '--argus-dialog-backdrop', 'Behind the editor.', 'rgb(0 0 0 / 0.4)'),
  addon(
    'formulas',
    '--argus-formula-error-fg',
    'Error values, problems and their underline. Default: the text colour.',
  ),
  addon(
    'formulas',
    '--argus-formula-font',
    'Font of the formula input.',
    "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
  ),
  addon(
    'formulas',
    '--argus-formula-input-bg',
    'Background of the formula input.',
    'var(--argus-bg)',
  ),
  addon('formulas', '--argus-formula-function-fg', 'Function names in a formula.'),
  addon('formulas', '--argus-formula-ref-bg', 'Background of column names in a formula.'),
  addon('formulas', '--argus-formula-ref-fg', 'Column names in a formula.'),
  addon('formulas', '--argus-formula-number-fg', 'Numbers in a formula.'),
  addon('formulas', '--argus-formula-text-fg', 'Text literals in a formula.'),
];

export const TOKENS: readonly TokenInfo[] = [...tableTokens, ...addonTokens];
export const TOKEN_NAMES: ReadonlySet<string> = new Set(TOKENS.map((t) => t.name));
export const TABLE_TOKEN_NAMES: ReadonlySet<string> = new Set(tableTokens.map((t) => t.name));
export const ADDON_TOKEN_NAMES: ReadonlySet<string> = new Set(addonTokens.map((t) => t.name));
export const tokenInfo = (name: string): TokenInfo | undefined =>
  TOKENS.find((t) => t.name === name);

/** Documented part names. */
export const PARTS: ReadonlySet<string> = new Set((declaration?.cssParts ?? []).map((p) => p.name));

/** Order in which tokens are written: catalogue order, unknown names last. */
export function tokenOrder(a: string, b: string): number {
  const index = (name: string) => {
    const i = TOKENS.findIndex((t) => t.name === name);
    return i === -1 ? TOKENS.length : i;
  };
  return index(a) - index(b) || a.localeCompare(b);
}

/** Tokens a theme leaves to the element's defaults per density. */
export const SIZE_TOKENS: ReadonlySet<string> = new Set([
  '--argus-row-height',
  '--argus-cell-padding-inline',
  '--argus-cell-padding-block',
]);
