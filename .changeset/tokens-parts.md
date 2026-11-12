---
'argus-table': minor
---

**Breaking:** renamed tokens and a renamed part, plus new parts, for 1.0 (ADR 0004).

**Renamed tokens:**

| Before                  | After                   |
| ----------------------- | ----------------------- |
| `--argus-pinned-row-bg` | `--argus-row-pinned-bg` |
| `--argus-row-stripe-bg` | `--argus-row-odd-bg`    |
| `--argus-outline`       | `--argus-border`        |
| `--argus-radius`        | `--argus-border-radius` |

**Renamed part:** `cell-pinned-row` → `cell-in-pinned-row`. `cell-pinned` keeps meaning a cell in a pinned _column_.

**New parts:**

- `header-cell-sorted-asc` and `header-cell-sorted-desc`, so you can style the sort direction; `::part()` can't read `aria-sort`.
- `sort-indicator`, the chevron in a sortable header.
- `header-cell-pinned` and `header-cell-pinned-edge`, like the body cells' `cell-pinned` and `cell-pinned-edge`.
- `row-error` on the rows of a `dataSource` page that failed to load, next to `row-loading`.

The CDN bundle's size budget goes from 59 to 59.5 kB.
