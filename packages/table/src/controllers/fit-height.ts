import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * A table with `block-size: auto` is as tall as its rows, up to its
 * `max-block-size` (the scroller inherits it, through `--_auto-cap`'s fallback).
 * Without a maximum it would be as tall as every row and render them all, so it
 * is capped at the window's height instead (`--_auto-cap` on the scroller), with
 * a warning.
 *
 * Such a table is recognized by its scroller: no maximum, nothing to scroll, and
 * exactly as tall as its content while the content is taller than the window.
 * An explicit height never looks like that (its scroller is taller than the
 * content, or scrolls). Once capped, the scroller scrolls, so the cap stays while
 * the host is as tall as the cap, has no maximum and its content is still taller.
 *
 * A maximum in `%` is resolved against the host's container, which the scroller
 * can't inherit (it would be a share of the host): the scroller gets none, and
 * the host's own maximum applies.
 */
export class FitHeight implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #scroller: () => HTMLElement | null;
  /** What `--_auto-cap` holds: the window's height in px, `none`, or unset. */
  #cap: string | undefined;
  #warned = false;
  /** The content and window heights last checked: only a change checks again. */
  #checked = '';
  #listening = false;

  constructor(host: ReactiveControllerHost & HTMLElement, scroller: () => HTMLElement | null) {
    this.#host = host;
    this.#scroller = scroller;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.#listen(false);
  }

  /** Window resizes matter only to a table that is capped, or as tall as its content. */
  #listen(on: boolean): void {
    if (on === this.#listening) return;
    this.#listening = on;
    if (on) window.addEventListener('resize', this.#onResize);
    else window.removeEventListener('resize', this.#onResize);
  }

  readonly #onResize = () => {
    this.#checked = '';
    this.#host.requestUpdate();
  };

  /** Checks the cap after an update. `contentPx`: the header, pinned rows and body. */
  check(contentPx: number): void {
    const scroller = this.#scroller();
    // Not laid out (in a hidden tab, or a panel out of view): check once it is.
    if (!scroller || scroller.clientHeight === 0) return;
    const view = window.innerHeight;
    const key = `${String(contentPx)}|${String(view)}`;
    if (key === this.#checked) return;
    this.#checked = key;
    const max = getComputedStyle(this.#host).maxBlockSize;
    const fits = Math.abs(scroller.clientHeight - contentPx) <= 1;
    let cap: string | undefined;
    if (max.endsWith('%')) {
      cap = 'none';
    } else if (max === 'none' && contentPx > view) {
      const capped =
        this.#cap !== undefined &&
        this.#cap !== 'none' &&
        Math.abs(this.#host.getBoundingClientRect().height - parseFloat(this.#cap)) <= 1;
      const auto = fits && scroller.scrollHeight <= scroller.clientHeight + 1;
      if (capped || auto) cap = `${String(view)}px`;
    }
    this.#listen(cap !== undefined ? cap !== 'none' : fits);
    if (cap === this.#cap) return;
    this.#cap = cap;
    if (cap === undefined) {
      scroller.style.removeProperty('--_auto-cap');
    } else {
      scroller.style.setProperty('--_auto-cap', cap);
      if (cap !== 'none' && !this.#warned) {
        this.#warned = true;
        console.warn(
          "argus-table: block-size is auto without a max-block-size; capped at the window's height.",
        );
      }
    }
    this.#host.requestUpdate();
  }
}
