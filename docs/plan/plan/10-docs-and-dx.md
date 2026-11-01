# Docs and developer experience

[← Back to contents](../README.md)

Storybook is the main docs site; a manifest generated from the source keeps docs, types and editor hints in sync.

## Storybook setup

- [Storybook 10 with Web Components + Vite](https://storybook.js.org/docs/get-started/frameworks/web-components-vite); manifest loaded with `setCustomElementsManifest()` so controls and API tables are generated.
- Toolbar switches for theme, density, dark mode and RTL, applied through a global decorator.
- Story groups: Getting started · Features (one story per feature) · Styling (tokens, parts, slotted content) · Themes · Recipes (React, Vue, Angular, Tailwind) · API reference.
- Theme playground story: edit tokens live and copy the resulting CSS.
- Stories double as tests through the Storybook Vitest addon and the a11y addon.

## Beyond Storybook

- README with a 10-second GIF, install line and a 15-line example.
- StackBlitz starters for plain HTML, React and Vue.
- Benchmark page: 10k / 100k / 1M rows, measured scroll FPS and memory, run in CI and published with each release.
- Generated JSX types (React), Vue `GlobalComponents` types and VS Code `custom-data.json` from the manifest.
