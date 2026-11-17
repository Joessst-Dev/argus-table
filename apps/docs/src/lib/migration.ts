// The migration guides: the integrate skill's references/migrate/*.md and
// gaps.md, rendered on the site from the files as they are (rendered.ts). The
// skill reads them too, so they stay agent-first.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { firstTitle, type RenderedPage } from './rendered';

export { GITHUB_BLOB } from './rendered';

/** Where the references are, from the repo root. */
export const REFERENCES = 'skills/argus-table-integrate/references';

/** Pages the guides' ids mustn't take. */
const RESERVED = new Set(['index', 'gaps']);

/**
 * The guides by label, then the gaps page. A guide's title is its first line
 * (`From Vuetify v-data-table`); its label drops the `From `.
 */
export function migrationGuides(repoRoot: string): RenderedPage[] {
  const guides = readdirSync(join(repoRoot, REFERENCES, 'migrate'))
    .filter((name) => name.endsWith('.md'))
    .map((name): RenderedPage => {
      const file = `${REFERENCES}/migrate/${name}`;
      const id = name.slice(0, -'.md'.length);
      if (RESERVED.has(id)) throw new Error(`${file}: "${id}" is taken by another page.`);
      const title = firstTitle(repoRoot, file);
      const rest = title.replace(/^From /, '');
      const label = rest.charAt(0).toUpperCase() + rest.slice(1);
      return { id, title, label, file, path: `migration/${id}/` };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const gaps = `${REFERENCES}/gaps.md`;
  const title = firstTitle(repoRoot, gaps);
  return [...guides, { id: 'gaps', title, label: title, file: gaps, path: 'migration/gaps/' }];
}
