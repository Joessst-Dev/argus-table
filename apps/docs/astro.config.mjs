import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import angular from '@analogjs/astro-angular';

// The docs site (docs/superpowers/specs/2026-11-16-docs-site-design.md). Each
// framework's integration sees only its own example files.
export default defineConfig({
  site: 'https://joessst-dev.github.io',
  base: '/argus-table',
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
          label: 'API reference',
          items: [
            { label: 'Overview', link: '/api/' },
            { label: '<argus-table>', link: '/api/argus-table/' },
            { label: '<argus-column>', link: '/api/argus-column/' },
            { label: '<argus-column-group>', link: '/api/argus-column-group/' },
            { label: 'Types', link: '/api/types/' },
          ],
        },
      ],
    }),
    react({ include: ['**/examples/**/react/**'] }),
    vue(),
    angular({ vite: { tsconfig: './tsconfig.angular.json' } }),
  ],
});
