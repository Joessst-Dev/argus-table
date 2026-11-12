---
'argus-table': minor
---

**Breaking:** state events are renamed to `argus-<property>-change`. Each event's `detail` now holds the new value under the property's name, followed by what caused the change:

| Before                 | After                            | `detail`                                                                                             |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `argus-sort-change`    | `argus-sorting-change`           | `{ sorting }`                                                                                        |
| `argus-column-resize`  | `argus-column-sizing-change`     | `{ columnSizing, columnId, width }` (was `sizing`)                                                   |
| `argus-column-reorder` | `argus-column-order-change`      | `{ columnOrder, columnId, groupId? }` (was `order`)                                                  |
| `argus-column-pin`     | `argus-column-pinning-change`    | `{ columnPinning, columnId, pin }` (was `pinning`)                                                   |
| `argus-column-hide`    | `argus-column-visibility-change` | `{ columnVisibility, columnId, visible }` (was `visibility`, and `hidden` with the opposite meaning) |
| `argus-column-filter`  | `argus-column-filters-change`    | `{ columnFilters, columnId, columnFilter }` (was `filters` and `filter`)                             |
| `argus-row-select`     | `argus-selection-change`         | `{ selection }`                                                                                      |

- The exported constants follow the new names: `SORTING_CHANGE`, `COLUMN_SIZING_CHANGE`, `COLUMN_ORDER_CHANGE`, `COLUMN_PINNING_CHANGE`, `COLUMN_VISIBILITY_CHANGE`, `COLUMN_FILTERS_CHANGE` and `SELECTION_CHANGE`.
- The detail types are renamed too: `SortingChangeDetail`, `ColumnSizingChangeDetail`, `ColumnOrderChangeDetail`, `ColumnPinningChangeDetail`, `ColumnVisibilityChangeDetail`, `ColumnFiltersChangeDetail` and `SelectionChangeDetail`.
- `argus-range-change` now reports `{ first, last }` (both inclusive) instead of `{ start, end }`.
- `argus-cell-click` now also has `rowId` and `index`, like `argus-row-click`.
