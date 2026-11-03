# Argus Table

A framework-agnostic data table web component built with Lit and TanStack: infinite scrolling, pinned columns and rows, resizable and auto-sized columns, and styling that is plain CSS, with optional themes.

Named after Argus Panoptes, the hundred-eyed giant of Greek myth who never slept: a table that keeps watch over every row.

> **Status:** Phase 0. Repo, CI, docs and release pipeline are in place, and the rendering spike passed its gate: slotted light-DOM cells are as fast as shadow-only cells when row DOM is pooled ([ADR 0001](docs/adr/0001-shadow-vs-light-dom.md)). A real-Safari check is still due; Phase 1 (MVP) is next.

## Planned packages

| Package                                  | Purpose                                                  |
| ---------------------------------------- | -------------------------------------------------------- |
| `argus-table`                            | The `<argus-table>` and `<argus-column>` elements        |
| `@argus-table/themes`                    | Optional themes (default, Material-inspired, minimal, …) |
| `@argus-table/react`, `/vue`, `/angular` | Typed framework wrappers                                 |
| `@argus-table/formulas`                  | Optional formula columns (post-launch)                   |

## Project plan

Everything is in [`docs/plan`](docs/plan/README.md): vision, tech stack, rendering strategy, styling system, public API draft, roadmap, repo and CI setup, and code architecture with diagrams.

License: [MIT](LICENSE).
