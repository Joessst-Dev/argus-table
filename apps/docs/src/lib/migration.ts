// The migration guides: the integrate skill's references/migrate/*.md and
// gaps.md, rendered on the site from the files as they are. The skill reads
// them too, so they stay agent-first; the site drops their `# ` title (the page
// shows it) and rewrites their relative links, through a plugin for Astro 7's
// Markdown processor (Sätteri). Runs at build time, in Node.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  meta?: string | null;
}

/** The parts of Sätteri's mdast visitor context the plugin uses. */
export interface MdContext {
  removeNode(node: MdNode): void;
  setField(node: MdNode, key: 'url' | 'meta', value: string): void;
}

/** A Sätteri mdast plugin, as far as this one goes. */
export interface MdPlugin {
  name: string;
  heading(node: MdNode, ctx: MdContext): void;
  link(node: MdNode, ctx: MdContext): void;
  definition(node: MdNode, ctx: MdContext): void;
  code(node: MdNode, ctx: MdContext): void;
}

/** The parts of Sätteri's hast visitor context the plugin uses. */
export interface HastContext {
  setProperty(node: object, key: string, value: unknown): void;
}

/** A Sätteri hast plugin, as far as this one goes. */
export interface HastPlugin {
  name: string;
  element: { filter: string[]; visit(node: object, ctx: HastContext): void };
}

/** What Sätteri tells a plugin factory about the document. */
interface Document {
  fileURL: URL | undefined;
}

interface Options {
  repoRoot: string;
  base: string;
}

/**
 * The guide `fileURL` is, as a repo path, if it is one. A file in the
 * references that is no guide throws: the plugins would otherwise pass it
 * through untouched (a checkout path `repoRoot` doesn't match, say).
 */
function guideFile(repoRoot: string, guides: readonly Guide[], fileURL: URL | undefined) {
  if (!fileURL) return undefined;
  const path = fileURLToPath(fileURL).split(sep).join('/');
  const from = relative(repoRoot, fileURLToPath(fileURL)).split(sep).join('/');
  if (guides.some((g) => g.file === from)) return from;
  if (path.includes(`/${REFERENCES}/`)) {
    throw new Error(
      `${path} is in the integrate skill's references but isn't a guide under ${repoRoot}.`,
    );
  }
  return undefined;
}

/**
 * Sätteri plugin factories for the guides (Astro 7's Markdown processor calls
 * them once per document). `mdast` drops a guide's `# ` title and rewrites its
 * links (`rewriteHref`), and wraps its code blocks' long lines (Expressive
 * Code's `wrap`, as the feature pages' code); `hast` makes its tables
 * focusable: they scroll sideways, so keyboard users need to reach them. For other documents they
 * return nothing, so those pass through.
 */
export function migrationPlugins({ repoRoot, base }: Options) {
  const guides = migrationGuides(repoRoot);
  const exists = (path: string) => existsSync(join(repoRoot, path));
  const mdast = ({ fileURL }: Document): MdPlugin | undefined => {
    const from = guideFile(repoRoot, guides, fileURL);
    if (!from) return undefined;
    let titled = false;
    const rewrite = (node: MdNode, ctx: MdContext) => {
      if (node.url !== undefined) {
        ctx.setField(node, 'url', rewriteHref(node.url, from, { guides, base, exists }));
      }
    };
    return {
      name: 'argus-migration-guides',
      heading(node, ctx) {
        // The first line's title; the page shows it.
        if (node.depth !== 1 || titled) return;
        titled = true;
        ctx.removeNode(node);
      },
      link: rewrite,
      definition: rewrite,
      code(node, ctx) {
        ctx.setField(node, 'meta', node.meta ? `${node.meta} wrap` : 'wrap');
      },
    };
  };
  const hast = ({ fileURL }: Document): HastPlugin | undefined =>
    guideFile(repoRoot, guides, fileURL)
      ? {
          name: 'argus-migration-tables',
          element: {
            filter: ['table'],
            visit(node, ctx) {
              ctx.setProperty(node, 'tabIndex', 0);
            },
          },
        }
      : undefined;
  return { mdast, hast };
}

/**
 * The Astro integration that adds `migrationPlugins` to the Markdown processor,
 * as Starlight adds its own plugins.
 */
export function migrationGuidesIntegration(options: Options) {
  return {
    name: 'argus-migration-guides',
    hooks: {
      'astro:config:setup': ({ config }: { config: { markdown: { processor?: unknown } } }) => {
        const processor = config.markdown.processor as
          { options?: { mdastPlugins?: unknown[]; hastPlugins?: unknown[] } } | undefined;
        const mdastPlugins = processor?.options?.mdastPlugins;
        const hastPlugins = processor?.options?.hastPlugins;
        if (!Array.isArray(mdastPlugins) || !Array.isArray(hastPlugins)) {
          throw new Error(
            'The migration guides need the Sätteri Markdown processor (mdastPlugins).',
          );
        }
        const { mdast, hast } = migrationPlugins(options);
        mdastPlugins.push(mdast);
        hastPlugins.push(hast);
      },
    },
  };
}
