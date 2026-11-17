import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * A table with `block-size: auto` is as tall as its rows, up to its
 * `max-block-size` (the scroller inherits it). Without a maximum it would be as
 * tall as every row and render them all, so it is capped at the window's height
 * instead (`--_auto-cap` on the scroller), with a warning.
 *
 * Such a table is recognized by its scroller: no maximum, nothing to scroll, and
 * exactly as tall as its content while the content is taller than the window.
 * An explicit height never looks like that (its scroller is taller than the
 * content, or scrolls). Once capped, the scroller scrolls, so the cap stays while
 * the host is as tall as the cap, has no maximum and its content is still taller.
 */
export class FitHeight implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #scroller: () => HTMLElement | null;
  #cap: number | undefined;
  #warned = false;
  /** The content and window heights last checked: only a change checks again. */
  #checked = '';

  constructor(host: ReactiveControllerHost & HTMLElement, scroller: () => HTMLElement | null) {
    this.#host = host;
    this.#scroller = scroller;
    host.addController(this);
  }

  hostConnected(): void {
    window.addEventListener('resize', this.#onResize);
  }

  hostDisconnected(): void {
    window.removeEventListener('resize', this.#onResize);
  }

  readonly #onResize = () => {
    this.#host.requestUpdate();
  };

  /** Checks the cap after an update. `contentPx`: the header, pinned rows and body. */
  check(contentPx: number): void {
    const scroller = this.#scroller();
    const view = window.innerHeight;
    const key = `${String(contentPx)}|${String(view)}`;
    if (!scroller || key === this.#checked) return;
    this.#checked = key;
    const unbounded = getComputedStyle(this.#host).maxBlockSize === 'none';
    let cap: number | undefined;
    if (this.#cap === undefined) {
      const fits = scroller.scrollHeight <= scroller.clientHeight + 1;
      const auto = Math.abs(scroller.clientHeight - contentPx) <= 1;
      if (unbounded && fits && auto && contentPx > view) cap = view;
    } else if (
      unbounded &&
      contentPx > view &&
      Math.abs(this.#host.getBoundingClientRect().height - this.#cap) <= 1
    ) {
      cap = view;
    }
    if (cap === this.#cap) return;
    this.#cap = cap;
    if (cap === undefined) {
      scroller.style.removeProperty('--_auto-cap');
    } else {
      scroller.style.setProperty('--_auto-cap', `${String(cap)}px`);
      if (!this.#warned) {
        this.#warned = true;
        console.warn(
          "argus-table: block-size is auto without a max-block-size; capped at the window's height.",
        );
      }
    }
    this.#host.requestUpdate();
  }
}
