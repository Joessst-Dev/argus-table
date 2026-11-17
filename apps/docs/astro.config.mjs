import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import angular from '@analogjs/astro-angular';
import { migrationGuides } from './src/lib/migration.ts';
import { packageGuides } from './src/lib/packages.ts';
import { renderedMarkdownIntegration } from './src/lib/rendered.ts';

// The docs site (docs/superpowers/specs/2026-11-16-docs-site-design.md). Each
// framework's integration sees only its own example files.
const base = '/argus-table';
// The API reference and the migration guides read the repo's files from here,
// wherever the build runs.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  site: 'https://joessst-dev.github.io',
  base,
  vite: {
    define: { __REPO_ROOT__: JSON.stringify(repoRoot) },
  },
  integrations: [
    starlight({
      title: 'argus-table',
      components: {
        Head: './src/components/Head.astro',
        PageTitle: './src/components/PageTitle.astro',
      },
      customCss: ['@argus-table/themes/default.css', './src/styles/site.css'],
      logo: { src: '../../brand/argus-table-logo.svg', replacesTitle: true },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Joessst-Dev/argus-table' },
      ],
      sidebar: [
        { label: 'Start here', items: [{ label: 'Introduction', link: '/' }] },
        { label: 'Features', items: [{ autogenerate: { directory: 'features' } }] },
        {
          label: 'Themes',
          items: [
            { label: 'Overview', link: '/themes/' },
            { label: 'Default', link: '/themes/default/' },
            { label: 'Material-inspired', link: '/themes/material/' },
            { label: 'Fluent-inspired', link: '/themes/fluent/' },
            { label: 'Bootstrap-inspired', link: '/themes/bootstrap/' },
            { label: 'Minimal', link: '/themes/minimal/' },
            { label: 'Theme creator', link: '/themes/creator/' },
          ],
        },
        {
          label: 'API reference',
          items: [
            { label: 'Overview', link: '/api/' },
            { label: '<argus-table>', link: '/api/argus-table/' },
            { label: '<argus-column>', link: '/api/argus-column/' },
            { label: '<argus-column-group>', link: '/api/argus-column-group/' },
            { label: 'Types', link: '/api/types/' },
          ],
        },
        {
          label: 'Migration',
          items: [
            { label: 'Overview', link: '/migration/' },
            ...migrationGuides(repoRoot).map((g) => ({
              label: g.label,
              link: `/migration/${g.id}/`,
            })),
          ],
        },
      ],
    }),
    // Repo Markdown shown as pages (the migration guides, the packages'
    // READMEs): drops their title, rewrites their links.
    renderedMarkdownIntegration({
      repoRoot,
      base,
      pages: [...migrationGuides(repoRoot), ...packageGuides(repoRoot)],
    }),
    react({ include: ['**/examples/**/react/**'] }),
    vue(),
    angular({ vite: { tsconfig: './tsconfig.angular.json' } }),
  ],
});
