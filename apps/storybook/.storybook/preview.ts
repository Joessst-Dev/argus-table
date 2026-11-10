import type { Decorator, Preview } from '@storybook/web-components-vite';
import { setCustomElementsManifest } from '@storybook/web-components';
import { html, nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';
import type { Density } from 'argus-table';
import manifest from 'argus-table/custom-elements.json';
// As strings, so the toolbar can switch the theme on and off.
import defaultTheme from '@argus-table/themes/default.css?inline';
import materialTheme from '@argus-table/themes/material.css?inline';
import fluentTheme from '@argus-table/themes/fluent.css?inline';
import bootstrapTheme from '@argus-table/themes/bootstrap.css?inline';
// The Material-inspired theme uses Roboto but loads no fonts itself.
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';

// Controls and API tables come from the manifest that `argus-table:build`
// writes, so the docs always match the element's JSDoc.
setCustomElementsManifest(manifest);

interface Globals {
  theme?: 'none' | 'default' | 'material' | 'fluent' | 'bootstrap';
  scheme?: 'auto' | 'light' | 'dark';
  density?: 'story' | Density;
  dir?: 'ltr' | 'rtl';
}

/**
 * The toolbar: theme, colour scheme, density and direction for every story.
 * `density` set to anything but "As in the story" overrides each table's own.
 */
const withToolbar: Decorator = (story, { globals }) => {
  const { theme = 'none', scheme = 'auto', density = 'story', dir = 'ltr' } = globals as Globals;
  const applyDensity = (el?: Element) => {
    if (!el || density === 'story') return;
    // After the story's own template has set its properties.
    queueMicrotask(() => {
      for (const table of el.querySelectorAll('argus-table')) table.density = density;
    });
  };
  const themeCss = {
    none: undefined,
    default: defaultTheme,
    material: materialTheme,
    fluent: fluentTheme,
    bootstrap: bootstrapTheme,
  }[theme];
  return html`${
      themeCss
        ? html`<style>
            ${themeCss}
          </style>`
        : nothing
    }
    <div
      class="argus-story"
      dir=${dir}
      data-argus-theme=${scheme === 'auto' ? nothing : scheme}
      style="color-scheme: ${
        scheme === 'auto' ? 'light dark' : scheme
      }; background: Canvas; color: CanvasText; font: 14px/1.4 system-ui, sans-serif"
      ${ref(applyDensity)}
    >
      ${story()}
    </div>`;
};

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [withToolbar],
  globalTypes: {
    theme: {
      description: 'Theme stylesheet',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'none', title: 'No theme (base styles)' },
          { value: 'default', title: 'Default' },
          { value: 'material', title: 'Material-inspired' },
          { value: 'fluent', title: 'Fluent-inspired' },
          { value: 'bootstrap', title: 'Bootstrap-inspired' },
        ],
        dynamicTitle: true,
      },
    },
    scheme: {
      description: 'Colour scheme (data-argus-theme)',
      toolbar: {
        title: 'Scheme',
        icon: 'contrast',
        items: [
          { value: 'auto', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Density of every table',
      toolbar: {
        title: 'Density',
        icon: 'grow',
        items: [
          { value: 'story', title: 'As in the story' },
          { value: 'compact', title: 'Compact' },
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'spacious', title: 'Spacious' },
        ],
        dynamicTitle: true,
      },
    },
    dir: {
      description: 'Text direction',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'Left to right' },
          { value: 'rtl', title: 'Right to left' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'default', scheme: 'auto', density: 'story', dir: 'ltr' },
  parameters: {
    controls: { expanded: true },
    // Axe runs on every story; a violation fails the story's test.
    a11y: { test: 'error' },
  },
};

export default preview;
