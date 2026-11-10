# @argus-table/themes

Themes for [argus-table](https://www.npmjs.com/package/argus-table). Each theme is one CSS file that sets the table's `--argus-*` tokens and `::part()` rules, and nothing else.

```bash
npm i argus-table @argus-table/themes
```

```js
import 'argus-table';
import '@argus-table/themes/default.css';
```

Or with a `<link>`: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@argus-table/themes/dist/default.css">`.

Load one theme per page: `default.css`, `material.css`, `fluent.css` or `bootstrap.css`.

## Default

Neutral. It uses the page's font, follows the system's light or dark setting, and has one accent colour for focus, the sorted column's header and the resize handle.

- **Force a scheme:** put `data-argus-theme="dark"` or `data-argus-theme="light"` on the table or on any ancestor, such as `<html>`. The attribute on the table wins over one on an ancestor.
- **Change a value:** set the token after the theme, for example `argus-table { --argus-focus-ring: 2px solid teal; }`.
- **`light-dark()` in your own overrides:** declare `color-scheme: light dark` on `argus-table` in the same stylesheet. Build tools that polyfill `light-dark()` (such as Vite's Lightning CSS minifier) only switch colours where the stylesheet sets `color-scheme`.
- **Density:** the theme keeps the table's row heights and padding per `density`. Override one density with `argus-table[density='compact'] { --argus-row-height: 28px; }`.
- **Corners and outline:** the table is square with no outer border. Round it and draw one with `argus-table { --argus-radius: 8px; --argus-outline: 1px solid #e3e6ea; }`.

## Material-inspired

```js
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@argus-table/themes/material.css';
```

It borrows the feel of Material 3, not Google's exact spec: the baseline purple palette, Roboto, an outlined surface with 12px corners, a tinted header and deeper shadows on pinned columns.

- **Fonts:** the theme loads no fonts. Load Roboto 400 and 500 on the page, from [`@fontsource/roboto`](https://fontsource.org/fonts/roboto) as above or from Google Fonts. Without Roboto, the table uses the system font.
- **Rows:** taller than the table's defaults: 40, 52 and 60px for `compact`, `comfortable` (the default) and `spacious`, with 12, 16 and 20px of inline padding. A `row-height` set on the table still wins.
- **Scheme and overrides:** work the same as in the default theme. `data-argus-theme` on the table or an ancestor forces light or dark, and any token can be set after the theme.

## Fluent-inspired

```js
import '@argus-table/themes/fluent.css';
```

It borrows the feel of Fluent 2 on the web, not Microsoft's exact spec: neutral greys, one brand blue, Segoe UI, a flat header on the body colour and the sizes of Fluent's Table. Selected rows get a light brand tint, and the focus ring is black (white in dark mode), as in Fluent.

- **Fonts:** the theme loads no fonts. Segoe UI comes with Windows and isn't on npm; elsewhere the table uses the system font.
- **Rows:** 34, 44 and 52px for `compact`, `comfortable` (the default) and `spacious`, with 8, 12 and 16px of inline padding. A `row-height` set on the table still wins.
- **Scheme and overrides:** work the same as in the default theme.

## Bootstrap-inspired

```js
import '@argus-table/themes/bootstrap.css';
```

It looks like a Bootstrap 5 `.table.table-striped.table-hover`, without loading Bootstrap: its colours in light and dark, the system font stack, 0.5rem cell padding, striped rows, a hover colour and the 2px divider under the header. Selected rows use the `.table-primary` colour, which stands out from the stripes better than `.table-active`.

- **Fonts:** Bootstrap's system font stack; nothing to load.
- **Rows:** the table's own heights, which match Bootstrap's: 40px at `comfortable` (the default) and 32px at `compact`, like `.table-sm` with its 0.25rem padding.
- **No stripes:** `argus-table { --argus-row-stripe-bg: var(--argus-bg); }` after the theme.
- **Scheme and overrides:** work the same as in the default theme.

The full list of tokens and parts is in the argus-table docs.

MIT licensed.
