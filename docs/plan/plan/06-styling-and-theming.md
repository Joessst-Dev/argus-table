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
- Density as one token (`--argus-density`: compact / comfortable / spacious) that scales row height and padding.

## Theme packages

`@argus-table/themes`, one CSS file each.

| Theme | Launch | Notes |
| --- | --- | --- |
| Default (neutral) | v0.1 | Minimal, inherits font and colours from the page |
| Material-inspired | v0.2 | Material 3 tokens, elevation on pinned edges |
| Fluent-inspired | v0.3 | Fluent 2 spacing and type ramp |
| Bootstrap-inspired | v0.3 | Matches Bootstrap 5 table styles |
| Minimal / social | v0.4 | Borderless, airy rows, timeline feel (instead of "Twitter style") |

Themes are named "-inspired" to avoid implying official endorsement. A theme playground in Storybook lets users tweak tokens live and copy the CSS.

See the theme [mockups](../mockups.md).
