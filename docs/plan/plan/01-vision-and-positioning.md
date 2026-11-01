# Vision and positioning

[← Back to contents](../README.md)

An MIT-licensed, framework-agnostic data table web component that blends into any site's design out of the box. It is built on Lit and TanStack Table, ships optional themes, and is documented in Storybook.

**Name:** Argus Table, after Argus Panoptes, the hundred-eyed giant of Greek myth who never slept: a table that keeps watch over every row. On npm it ships as `argus-table` plus `@argus-table/*` for wrappers and themes; the elements are `<argus-table>` and `<argus-column>`.

**Who it is for:** frontend developers who need a fast table with fixed columns/rows and large datasets, and who refuse to fight a grid's built-in look.

## Existing alternatives and the gap

| Library | Built with | Strength | Where we differ |
| --- | --- | --- | --- |
| [RevoGrid](https://github.com/revolist/revogrid) | Stencil | Spreadsheet-like, pinned rows/cols, plugins, millions of cells | Grid-first look; some features in a Pro tier |
| [Ignite UI Grid Lite](https://www.infragistics.com/webcomponentssite/components/grid-lite/overview.html) | Web component (Infragistics) | MIT, Bootstrap/Material/Fluent themes | Vendor ecosystem; themes tied to their design system |
| TanStack Table (headless) | Framework adapters | Logic only, total control | No ready-made component; you build the UI yourself |

**Our pitch in one line:** TanStack-grade logic, a ready-made component, and styling that is plain CSS, so a custom theme takes minutes.
