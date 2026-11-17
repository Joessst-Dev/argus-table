import { html, render, type RootPart } from 'lit';
import type { RowDetailContext } from '@argus-table/core';
import type { CellContent } from '../types.js';
import { content } from './content-directive.js';

/** A panel's content, kept per row id while its panel is open. */
interface Holder {
  element: HTMLElement;
  part: RootPart | undefined;
}

/** A panel the body renders now: its row, the slot element it shows in, and what `rowDetail` gets. */
export interface RenderedPanel<T> {
  rowId: string;
  slotElement: HTMLElement;
  context: RowDetailContext<T>;
}

/**
 * The content of the detail panels (`rowDetail`). Each open panel renders into a
 * holder element of its own (one Lit root per row id), which is moved into the
 * slot element of the pool slot its panel row has now. A panel that scrolls out
 * of the window keeps its holder, detached and still connected, so a form keeps
 * what was typed and framework content stays mounted; it's put back when the
 * panel comes back. Moving a holder between slot elements that are already
 * slotted changes no slot assignment (WebKit's wheel scrolling isn't cancelled).
 * A holder is released (its framework content unmounted) when its panel closes,
 * its row can't show one any more, `rowDetail` goes away or the table disconnects.
 */
export class DetailContent<T> {
  readonly #host: HTMLElement;
  readonly #holders = new Map<string, Holder>();
  #connected = true;

  constructor(host: HTMLElement) {
    this.#host = host;
  }

  /**
   * Renders the panels in `rendered` (every update: like a cell, `detail` runs for
   * each panel in view) and releases the holders of rows not in `open`.
   */
  sync(
    detail: ((context: RowDetailContext<T>) => CellContent) | undefined,
    open: ReadonlySet<string>,
    rendered: readonly RenderedPanel<T>[],
  ): void {
    for (const [id, holder] of this.#holders) {
      if (!detail || !open.has(id)) this.#release(id, holder);
    }
    if (!detail) return;
    for (const { rowId, slotElement, context } of rendered) {
      let holder = this.#holders.get(rowId);
      if (!holder) {
        const element = document.createElement('div');
        element.className = 'argus-detail-content';
        holder = { element, part: undefined };
        this.#holders.set(rowId, holder);
      }
      holder.part = render(html`${content(detail(context))}`, holder.element, {
        host: this.#host,
      });
      if (!this.#connected) holder.part.setConnected(false);
      if (holder.element.parentElement !== slotElement) slotElement.replaceChildren(holder.element);
    }
  }

  /** Connects or disconnects every panel's content (framework content mounts and unmounts with it). */
  setConnected(connected: boolean): void {
    if (this.#connected === connected) return;
    this.#connected = connected;
    for (const { part } of this.#holders.values()) part?.setConnected(connected);
  }

  #release(id: string, holder: Holder): void {
    holder.part?.setConnected(false);
    holder.element.remove();
    this.#holders.delete(id);
  }
}
