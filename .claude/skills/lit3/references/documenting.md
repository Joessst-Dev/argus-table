# Documenting for the Custom Elements Manifest

`@custom-elements-manifest/analyzer` reads the source and JSDoc and writes `custom-elements.json` (gitignored, built in CI). Storybook (`setCustomElementsManifest()`), the generated React/Vue/Angular wrappers and types, and VS Code `custom-data.json` all come from it. Undocumented API is invisible API.

## Class-level tags

```ts
/**
 * Virtualized data table with pinned rows and columns.
 *
 * @summary Fast, CSS-styleable data table.
 *
 * @fires argus-sort-change - Sorting changed. `detail: { sorting: SortState }`
 * @fires argus-column-resize - A column was resized. `detail: { columnId, width, sizing }`
 *
 * @slot - `<argus-column>` children; read as column definitions, not rendered.
 * @slot empty - Content shown when there are no rows.
 *
 * @csspart header-cell - Each header cell.
 * @csspart cell-pinned - Body cells in a pinned column (added next to `cell`).
 *
 * @cssprop [--argus-row-height=40px] - Body row height.
 * @cssprop [--argus-focus-ring=2px solid Highlight] - Focus ring of the active cell.
 */
```

| Tag | Format |
|---|---|
| `@summary` | One line, used in tables and hovers |
| `@fires` / `@event` | `name - description`; mention the `detail` shape |
| `@slot` | `name - description`; `-` alone for the default slot |
| `@csspart` | `name - description` |
| `@cssprop` / `@cssproperty` | `[--name=default] - description` (brackets mark optional + default) |
| `@attr` / `@attribute` | Only for attributes with no matching property |
| `@tag` | Only if the analyzer can't infer the tag (it reads `@customElement`) |

## Members

```ts
/** Row height in px, or `'auto'` to measure each row. Unset: the density decides (40px at comfortable). */
@property({ attribute: 'row-height' }) rowHeight?: number | 'auto';

/** Scrolls so that the row at `index` is visible. Resolves after render. */
async scrollToRow(index: number): Promise<void> { … }
```

- One or two sentences: what, units, default, and any interaction ("ignored when `columns` is set").
- `@internal` or `private`/`#private` hides members from the manifest.
- Methods are documented the same way; the public ones from the plan are `scrollToRow`, `scrollToColumn`, `refresh`, `autosizeColumns`, `getState`, `setState`.

## Checklist when adding public API

1. Name matches the plan's conventions (`argus-` events, `--argus-` tokens, kebab-case parts with state suffix).
2. Already in `docs/plan/plan/07-public-api.md`, or listed under "Proposed public names" in your summary for a human to approve (don't edit the plan's API list on your own).
3. JSDoc tag added.
4. Story in Storybook showing it (Features or Styling group).
5. Changeset added (`changesets` skill), since public API changed.
