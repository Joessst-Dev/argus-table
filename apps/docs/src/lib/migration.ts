// The migration guides: the integrate skill's references/migrate/*.md and
// gaps.md, rendered on the site from the files as they are. The skill reads
// them too, so they stay agent-first; the site drops their `# ` title (the page
// shows it) and rewrites their relative links. Runs at build time, in Node.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

/** Where the references are, from the repo root. */
export const REFERENCES = 'skills/argus-table-integrate/references';

/** Files the site doesn't render link here, on `main`. */
export const GITHUB_BLOB = 'https://github.com/Joessst-Dev/argus-table/blob/main/';

export interface Guide {
  /** The file's base name, and the page's: `tanstack`, `gaps`. */
  id: string;
  /** The file's first line, without `# ` and backticks: `From Vuetify v-data-table`. */
  title: string;
  /** The sidebar's: `Vuetify v-data-table`, `A plain <table>`. */
  label: string;
  /** From the repo root: `skills/argus-table-integrate/references/migrate/tanstack.md`. */
  file: string;
}

/** Pages the guides' ids mustn't take. */
const RESERVED = new Set(['index', 'gaps']);

function titleOf(repoRoot: string, file: string): string {
  const first = readFileSync(join(repoRoot, file), 'utf8').split('\n', 1)[0] ?? '';
  if (!first.startsWith('# ')) throw new Error(`${file} doesn't start with a "# " title.`);
  return first.slice(2).replaceAll('`', '').trim();
}

/** The guides by label, then the gaps page. */
export function migrationGuides(repoRoot: string): Guide[] {
  const guides = readdirSync(join(repoRoot, REFERENCES, 'migrate'))
    .filter((name) => name.endsWith('.md'))
    .map((name): Guide => {
      const file = `${REFERENCES}/migrate/${name}`;
      const id = name.slice(0, -'.md'.length);
      if (RESERVED.has(id)) throw new Error(`${file}: "${id}" is taken by another page.`);
      const title = titleOf(repoRoot, file);
      const rest = title.replace(/^From /, '');
      return { id, title, label: rest.charAt(0).toUpperCase() + rest.slice(1), file };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const gaps = `${REFERENCES}/gaps.md`;
  const title = titleOf(repoRoot, gaps);
  return [...guides, { id: 'gaps', title, label: title, file: gaps }];
}

/** `/argus-table/migration/tanstack/`. */
export const guidePath = (guide: Guide, base: string) => `${base}/migration/${guide.id}/`;

/**
 * A link in `from` (a repo path) as the site shows it: a rendered file's page,
 * else the file on GitHub, the anchor kept. URLs, absolute paths and anchors on
 * the same page stay as they are; a missing file throws.
 */
export function rewriteHref(
  href: string,
  from: string,
  context: { guides: readonly Guide[]; base: string; exists: (repoPath: string) => boolean },
): string {
  if (/^[a-z][a-z+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return href;
  const at = href.indexOf('#');
  const path = at === -1 ? href : href.slice(0, at);
  const hash = at === -1 ? '' : href.slice(at);
  const resolved = posix.normalize(posix.join(posix.dirname(from), path));
  if (!context.exists(resolved)) throw new Error(`${from} links to ${path}, which doesn't exist.`);
  const guide = context.guides.find((g) => g.file === resolved);
  return (guide ? guidePath(guide, context.base) : GITHUB_BLOB + resolved) + hash;
}

/** The parts of an mdast node the plugin reads. */
export interface MdNode {
  type: string;
  depth?: number;
  url?: string;
  children?: MdNode[];
}

function visit(node: MdNode, fn: (node: MdNode) => void) {
  fn(node);
  for (const child of node.children ?? []) visit(child, fn);
}

/**
 * A remark plugin for the guides: drops each one's `# ` title and rewrites its
 * links (`rewriteHref`). Other markdown passes through.
 */
export function remarkMigration(options: { repoRoot: string; base: string }) {
  const { repoRoot, base } = options;
  const guides = migrationGuides(repoRoot);
  const exists = (path: string) => existsSync(join(repoRoot, path));
  return (tree: MdNode, file: { path?: string }) => {
    if (!file.path) return;
    const from = relative(repoRoot, file.path).split(sep).join('/');
    if (!guides.some((g) => g.file === from)) return;
    const title = tree.children?.findIndex((n) => n.type === 'heading' && n.depth === 1) ?? -1;
    if (title !== -1) tree.children?.splice(title, 1);
    visit(tree, (node) => {
      if ((node.type === 'link' || node.type === 'definition') && node.url !== undefined) {
        node.url = rewriteHref(node.url, from, { guides, base, exists });
      }
    });
  };
}
