import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  framework: '@storybook/web-components-vite',
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  staticDirs: [{ from: '../../../brand', to: '/brand' }],
  // The favicon link goes in the head: Storybook's own link uses the file's
  // name, not the path it is served at, so a renamed static file 404s in the build.
  managerHead: (head) =>
    `${head ?? ''}<link rel="icon" type="image/svg+xml" href="./brand/argus-table-icon.svg" />`,
  core: { disableTelemetry: true },
};

export default config;
