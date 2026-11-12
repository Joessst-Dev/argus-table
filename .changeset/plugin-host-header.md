---
'argus-table': minor
'@argus-table/header-menu': patch
'@argus-table/formulas': patch
---

New plugin host member `header(def)`. It returns a column's or column group's own header as the table shows it, ready to nest in a plugin's template: ``html`<b>${host.header(def)}</b>` ``.

- It calls a function `header`, and a group without a header shows its id.
- It wraps the result like `content()`, so React and Vue content still renders.
- Since plugin hooks see content as `unknown`, this replaces the `(def.header as () => unknown)()` assertion that nesting a header used to need.

The column menu and formula columns now use it.
