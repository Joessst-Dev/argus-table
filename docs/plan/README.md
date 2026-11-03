# Argus Table: Project Plan

An MIT-licensed, framework-agnostic data table web component built with Lit and TanStack, styleable with plain CSS, with optional themes and Storybook docs.

Named after Argus Panoptes, the hundred-eyed giant of Greek myth who never slept: a table that keeps watch over every row.

- **npm:** `argus-table` (the element) plus `@argus-table/*` (wrappers, themes, formulas)
- **Elements:** `<argus-table>` and `<argus-column>`
- **Status:** Phase 0 gate passed ([ADR 0001](../adr/0001-shadow-vs-light-dom.md)); real-Safari absolute check pending; Phase 1 next
- **Live versions:** [Project plan (Claude doc)](https://claude.ai/artifact/EV7nT4ziNFQusMxxiydWFt) · [UI mockups (design canvas)](https://claude.ai/artifact/6tB5SCnXBD2szrqk2kmaWw)

Exported 1 November 2026. Diagrams are written in Mermaid, so they render directly on GitHub.

## Contents

### Plan

1. [Vision and positioning](plan/01-vision-and-positioning.md)
2. [Goals and non-goals for v1](plan/02-goals-and-non-goals.md)
3. [Tech stack decisions](plan/03-tech-stack.md)
4. [Architecture (packages)](plan/04-architecture.md)
5. [Rendering strategy](plan/05-rendering-strategy.md)
6. [Styling and theming](plan/06-styling-and-theming.md)
7. [Public API draft](plan/07-public-api.md)
8. [Accessibility and keyboard](plan/08-accessibility.md)
9. [Formula columns (post-launch)](plan/09-formula-columns.md)
10. [Docs and developer experience](plan/10-docs-and-dx.md)
11. [Quality gates and releases](plan/11-quality-and-release.md)
12. [Roadmap](plan/12-roadmap.md)
13. [Risks and open questions](plan/13-risks-and-open-questions.md)

### Repo and CI

1. [Repo layout](repo-and-ci/01-repo-layout.md)
2. [Packages](repo-and-ci/02-packages.md)
3. [GitHub Actions workflows](repo-and-ci/03-github-actions.md)
4. [Nx: task graph, affected and caching](repo-and-ci/04-nx-and-caching.md)
5. [Contribution and release pipeline](repo-and-ci/05-release-pipeline.md)
6. [Repo settings and governance](repo-and-ci/06-repo-settings.md)
7. [Local development commands](repo-and-ci/07-local-development.md)
8. [Setup checklist](repo-and-ci/08-setup-checklist.md)

### Code architecture

1. [Module map](code-architecture/01-module-map.md)
2. [Render cycle](code-architecture/02-render-cycle.md)
3. [Infinite loading](code-architecture/03-infinite-loading.md)
4. [State and events](code-architecture/04-state-and-events.md)
5. [Formula pipeline](code-architecture/05-formula-pipeline.md)
6. [Source layout](code-architecture/06-source-layout.md)

### Other

- [Mockups](mockups.md)
- [Sources](sources.md)
