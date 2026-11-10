---
'argus-table': minor
---

Headers and cells can show content from a framework, such as React elements. A `header` or `cell` may now return content the table doesn't render itself; it goes to the table's new `contentRenderer` (`render(target, content)`, `release(target)`, `flush()`), which the framework wrappers set for you. Each cell keeps its target while the table scrolls, so the framework updates the content in place instead of remounting it, and the content is committed before the table measures `width: 'auto'` columns or the page paints.

- `ColumnDef` takes the content type as an optional second parameter (`ColumnDef<Row, MyContent>`), for wrappers and frameworks.
- Plugins that nest a column's header or cell in their own template wrap it with the new `host.content()` (also exported as `content()`), so framework content works there too.
