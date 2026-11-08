<p align="center">
  <img src="brand/argus-table-logo.svg" alt="Argus Table" width="240" height="240">
</p>

# Argus Table

A framework-agnostic data table web component built with Lit and TanStack: infinite scrolling, pinned columns and rows, resizable, reorderable and auto-sized columns, and styling that is plain CSS, with optional themes.

Named after Argus Panoptes, the hundred-eyed giant of Greek myth who never slept: a table that keeps watch over every row.

> **Status:** v0.1 is on npm: virtualized rows, pinned columns, sorting, resizing, keyboard navigation and the default theme. On `main` for v0.2: infinite loading, pinned rows, auto widths, column reordering, `<argus-column>` children, the React, Vue and Angular wrappers and a Material-inspired theme ([roadmap](docs/plan/plan/12-roadmap.md)).

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

In React, `@argus-table/react` adds typed props and events ([README](packages/react/README.md)), in Vue `@argus-table/vue` adds them with `v-model` ([README](packages/vue/README.md)), and in Angular `@argus-table/angular` with two-way binding ([README](packages/angular/README.md)):

```tsx
import { ArgusTable } from '@argus-table/react';

<ArgusTable columns={columns} data={rows} onRowClick={(e) => open(e.detail.row)} />;
```

## Packages

| Package                 | Purpose                                          | Status       |
| ----------------------- | ------------------------------------------------ | ------------ |
| `argus-table`           | The `<argus-table>` element                      | v0.1         |
| `@argus-table/themes`   | Optional themes: default, Material-inspired      | v0.1         |
| `@argus-table/react`    | React components with typed props and events     | v0.2         |
| `@argus-table/vue`      | Vue components with typed props, events, v-model | v0.2         |
| `@argus-table/angular`  | Angular components with typed inputs and outputs | v0.2         |
| `@argus-table/formulas` | Optional formula columns                         | After launch |

## Project plan

Everything is in [`docs/plan`](docs/plan/README.md): vision, tech stack, rendering strategy, styling system, public API draft, roadmap, repo and CI setup, and code architecture with diagrams.

License: [MIT](LICENSE).
