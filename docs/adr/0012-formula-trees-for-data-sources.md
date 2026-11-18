# ADR 0012: Formula trees for data sources

- **Status:** Accepted (18 November 2026).
- **Builds on:** [ADR 0004](0004-api-1-0.md) (public API and its compatibility policy; this closes one of its additions after 1.0). Design: `docs/superpowers/specs/2026-11-18-formula-trees-for-data-sources-design.md`.

## Context

With a `dataSource`, the server sorts and filters, and the table only sends it `sorting`, `filters` and `quickFilter`. It doesn't know what a formula column computes, so `formulas()` has dropped `sortable` and `filter` from every formula column when the table has a `dataSource`: the values show (computed in the browser for the loaded rows), but users can't sort or filter by them. ADR 0004 listed the way out as an open addition: passing a formula's syntax tree to `getRows`.

Who evaluates formulas on a server varies too much (SQL, search engines, an API in another language) for argus-table to ship an evaluator. What every server needs is the formula in a stable form, and the table to sort and filter by it.

## Decision

- **Everything is in `@argus-table/formulas`.** The table, core and `RowsRequest` don't change.
- **A switch, all or nothing:** `formulas({ server: true })` says the app's server evaluates formulas. With it and a `dataSource`, formula columns keep their `sortable` and `filter`. Columns whose formula is broken (it doesn't parse, names an unknown column or function, or is in a cycle), uses whole columns (`[[name]]`), or reads such a column stay unsortable and unfilterable. Without it, nothing changes.
- **`formulaTrees(table)`** returns `{ columns, timeZone }`: per formula column a server can evaluate, its syntax tree (`FormulaTree`: the parser's nodes without source offsets, references resolved to column ids, plain JSON), and the browser's IANA time zone, which the date functions need. `getRows` calls it and sends it to the server. An object, not a record of trees, so fields can be added later.
- **Reloading:** when the trees change (a formula edited, a column added or removed) while `server` is on, the table has a `dataSource` and some formula column is sorted or filtered or the quick filter has text, the plugin calls `refresh()` after the update. Not when the same update changes `dataSource`, `sorting`, `columnFilters` or `quickFilter`, which start a fresh cache anyway.
- **What the promise covers:** the tree format and the `FormulaTrees` shape are public API under ADR 0004 and only grow (new node types or fields; servers treat an unknown node type as a formula they can't evaluate). The rules the docs give for what the browser computes (coercions, comparisons, functions) describe the current release: a fix to the engine may change one in a minor release, and its changelog entry says so.
- **The docs teach the format**, the rules, the built-in functions, and a SQL sketch; a docs example runs a pretend server that evaluates the trees with its own small evaluator.

## Options not taken

- **A plugin hook that adds fields to each `RowsRequest`.** The trees would arrive in the request and the table could reload on its own, but it's new table API, with core bytes, for a need only one add-on has.
- **Per-column opt-in.** More to configure for no case anyone has: a server that evaluates formulas evaluates them all, and broken ones are left out anyway.
- **Freezing the rules too.** Every engine fix would become a major release.
- **A bare `Record<string, FormulaTree>`.** Nothing could ever sit beside the trees, and the time zone was needed from the start.

## Consequences

- The plugin grows by 0.51 kB min+gzip (12.77 kB); its budget goes from 12.3 to 12.8 kB. The conversion and the reload check can't load later: `getRows` calls `formulaTrees()` synchronously, and the check runs on every update.
- Formula columns also follow a `dataSource` set or removed after the first render (before, the plugin noticed only when `columns` changed).
- Whole columns with a `dataSource` stay `#N/A`; sending them is a later addition (a `range` node type).
