---
'@argus-table/formulas': minor
---

Formula columns can sort and filter with a `dataSource`: turn it on with `formulas({ server: true })`, and send each formula's syntax tree from `getRows` with `formulaTrees(table)`, so your server sorts and filters by it. The Formulas page documents the tree format and what the browser computes. When a formula the current sort or filters use changes, the table loads its rows again. Formula columns now also stop or start sorting as soon as a `dataSource` is set or removed, without setting `columns` again. The plugin grows by 0.51 kB min+gzip.
