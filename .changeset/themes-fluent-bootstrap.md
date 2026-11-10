---
'@argus-table/themes': minor
---

Two new themes, each a CSS file like the others: load one theme per page.

- `@argus-table/themes/fluent.css`, Fluent-inspired: Fluent 2's neutral greys and brand blue, Segoe UI (the system font where it isn't installed; the theme loads no fonts), a flat header on the body colour, 34 / 44 / 52px rows by density, a brand-tinted selection and Fluent's black (white in dark mode) focus ring.
- `@argus-table/themes/bootstrap.css`, Bootstrap-inspired: looks like a Bootstrap 5 `.table.table-striped.table-hover` without loading Bootstrap, with its colours, system font stack, padding (`.table-sm`'s at `compact`), striped rows, hover colour and the 2px divider under the header. Turn the stripes off with `argus-table { --argus-row-stripe-bg: var(--argus-bg); }`.

Both follow the system's light or dark setting, and `data-argus-theme="dark"` or `"light"` on the table or an ancestor forces one. Both colour the selection checkboxes with their accent.
