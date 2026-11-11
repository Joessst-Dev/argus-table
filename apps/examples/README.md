# Starters

Small apps with one `<argus-table>` each: 10,000 orders, a search box, the column menu (sort, filter, pin, hide), row selection with checkboxes, a pinned column and a status cell rendered by the framework. Fork one to try the table, or to reproduce a bug for an issue.

| Starter              | Stack                              | Open                                                                                                |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`html`](html)       | Plain JavaScript, Vite             | [StackBlitz](https://stackblitz.com/github/Joessst-Dev/argus-table/tree/main/apps/examples/html)    |
| [`react`](react)     | React 19, `@argus-table/react`     | [StackBlitz](https://stackblitz.com/github/Joessst-Dev/argus-table/tree/main/apps/examples/react)   |
| [`vue`](vue)         | Vue 3.5, `@argus-table/vue`        | [StackBlitz](https://stackblitz.com/github/Joessst-Dev/argus-table/tree/main/apps/examples/vue)     |
| [`angular`](angular) | Angular 22, `@argus-table/angular` | [StackBlitz](https://stackblitz.com/github/Joessst-Dev/argus-table/tree/main/apps/examples/angular) |

The starters install the published packages from npm, at the ranges in their `package.json`.

To run one locally, copy its folder anywhere and run `npm install` and `npm run dev`.

## In this repo

The starters sit outside the pnpm workspace (`apps/*` matches only this folder), so StackBlitz and `npm install` see ordinary apps. This folder is the `examples` Nx project that tests them:

```bash
pnpm nx run examples:smoke   # builds the packages, then the steps below
```

1. `scripts/prepare.mjs` packs `argus-table`, `@argus-table/themes`, `@argus-table/header-menu` and the three wrappers with `pnpm pack`, copies each starter to `.smoke/<name>`, points its dependencies at the tarballs, then runs `npm install` and `npm run build` (which typechecks).
2. `smoke.spec.ts` serves each build and checks it in Chromium: the rows render, a header click sorts, the search box filters, the column menu hides a column, row clicks and checkboxes select rows, and the console stays clean.

The Angular CLI needs Node 22.22.3 or newer.

The dependency ranges follow the packages' versions: `pnpm version-packages` runs `scripts/sync-versions.mjs` after `changeset version`, and `lint` fails if they drift. The four starters share their data generator (`html/data.js`, `*/src/data.ts`): keep them in step, because the smoke test computes the expected rows from `html/data.js`.
