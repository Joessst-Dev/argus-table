import type { Preview } from '@storybook/web-components-vite';
import { setCustomElementsManifest } from '@storybook/web-components';
import manifest from 'argus-table/custom-elements.json';

// Controls and API tables come from the manifest that `argus-table:build`
// writes, so the docs always match the element's JSDoc.
setCustomElementsManifest(manifest);

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    controls: { expanded: true },
  },
};

export default preview;
