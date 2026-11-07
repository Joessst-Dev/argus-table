import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** How long after the last sideways scroll pinned cells stay sticky. */
const SETTLE_MS = 150;

/**
 * Keeps pinned body cells in place without making them sticky while the table
 * only scrolls up and down.
 *
 * Safari gives every sticky element a compositing layer of its own and moves
 * each one on every scroll frame; with a sticky cell per pinned column per row
 * that is dozens of layers, and vertical scrolling stutters (ADR 0001, "Pinned
 * columns in Safari"). At rest, pinned body cells are plain cells shifted by the
 * horizontal scroll offset (`--_sx`, and `--_max-x` for the end side), which
 * only changes when the table scrolls sideways. While it does, the scroller
 * carries `data-hscroll` and the cells are sticky, so they don't lag behind
 * the scroll; once it settles they go back to the transform, at the same place.
 * It also sizes the pinned edges' shadow overlays (`.pin-shadow`) to the
 * scroller's visible area.
 */
export class PinScrollController implements ReactiveController {
  readonly #scroller: () => HTMLElement | null;
  #attached: HTMLElement | undefined;
  #left = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #resize: ResizeObserver | undefined;

  constructor(host: ReactiveControllerHost, scroller: () => HTMLElement | null) {
    this.#scroller = scroller;
    host.addController(this);
  }

  hostConnected(): void {
    // After a move in the DOM; before the first render there is no scroller yet.
    this.#attach();
  }

  hostUpdated(): void {
    this.#attach();
  }

  hostDisconnected(): void {
    this.#attached?.removeEventListener('scroll', this.#onScroll);
    this.#resize?.disconnect();
    clearTimeout(this.#timer);
    this.#attached = undefined;
  }

  /** Re-reads how far the table scrolls sideways: call when column widths change. */
  measure(): void {
    const s = this.#attached;
    if (!s) return;
    s.style.setProperty('--_max-x', `${String(Math.max(0, s.scrollWidth - s.clientWidth))}px`);
    // The edge shadows sit over the scroller, clear of its scrollbars.
    for (const shadow of s.parentNode?.querySelectorAll<HTMLElement>(':scope > .pin-shadow') ??
      []) {
      shadow.style.setProperty('--_view-h', `${String(s.clientHeight)}px`);
      shadow.style.setProperty('--_sb-x', `${String(s.offsetWidth - s.clientWidth)}px`);
    }
    this.#left = s.scrollLeft;
    s.style.setProperty('--_sx', `${String(this.#left)}px`);
  }

  #attach(): void {
    const s = this.#scroller();
    if (!s || s === this.#attached) return;
    this.#attached = s;
    s.addEventListener('scroll', this.#onScroll, { passive: true });
    this.#resize ??= new ResizeObserver(() => {
      this.measure();
    });
    this.#resize.observe(s);
    this.measure();
  }

  readonly #onScroll = () => {
    const s = this.#attached;
    if (!s || s.scrollLeft === this.#left) return;
    this.#left = s.scrollLeft;
    s.toggleAttribute('data-hscroll', true);
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.measure();
      s.removeAttribute('data-hscroll');
    }, SETTLE_MS);
  };
}
