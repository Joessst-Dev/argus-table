// What setup.mjs prints per framework: imports, where the theme goes, and
// the first steps. The full examples live in references/frameworks/*.md.

/** Import lines for the table, per framework. */
export const IMPORTS = {
  react: ["import { ArgusTable, type ReactColumnDef } from '@argus-table/react';"],
  vue: ["import { ArgusTable, type ColumnDef } from '@argus-table/vue';"],
  angular: ["import { ARGUS_TABLE, type ColumnDef } from '@argus-table/angular';"],
  vanilla: [
    "import 'argus-table';",
    "import type { ColumnDef } from 'argus-table'; // TypeScript only",
  ],
};

/** Import lines for add-ons, by package. */
export const ADDON_IMPORTS = {
  '@argus-table/header-menu': "import { headerMenu } from '@argus-table/header-menu';",
  '@argus-table/formulas': "import { formulas } from '@argus-table/formulas';",
  '@argus-table/export': "import { downloadTable, tableExport } from '@argus-table/export';",
};

/** How the theme is loaded, by where it goes. */
export function themeStatement(theme, file) {
  const path = `@argus-table/themes/${theme}.css`;
  if (/\.(?:css|scss|sass|less)$/.test(file)) return `@import '${path}';`;
  if (/nuxt\.config\.[cm]?[jt]s$/.test(file)) return `css: ['${path}'] (in defineNuxtConfig)`;
  if (/angular\.json$/.test(file)) return `"styles": ["${path}", …]`;
  if (/\.html$/.test(file))
    return `<link rel="stylesheet" href="/node_modules/${path}" /> (or import it from your entry script)`;
  return `import '${path}';`;
}

/** First steps after installing, per framework (one line each). */
export const SETUP = {
  react: [
    'Render <ArgusTable aria-label="…" columns={columns} data={rows} getRowId={…} />; give it a height (400px by default).',
    'Define columns, plugins and getRowId at module scope or in useMemo: a new array re-reads and re-sorts every row.',
    'Cells and headers may return JSX: it renders through portals, so it sees your providers.',
    'Controlled state: pass sorting/selection/… together with its on…Change handler, or leave both out.',
  ],
  vue: [
    'Render <ArgusTable aria-label="…" :columns="columns" :data="rows" :get-row-id="…" />; give it a height (400px by default).',
    'Declare columns and plugins once in <script setup> (not inline in the template); hold big row arrays in shallowRef.',
    'Cells: a #cell-<column id> slot, or a cell function returning VNodes.',
    'Two-way state: v-model:sorting, v-model:selection, …',
  ],
  angular: [
    'Add ARGUS_TABLE to the component\'s imports (no CUSTOM_ELEMENTS_SCHEMA), then <argus-table aria-label="…" [columns]="columns" [data]="rows" [getRowId]="…" />.',
    'Columns and plugins as readonly class fields; hold changing state in signals.',
    'Cells: <ng-template argusCell="<column id>" [argusCellOf]="rows" let-row>…</ng-template>.',
    'Two-way state: [(sorting)], [(selection)], …',
  ],
  vanilla: [
    'Put <argus-table aria-label="…"></argus-table> in the page; give it a height (400px by default).',
    'Set columns, data, getRowId and plugins as properties from JavaScript: table.columns = […].',
    "Listen to argus-* events: table.addEventListener('argus-row-click', (e) => …).",
  ],
};

/** Notes for meta-frameworks and SSR. */
export function metaNotes(framework) {
  const notes = [];
  const meta = framework.meta?.name;
  if (meta === 'next' && framework.meta.rsc) {
    notes.push(
      "Next.js App Router: @argus-table/react is a client module already. A Server Component may render <ArgusTable> only with serializable props (columns without functions, data); anything with functions (cell, accessor functions, getRowId, on… handlers, plugins, dataSource) goes into a 'use client' component.",
      'The table renders on the client: on the server it is an empty <argus-table> of its height.',
    );
  } else if (meta === 'next') {
    notes.push(
      'Next.js Pages Router: the table renders on the client; on the server it is an empty <argus-table>.',
    );
  } else if (meta === 'nuxt') {
    notes.push(
      'Nuxt: wrap the table in <ClientOnly> (custom elements register in the browser), and add the theme to nuxt.config css.',
    );
  } else if (meta === 'remix' || meta === 'react-router') {
    notes.push(
      'Remix / React Router: the table renders on the client; on the server it is an empty <argus-table>. Import the theme CSS in app/root.',
    );
  } else if (meta === 'angular-ssr' || meta === 'analog') {
    notes.push(
      'Angular SSR: render the table in the browser only, with @defer (on viewport) or an isPlatformBrowser check.',
    );
  } else if (meta === 'sveltekit' || meta === 'astro') {
    notes.push(
      `${meta === 'astro' ? 'Astro' : 'SvelteKit'}: register the element in the browser only (import 'argus-table' in onMount, or a client:only island).`,
    );
  }
  if (framework.name === 'svelte' || framework.name === 'solid') {
    notes.push(
      `${framework.name === 'svelte' ? 'Svelte' : 'Solid'} has no wrapper: use the element and set objects as properties (Svelte sets props on custom elements as properties; in Solid use prop:columns={…}).`,
    );
  }
  return notes;
}

/** The CDN tags for a page without a bundler. */
export function cdnTags(version, theme, addons) {
  const at = version ? `@${version}` : '';
  const lines = [
    `<script type="module" src="https://cdn.jsdelivr.net/npm/argus-table${at}/dist/cdn/argus-table.js"></script>`,
  ];
  if (theme !== 'none')
    lines.push(
      `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@argus-table/themes${at}/dist/${theme}.css" />`,
    );
  for (const addon of addons) {
    const name = addon.replace('@argus-table/', '');
    const factory = { 'header-menu': 'headerMenu', formulas: 'formulas', export: 'tableExport' }[
      name
    ];
    lines.push(
      `<script type="module">import { ${factory} } from 'https://cdn.jsdelivr.net/npm/${addon}${at}/+esm'; /* table.plugins = [${factory}()] */</script>`,
    );
  }
  return lines;
}
