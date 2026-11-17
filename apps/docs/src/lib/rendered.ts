// Repo Markdown rendered on the site as it is: the integrate skill's migration
// guides (migration.ts) and the packages' READMEs (packages.ts). Each stays one
// source with what reads it elsewhere (the skill, npm). Astro's Markdown
// processor (Sätteri) renders them through a content collection; these plugins
// drop each file's `# ` title (the page shows it) and rewrite its relative
// links. (A table that scrolls gets its tab stop from Head.astro, as every
// Markdown table on the site does.) Runs at build time, in Node.
import { existsSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files the site doesn't render link here, on `main`. */
export const GITHUB_BLOB = 'https://github.com/Joessst-Dev/argus-table/blob/main/';

/** A repo Markdown file the site renders as a page. */
export interface RenderedPage {
  /** The page's id: `tanstack`, `export`. */
  id: string;
  /** The page's title: `From TanStack Table`, `Export add-on`. */
  title: string;
  /** The sidebar's: `TanStack Table`, `Export`. */
  label: string;
  /** From the repo root: `packages/export/README.md`. */
  file: string;
  /** The site path, without the base: `migration/tanstack/`, `guides/export/`. */
  path: string;
}

/** `/argus-table/guides/export/`. */
export const pagePath = (page: RenderedPage, base: string) => `${base}/${page.path}`;

/** A file's first line, without `# ` and backticks; throws, naming it, without one. */
export function firstTitle(repoRoot: string, file: string): string {
  const path = join(repoRoot, file);
  if (!existsSync(path)) throw new Error(`${file} doesn't exist.`);
  const first = readFileSync(path, 'utf8').split('\n', 1)[0] ?? '';
  if (!first.startsWith('# ')) throw new Error(`${file} doesn't start with a "# " title.`);
  return first.slice(2).replaceAll('`', '').trim();
}

/**
 * A link in `from` (a repo path) as the site shows it: a rendered file's page,
 * else the file on GitHub, the anchor kept. URLs, absolute paths and anchors on
 * the same page stay as they are; a missing file throws.
 */
export function rewriteHref(
  href: string,
  from: string,
  context: { pages: readonly RenderedPage[]; base: string; exists: (repoPath: string) => boolean },
): string {
  if (/^[a-z][a-z+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return href;
  const at = href.indexOf('#');
  const path = at === -1 ? href : href.slice(0, at);
  const hash = at === -1 ? '' : href.slice(at);
  const resolved = posix.normalize(posix.join(posix.dirname(from), path));
  if (!context.exists(resolved)) throw new Error(`${from} links to ${path}, which doesn't exist.`);
  const page = context.pages.find((p) => p.file === resolved);
  return (page ? pagePath(page, context.base) : GITHUB_BLOB + resolved) + hash;
}

/** The parts of an mdast node the plugin reads. */
export interface MdNode {
  type: string;
  depth?: number;
  url?: string;
}

/** The parts of Sätteri's mdast visitor context the plugin uses. */
export interface MdContext {
  removeNode(node: MdNode): void;
  setField(node: MdNode, key: 'url', value: string): void;
}

/** A Sätteri mdast plugin, as far as this one goes. */
export interface MdPlugin {
  name: string;
  heading(node: MdNode, ctx: MdContext): void;
  link(node: MdNode, ctx: MdContext): void;
  definition(node: MdNode, ctx: MdContext): void;
}

/** What Sätteri tells a plugin factory about the document. */
interface Document {
  fileURL: URL | undefined;
}

export interface RenderedOptions {
  repoRoot: string;
  base: string;
  pages: readonly RenderedPage[];
}

/** The site's own Markdown and MDX; everything else it renders must be a page. */
const SITE = 'apps/docs/';

/**
 * The page `fileURL` is, as a repo path, if it is one. Markdown from outside
 * the site that is no page throws: the plugins would otherwise pass it through
 * with its links unrewritten (a new collection, or a checkout path `repoRoot`
 * doesn't match).
 */
function pageFile(repoRoot: string, pages: readonly RenderedPage[], fileURL: URL | undefined) {
  if (!fileURL) return undefined;
  const from = relative(repoRoot, fileURLToPath(fileURL)).split(sep).join('/');
  if (pages.some((p) => p.file === from)) return from;
  if (from.startsWith(SITE)) return undefined;
  throw new Error(
    `${from} is rendered on the site but is no page the site knows (src/lib/rendered.ts).`,
  );
}

/**
 * The Sätteri plugin factory for the rendered pages (Astro 7's Markdown
 * processor calls it once per document): `mdast` drops a page's `# ` title and
 * rewrites its links (`rewriteHref`). For the site's own
 * documents they return nothing, so those pass through.
 */
export function renderedPlugins({ repoRoot, base, pages }: RenderedOptions) {
  const exists = (path: string) => existsSync(join(repoRoot, path));
  const mdast = ({ fileURL }: Document): MdPlugin | undefined => {
    const from = pageFile(repoRoot, pages, fileURL);
    if (!from) return undefined;
    let titled = false;
    const rewrite = (node: MdNode, ctx: MdContext) => {
      if (node.url !== undefined) {
        ctx.setField(node, 'url', rewriteHref(node.url, from, { pages, base, exists }));
      }
    };
    return {
      name: 'argus-rendered-pages',
      heading(node, ctx) {
        // The first line's title; the page shows it.
        if (node.depth !== 1 || titled) return;
        titled = true;
        ctx.removeNode(node);
      },
      link: rewrite,
      definition: rewrite,
    };
  };
  return { mdast };
}

/**
 * The Astro integration that adds `renderedPlugins` to the Markdown processor,
 * as Starlight adds its own plugins.
 */
export function renderedMarkdownIntegration(options: RenderedOptions) {
  return {
    name: 'argus-rendered-pages',
    hooks: {
      'astro:config:setup': ({ config }: { config: { markdown: { processor?: unknown } } }) => {
        const processor = config.markdown.processor as
          { options?: { mdastPlugins?: unknown[] } } | undefined;
        const mdastPlugins = processor?.options?.mdastPlugins;
        if (!Array.isArray(mdastPlugins)) {
          throw new Error('The rendered pages need the Sätteri Markdown processor (mdastPlugins).');
        }
        mdastPlugins.push(renderedPlugins(options).mdast);
      },
    },
  };
}
