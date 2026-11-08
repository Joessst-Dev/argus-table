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

Load one theme per page: `default.css` or `material.css`.

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

The full list of tokens and parts is in the argus-table docs.

MIT licensed.
