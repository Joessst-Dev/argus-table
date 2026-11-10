# Styling and theming

[← Back to contents](../README.md)

Styling works in three layers, from easiest to most powerful; a theme is just a stylesheet that uses them.

1. **CSS custom properties (tokens).** Pass through shadow DOM; cover colours, spacing, borders, typography, density. Prefixed `--argus-*`.
2. **`::part()` names with state.** Every structural element exposes parts, and state is part of the name: `part="cell cell-pinned cell-sorted"`. Needed because `::part(row) ::part(cell)` is not valid CSS.
3. **Light-DOM cell content.** Cell and header content is slotted in from light DOM (the Vaadin Grid pattern), so the host page's CSS, utility classes (Tailwind etc.) and its own components work inside cells.

## Rules

- Base styles live in `@layer argus-base` so any user rule wins without specificity tricks.
- No hard-coded colours in the component: every value reads a token with a neutral fallback.
- Dark mode via `light-dark()` and `color-scheme`; themes can also offer `[data-argus-theme="dark"]`.
- Density comes from the reflected `density` attribute (compact / comfortable / spacious). Each density sets its own defaults for the existing tokens `--argus-row-height` and `--argus-cell-padding-inline`. A theme redefines one density with an attribute selector, for example `argus-table[density="compact"] { --argus-row-height: 28px; }`. A token set without a density selector applies to every density. There is no `--argus-density` token: CSS can't switch styles on a keyword stored in a custom property without container style queries, which don't work everywhere yet and can't style the host itself.

## Theme packages

`@argus-table/themes`, one CSS file each.

| Theme | Launch | Notes |
| --- | --- | --- |
| Default (neutral) | v0.1 | Minimal, inherits font and colours from the page |
| Material-inspired | v0.2 (shipped) | Material 3 baseline colours, Roboto (loaded by the page), 40 / 52 / 60 px rows, a rounded outlined surface (`--argus-radius`, `--argus-outline`), deeper shadows on pinned edges |
| Fluent-inspired | v0.3 (shipped) | Fluent 2 neutral greys and brand blue, Segoe UI (falls back to the system font), a flat header on the body colour, 34 / 44 / 52 px rows, a brand-tinted selection and a black / white focus ring |
| Bootstrap-inspired | v0.3 (shipped) | Bootstrap 5 `.table.table-striped.table-hover`: its colours, system font stack, 0.5 rem padding (0.25 rem compact), stripes, hover and the 2 px divider under the header; selected rows use `.table-primary` |
| Minimal / social | v0.4 | Borderless, airy rows, timeline feel (instead of "Twitter style") |

Each theme is `@argus-table/themes/<name>.css`, built with Lightning CSS (nesting lowered, minified). A theme contains only token declarations and `::part()` rules on `argus-table`, plus `color-scheme` for `[data-argus-theme]`; a test in the package checks that every token and part it uses is documented on the element. Every theme supports `data-argus-theme="dark"` and `"light"` on the table or an ancestor; the attribute on the table wins.

Themes are named "-inspired" to avoid implying official endorsement. A theme playground in Storybook lets users tweak tokens live and copy the CSS.

See the theme [mockups](../mockups.md).
