/**
 * The tallest element the engine renders, measured once per page.
 *
 * Chromium and WebKit clamp a taller element at about 33.5M px (fewer CSS px
 * when the page is zoomed in), and Firefox drops anything over about 17.9M px
 * to 0. A hidden probe tries a few heights and keeps the first that renders at
 * full size. A zoom change (a new `devicePixelRatio` on resize) measures again
 * and tells the tables, so a scaled body stays within the new limit.
 */
const HEIGHTS = [32_000_000, 16_000_000, 8_000_000, 4_000_000, 2_000_000];

/** Content below this never needs the probe: every engine renders it. */
const SAFE_HEIGHT = 2_000_000;
/** Room left for the scrollbar and rounding. */
const MARGIN = 1000;

let measured: number | undefined;
let forced: number | undefined;
let dpr = 0;
const listeners = new Set<() => void>();

function onResize() {
  if (window.devicePixelRatio === dpr) return;
  dpr = window.devicePixelRatio;
  measured = undefined;
  for (const listener of listeners) listener();
}

/** The tallest element height in px the engine renders. */
function maxElementHeight(): number {
  if (forced !== undefined) return forced;
  if (measured !== undefined) return measured;
  // Fixed, so the probe never makes the page scroll.
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:1px;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  measured =
    HEIGHTS.find((height) => {
      probe.style.blockSize = `${String(height)}px`;
      return probe.offsetHeight >= height - 1;
    }) ?? SAFE_HEIGHT;
  probe.remove();
  return measured;
}

/**
 * The tallest the body may render: the engine's maximum less what scrolls with
 * it (`extra`: the header and pinned rows). `Infinity` for a body of `logical`
 * px that is far from any limit, without measuring.
 */
export function bodyCap(logical: number, extra: number): number {
  if (forced === undefined && logical + extra < SAFE_HEIGHT) return Infinity;
  return Math.max(maxElementHeight() - extra - MARGIN, 0);
}

/** Calls `listener` when the maximum may have changed (the page was zoomed). Returns the unsubscribe. */
export function watchMaxElementHeight(listener: () => void): () => void {
  if (listeners.size === 0) {
    dpr = window.devicePixelRatio;
    window.addEventListener('resize', onResize, { passive: true });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('resize', onResize);
  };
}

/** Tests: pretend the engine renders at most `height` px (`undefined` measures again). */
export function setMaxElementHeightForTests(height: number | undefined): void {
  forced = height;
}
