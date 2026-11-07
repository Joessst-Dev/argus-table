---
'argus-table': minor
---

Infinite loading: set `dataSource` instead of `data` to load rows from a server, page by page, as they scroll into view. `getRows({ start, end, sorting, signal })` gets the rows to load (`end` exclusive, like `slice`) and resolves to `{ rows, total? }`; `pageSize` sets the page size (default 100).

- Only the pages in view are requested, once scrolling settles, so a fast fling loads only where it stops. Requests for pages that scroll away are aborted through `signal`.
- Rows still loading show skeleton bars (parts `row-loading` and `skeleton`, colour `--argus-skeleton-bg`). The bars pulse, except with reduced motion.
- Without a `total`, the table grows as pages arrive and ends at a page with fewer rows than it asked for. Screen readers hear an unknown row count until then.
- Sorting happens on the server: `sorting` comes with every request, and a new order reloads from the top.
- A page that fails fires `argus-load-error` (`{ error, start, end }`, also exported as `LOAD_ERROR`) and shows a Retry button (part `retry`) in its first visible row. Enter on a cell of a failed row retries too.
- New method `refresh()`: drops the loaded pages and loads the rows in view again, keeping the scroll position.
