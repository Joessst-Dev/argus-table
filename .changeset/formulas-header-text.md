---
'@argus-table/formulas': minor
---

Formulas can name a column whose header is a template, JSX or a slot by its header's plain text (`header: ({ text }) => (text ? 'Unit price' : …)`), so `[Unit price]` works for it. Ids and text headers still come first, so existing formulas keep reading the same columns. The editor suggests that name where it leads to the column, and the `ƒx` header passes the column's text on to other plugins.
