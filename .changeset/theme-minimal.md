---
'@argus-table/themes': minor
---

A new theme, `@argus-table/themes/minimal.css`: a quiet, airy table that reads like a timeline. Header and body share one surface, there are no column lines, only faint hairlines between rows, column labels are small and uppercase, rows are 44 / 56 / 68px by density, and one amber accent marks focus, the sorted column, the resize handle and selected rows.

It uses Instrument Sans but loads no fonts: load it on the page, for example from `@fontsource/instrument-sans` (400, 500 and 600); without it the table uses the system font. Like the other themes, it follows the system's light or dark setting, and `data-argus-theme="dark"` or `"light"` on the table or an ancestor forces one.
