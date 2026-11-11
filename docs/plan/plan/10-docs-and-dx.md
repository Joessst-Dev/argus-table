# Docs and developer experience

[← Back to contents](../README.md)

Storybook is the main docs site; a manifest generated from the source keeps docs, types and editor hints in sync.

## Storybook setup

- [Storybook 10 with Web Components + Vite](https://storybook.js.org/docs/get-started/frameworks/web-components-vite); manifest loaded with `setCustomElementsManifest()` so controls and API tables are generated.
- Toolbar switches for theme, density, dark mode and RTL, applied through a global decorator.
- Story groups: Getting started · Features (one story per feature) · Styling (tokens, parts, slotted content) · Themes · Recipes (React, Vue, Angular, Tailwind) · API reference.
- Theme creator (Themes / Theme creator): start from a shipped theme, change seeds, tokens and part options, check contrast, and copy, download or share the CSS.
- Stories double as tests through the Storybook Vitest addon and the a11y addon.

## Beyond Storybook

- README with a 10-second GIF, install line and a 15-line example.
- StackBlitz starters for plain HTML, React and Vue.
- Benchmark page (Storybook "Benchmarks"): 10k / 100k / 1M rows, scroll frame times, load and sort time, memory (Chromium) and a reach-the-last-row check, run in CI on each release and published through a results PR (`benchmarks/published/`).
- Generated JSX types (React), Vue `GlobalComponents` types and VS Code `custom-data.json` from the manifest.
