<p align="center">
  <img src="brand/argus-table-logo.svg" alt="Argus Table" width="240" height="240">
</p>

# Argus Table

A framework-agnostic data table web component built with Lit and TanStack: infinite scrolling, pinned columns and rows, resizable and auto-sized columns, and styling that is plain CSS, with optional themes.

Named after Argus Panoptes, the hundred-eyed giant of Greek myth who never slept: a table that keeps watch over every row.

> **Status:** v0.1, the MVP. It has virtualized rows, pinned columns, sorting, resizing, keyboard navigation and the default theme. Infinite loading, pinned rows, auto widths, column reordering and the framework wrappers come in v0.2 ([roadmap](docs/plan/plan/12-roadmap.md)).

**[Docs and live examples](https://joessst-dev.github.io/argus-table/)**

```bash
npm i argus-table @argus-table/themes
```

```js
import 'argus-table';
import '@argus-table/themes/default.css';

const table = document.querySelector('argus-table');
table.columns = [
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  { id: 'city', header: 'City', accessor: 'address.city' },
];
table.data = rows;
```

The full example is in the [package README](packages/table/README.md).

## Packages

| Package                                  | Purpose                                          | Status       |
| ---------------------------------------- | ------------------------------------------------ | ------------ |
| `argus-table`                            | The `<argus-table>` element                      | v0.1         |
| `@argus-table/themes`                    | Optional themes: `default.css` now; more planned | v0.1         |
| `@argus-table/react`, `/vue`, `/angular` | Typed framework wrappers                         | v0.2         |
| `@argus-table/formulas`                  | Optional formula columns                         | After launch |

## Project plan

Everything is in [`docs/plan`](docs/plan/README.md): vision, tech stack, rendering strategy, styling system, public API draft, roadmap, repo and CI setup, and code architecture with diagrams.

License: [MIT](LICENSE).
