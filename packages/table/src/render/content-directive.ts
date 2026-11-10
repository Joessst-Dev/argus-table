import { nothing, type ChildPart } from 'lit';
import { AsyncDirective, directive, PartType, type PartInfo } from 'lit/async-directive.js';
import { toChild } from './content.js';
import type { CellContent } from '../types.js';

/**
 * Renders content the table doesn't render itself, such as React elements, Vue
 * VNodes or Angular templates, into a target element the table keeps. Set it as the
 * table's `contentRenderer`; the framework wrappers do.
 */
export interface ContentRenderer {
  /**
   * Renders `content` into `target`, or updates what is there. Called on every update
   * for each header and cell showing foreign content. A target is reused: when the
   * table scrolls, the same target shows other rows.
   */
  render(target: HTMLElement, content: unknown): void;
  /**
   * `target` shows no foreign content any more: its cell scrolled away and wasn't
   * reused, its row isn't loaded, its column left, or the table was disconnected.
   * Unmount what `render` put there.
   */
  release(target: HTMLElement): void;
  /**
   * Called once after each update in which `render` or `release` ran, before the
   * table measures content (`width: 'auto'`). Commit batched work here, synchronously.
   */
  flush?(): void;
}

/** What the directive reads from the table it renders into. */
interface ContentHost {
  readonly contentRenderer?: ContentRenderer | undefined;
}

/** Renderers that rendered or released since the last flush, per table. */
const dirty = new WeakMap<object, Set<ContentRenderer>>();
let warned = false;

function markDirty(host: object, renderer: ContentRenderer): void {
  let set = dirty.get(host);
  if (!set) dirty.set(host, (set = new Set()));
  set.add(renderer);
}

/** Calls `flush()` on the renderers that rendered or released for `host` since the last call. */
export function flushContent(host: object): void {
  const set = dirty.get(host);
  if (!set?.size) return;
  const renderers = [...set];
  set.clear();
  for (const renderer of renderers) renderer.flush?.();
}

/**
 * Whether the table renders `value` itself: strings, numbers, Lit templates and
 * directive results, DOM nodes, `nothing` and empty values, and arrays of those.
 * Anything else is foreign: it goes to the `contentRenderer`.
 */
export function isForeign(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(isForeign);
  if (value instanceof Node) return false;
  return !('_$litType$' in value) && !('_$litDirective$' in value);
}

/**
 * Header and cell content. Foreign content renders through the table's
 * `contentRenderer` into a target element kept while this part lives, so a pooled
 * cell updates its framework content in place as it shows other rows.
 */
class ContentDirective extends AsyncDirective {
  #target: HTMLElement | undefined;
  /** The renderer that rendered into the target, and the table it belongs to. */
  #renderer: ContentRenderer | undefined;
  #host: object | undefined;
  /** The last foreign content, rendered again on reconnect. */
  #content: unknown;

  constructor(part: PartInfo) {
    super(part);
    if (part.type !== PartType.CHILD) {
      throw new Error('argus-table: content() only works in child positions.');
    }
  }

  render(value: unknown): unknown {
    return isForeign(value) ? nothing : toChild(value as CellContent | null | undefined);
  }

  override update(part: ChildPart, [value]: [unknown]): unknown {
    if (!isForeign(value)) {
      this.#release();
      this.#content = undefined;
      return this.render(value);
    }
    const host = part.options?.host;
    const renderer = (host as ContentHost | undefined)?.contentRenderer;
    if (!host || !renderer) {
      this.#release();
      if (!warned) {
        warned = true;
        console.warn(
          'argus-table: a header or cell returned content the table can’t render (set contentRenderer, or use a framework wrapper).',
        );
      }
      return nothing;
    }
    if (renderer !== this.#renderer) this.#release();
    const target = (this.#target ??= targetElement());
    this.#renderer = renderer;
    this.#host = host;
    this.#content = value;
    renderer.render(target, value);
    markDirty(host, renderer);
    return target;
  }

  protected override disconnected(): void {
    const content = this.#content;
    this.#release();
    // Kept for reconnected(): the part is the same, and so is its content.
    this.#content = content;
  }

  protected override reconnected(): void {
    const host = this.#host;
    const renderer = (host as ContentHost | undefined)?.contentRenderer;
    if (!host || !renderer || this.#content === undefined || !this.#target) return;
    this.#renderer = renderer;
    renderer.render(this.#target, this.#content);
    markDirty(host, renderer);
  }

  #release(): void {
    const renderer = this.#renderer;
    const host = this.#host;
    if (!renderer || !host || !this.#target) return;
    this.#renderer = undefined;
    renderer.release(this.#target);
    markDirty(host, renderer);
  }
}

/** A target: invisible to layout, so the content lays out as the cell's own. */
function targetElement(): HTMLElement {
  const target = document.createElement('div');
  target.className = 'argus-content';
  target.style.display = 'contents';
  return target;
}

/**
 * Header or cell content for a template of your own. The table renders what
 * `header` and `cell` return through it already; a plugin that nests a column's
 * content in its own template (`html\`<b>${content(own)}</b>\``) wraps it, so
 * framework content (React elements, Vue VNodes) still reaches the
 * `contentRenderer`. Only in templates the table renders.
 */
export const content = directive(ContentDirective);
