# Server data: `dataSource`

Use a `dataSource` when the rows live on a server and there are too many to load at once (or the server sorts and filters). The table asks for the rows that scroll into view, page by page, and keeps a cache. Rows still loading render as skeletons.

```ts
import type { DataSource } from 'argus-table'; // or the wrapper

export const ordersSource: DataSource<Order> = {
  pageSize: 100, // rows per request (default 100)
  async getRows({ start, end, sorting, filters, quickFilter, signal }) {
    const params = new URLSearchParams({ offset: String(start), limit: String(end - start) });
    if (sorting[0]) params.set('sort', `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`);
    if (quickFilter) params.set('q', quickFilter);
    for (const [id, filter] of Object.entries(filters))
      params.set(`filter.${id}`, JSON.stringify(filter));
    const res = await fetch(`/api/orders?${params}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
    const body = (await res.json()) as { items: Order[]; total: number };
    return { rows: body.items, total: body.total };
  },
};
```

- **`start` / `end`:** row indexes, `end` exclusive (like `slice`). Ask the server for `end - start` rows from `start`.
- **`sorting`:** `[{ id, desc }]` in priority order; `[]` unsorted. The table doesn't sort these rows: the server must. Columns still need `sortable: true`.
- **`filters`:** `{ [columnId]: ColumnFilter }` ([api.md](api.md#filters)). `quickFilter`: the search text. The server filters.
- **`signal`:** aborted when the rows aren't needed any more (scrolled away, a new sort). Pass it to `fetch` to save the request. An API client without a signal works too: the table drops answers to requests it no longer wants.
- **`total`:** the number of rows, if the server knows it. Without it, the table grows as pages arrive and a short page marks the end (an unknown total shows as an open-ended scrollbar).
- **Errors:** throw or reject. The rows show a Retry button, and `argus-load-error` fires with `{ error, start, end }`.
- **A new sort, filter or quick filter** starts a fresh cache and scrolls to the top. `table.refresh()` reloads the pages in view (after the data changed on the server).
- **Keep the object stable.** A new `dataSource` object is a new source: it reloads from the top. Define it once (module scope, `useMemo`, a class field); to change parameters (a tenant, a date range), make a new one on purpose.
- **`getRowId`:** use the server's ids. Without it, ids are positions in the server's order, which change with sorting.

- **Pages are aligned:** `start` is always a multiple of the table's `pageSize`, and `end - start` is `pageSize` (less for the last page once `total` is known). So a page-based API gets `page = start / pageSize` exactly.
- **Column ids are what the server gets** in `sorting` and `filters`. When they differ from the API's field names, map them in `getRows` (a small `Record<columnId, apiField>`), rather than renaming columns.
- **State that only drove the fetch goes away:** pagination, sort and filter state, `loading` flags and the effect that fetched. Keep `sorting` bound only if the app shows or saves it.
- **Showing the total** (the old footer's "1–25 of 50,000"): keep the `total` from the last `getRows` in your own state and render it next to the table.

## Mapping API styles

| Your API                                  | In `getRows`                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `offset` / `limit`                        | `offset = start`, `limit = end - start`                                                                                                                                                                                                                      |
| `page` / `pageSize` (0-based)             | Set the table's `pageSize` to the API's page size; then `page = start / pageSize`. Return that page's rows                                                                                                                                                   |
| `page` (1-based)                          | `page = start / pageSize + 1`                                                                                                                                                                                                                                |
| cursor (`after=<cursor>`)                 | Partial: rows are fetched by position. Keep a map from page index to cursor; load pages in order, and for a page whose cursor isn't known yet, fetch the ones before it first. Fine for "load more as you scroll"; jumping to the end of a long list is slow |
| GraphQL connections (`first`, `after`)    | As cursor; with `totalCount` return it as `total`                                                                                                                                                                                                            |
| No server sorting                         | Don't set `sortable` on those columns                                                                                                                                                                                                                        |
| Everything in one response (≤ ~200k rows) | Use `data` instead: client-side sorting and filtering are fast                                                                                                                                                                                               |

## What changes compared with `data`

- Sorting and filtering happen on the server; the table sends them in `getRows`.
- A `'set'` filter offers only `filterOptions` (give the values from your API).
- Formula columns (`@argus-table/formulas`) can't sort or filter.
- Selection: only loaded rows can be selected; Ctrl/Cmd+A selects the rows loaded so far. A "select all N rows on the server" is the app's to model (a flag next to `selection`).
- `width: 'auto'` measures the first page that loads.

## From paginated tables

Paginated grids (MUI `paginationMode="server"`, AG Grid `pagination`, TanStack `manualPagination`, PrimeNG `lazy`, Vuetify `v-data-table-server`, Ant Design `onChange` with `pagination`) usually call the API with a page and a page size. Keep the API; change the caller:

1. Move the fetch into `getRows`, mapping `start`/`end` to the API's page (table above).
2. Map the old sort and filter models into the request from `sorting` and `filters`.
3. Delete the pagination state and the paginator; the scrollbar replaces them.
4. Return `total` from the API's count.
