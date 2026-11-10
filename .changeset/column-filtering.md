---
'argus-table': minor
---

Rows can be filtered. `columnFilters` sets a filter per column id and saves as JSON; `quickFilter` searches every shown column, for your own search box:

```js
table.columnFilters = {
  city: { kind: 'set', values: ['Lisbon', 'Oslo'] },
  total: { kind: 'number', op: 'between', value: 100, to: 500 },
};
table.quickFilter = 'oslo paid'; // or <argus-table quick-filter="…">
```

- Four kinds of filter: `text` (contains, equals, starts with, empty, not empty, ignoring case), `number` and `date` (equal, not equal, less, greater, between, empty, not empty; dates by day, from ISO strings), and `set` (one of a list of values). A row shows when it passes every filter, and each word of `quickFilter` is found in one of its shown columns.
- A column's `filter` (`'text'`, `'number'`, `'date'` or `'set'`, also as an `<argus-column filter>` attribute) lets users filter it from plugins such as the column menu. `filterFn(value, filter, row)` replaces the built-in matching, and `filterOptions` lists the values a `set` filter offers.
- Filtered headers get the `header-cell-filtered` part and a funnel mark (part `filter-indicator`, token `--argus-filter-indicator-color`), and screen readers hear "Filtered" on them and the number of rows left after a change.
- With a `dataSource`, the server filters: `getRows()` now receives `filters` and `quickFilter`, and a change reloads from the top.
- Like `columnPinning`, `columnFilters` is uncontrolled until you set it. Plugins use the new `host.setFilter()`, which fires `argus-column-filter` (`{ columnId, filter, filters }`), and `host.filterValues()` for the values of a set filter. `host.column()` now reports a column's `filter` kind and its `filterValue`.
- Select-all and Shift ranges take the rows the filters leave.
- The bundle with everything inlined grows by about 1.9 kB (gzip).
