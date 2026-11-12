# Tokens

Every `--argus-*` token a theme can set, for `overrides` in a draft. Most themes need none: the seeds write these tokens for you (see [draft-format.md](draft-format.md)). A value may be one for both schemes, or `{ "light": …, "dark": … }`.

## The table

| Token                            | Default               | Meaning                                                                                                                                                                          |
| -------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--argus-bg`                     | `Canvas`              | Background of the table and rows.                                                                                                                                                |
| `--argus-fg`                     | `CanvasText`          | Text colour.                                                                                                                                                                     |
| `--argus-font`                   | `inherit`             | Font shorthand for the table.                                                                                                                                                    |
| `--argus-header-bg`              |                       | Header background.                                                                                                                                                               |
| `--argus-header-fg`              | `inherit`             | Header text colour.                                                                                                                                                              |
| `--argus-border-color`           |                       | Colour of the row borders.                                                                                                                                                       |
| `--argus-border-width`           | `1px`                 | Width of the row borders.                                                                                                                                                        |
| `--argus-border`                 | `none`                | Border around the whole table, as a `border` shorthand (`1px solid …`). Inside the element's size. The lines between rows are `--argus-border-width` and `--argus-border-color`. |
| `--argus-border-radius`          | `0`                   | Corner radius of the table. Header, rows and pinned columns are clipped to it.                                                                                                   |
| `--argus-row-height`             |                       | Height of a row, and of each header row. Default per density: 32px, 40px, 52px. With `rowHeight: 'auto'`: the height of each header row and the least a body or pinned row is.   |
| `--argus-cell-padding-inline`    |                       | Inline padding of cells. Default per density: 8px, 12px, 16px.                                                                                                                   |
| `--argus-cell-padding-block`     |                       | Block padding of body and pinned-row cells with `rowHeight: 'auto'`, where content sits at the top of the cell. Default: what centres one line of text in `--argus-row-height`.  |
| `--argus-row-odd-bg`             |                       | Background of odd rows. Default: no stripes.                                                                                                                                     |
| `--argus-pinned-shadow`          |                       | Shadow on the pinned edge, as a `box-shadow` falling toward the end side (`4px 0 6px -4px …`). Mirrored for the end edge and in RTL; `none` removes it.                          |
| `--argus-resize-handle-color`    |                       | Colour of the resize handle's line, shown on hover, focus and drag.                                                                                                              |
| `--argus-focus-ring`             | `2px solid Highlight` | Outline of the focused header or cell.                                                                                                                                           |
| `--argus-filter-indicator-color` | `currentColor`        | Colour of the mark in the header of a filtered column.                                                                                                                           |
| `--argus-drop-indicator-color`   | `Highlight`           | Colour of the line that marks where a dragged column would land.                                                                                                                 |
| `--argus-row-hover-bg`           |                       | Background of the hovered row. Default: no change.                                                                                                                               |
| `--argus-row-pinned-bg`          | `var(--argus-bg)`     | Background of the pinned rows, pinned columns included.                                                                                                                          |
| `--argus-skeleton-bg`            |                       | Colour of the skeleton bars in rows still loading. Default: the text colour at low opacity.                                                                                      |
| `--argus-row-selected-bg`        |                       | Background of selected rows, pinned columns included. Default: the system highlight colour, mixed into `--argus-bg`. It wins over `--argus-row-hover-bg`.                        |

## Column menu (`@argus-table/header-menu`)

| Token                         | Default                        | Meaning                                                                          |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| `--argus-menu-bg`             | `var(--argus-bg)`              | Background of the column menu.                                                   |
| `--argus-menu-fg`             | `var(--argus-fg)`              | Text colour of the column menu.                                                  |
| `--argus-menu-shadow`         | `0 4px 16px rgb(0 0 0 / 0.16)` | Shadow under the column menu.                                                    |
| `--argus-menu-item-active-bg` |                                | Background of the hovered or focused menu item. Default: the text colour at 10%. |
| `--argus-menu-danger-fg`      | `inherit`                      | Text colour of destructive menu items (removing a formula column).               |
| `--argus-menu-detail-font`    | `ui-monospace, monospace`      | Font of details in the menu (a formula).                                         |

## Formula columns (`@argus-table/formulas`)

| Token                         | Default                                                      | Meaning                                                               |
| ----------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `--argus-dialog-bg`           | `var(--argus-menu-bg)`                                       | Background of the formula editor.                                     |
| `--argus-dialog-fg`           | `var(--argus-menu-fg)`                                       | Text colour of the formula editor.                                    |
| `--argus-dialog-accent`       | `Highlight`                                                  | The editor's save button.                                             |
| `--argus-dialog-accent-fg`    | `HighlightText`                                              | Text on the save button.                                              |
| `--argus-dialog-shadow`       | `0 20px 48px rgb(0 0 0 / 0.28)`                              | Shadow under the formula editor.                                      |
| `--argus-dialog-backdrop`     | `rgb(0 0 0 / 0.4)`                                           | Behind the editor.                                                    |
| `--argus-formula-error-fg`    |                                                              | Error values, problems and their underline. Default: the text colour. |
| `--argus-formula-font`        | `ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace` | Font of the formula input.                                            |
| `--argus-formula-input-bg`    | `var(--argus-bg)`                                            | Background of the formula input.                                      |
| `--argus-formula-function-fg` |                                                              | Function names in a formula.                                          |
| `--argus-formula-ref-bg`      |                                                              | Background of column names in a formula.                              |
| `--argus-formula-ref-fg`      |                                                              | Column names in a formula.                                            |
| `--argus-formula-number-fg`   |                                                              | Numbers in a formula.                                                 |
| `--argus-formula-text-fg`     |                                                              | Text literals in a formula.                                           |
