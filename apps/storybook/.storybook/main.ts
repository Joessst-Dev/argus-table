import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  framework: '@storybook/web-components-vite',
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  // Storybook uses a static file served at /favicon.svg as the favicon.
  staticDirs: [{ from: '../../../brand/argus-table-icon.svg', to: '/favicon.svg' }],
  core: { disableTelemetry: true },
};

export default config;
