import { css } from 'lit';

/**
 * Base styles. Everything sits in `@layer argus-base`, and every value reads a
 * public token with a neutral fallback, so themes and page CSS always win.
 * `--_*` properties are private.
 */
export const baseStyles = css`
  @layer argus-base {
    :host {
      display: block;
      /* A table that virtualizes needs a bounded height; set your own on the element. */
      block-size: 400px;
      box-sizing: border-box;
      contain: content;
      color-scheme: light dark;
      color: var(--argus-fg, CanvasText);
      background: var(--argus-bg, Canvas);
      font: var(--argus-font, inherit);
      --_row-height: var(--argus-row-height, 40px);
      --_pad: var(--argus-cell-padding-inline, 12px);
      --_border: var(--argus-border-width, 1px) solid
        var(--argus-border-color, light-dark(#e5e7eb, #374151));
      /* 1 in LTR, -1 in RTL: mirrors the pinned-edge shadow. */
      --_dir: 1;
    }
    :host(:dir(rtl)) {
      --_dir: -1;
    }
    :host([density='compact']) {
      --_row-height: var(--argus-row-height, 32px);
      --_pad: var(--argus-cell-padding-inline, 8px);
    }
    :host([density='spacious']) {
      --_row-height: var(--argus-row-height, 52px);
      --_pad: var(--argus-cell-padding-inline, 16px);
    }
    :host([hidden]) {
      display: none;
    }

    [part~='table'] {
      position: relative;
      block-size: 100%;
      overflow: auto;
      overscroll-behavior: contain;
      /* A cell moved to by keyboard scrolls clear of the sticky header and pinned columns. */
      scroll-padding-block-start: var(--_row-height);
      scroll-padding-inline: var(--_pin-start, 0) var(--_pin-end, 0);
    }

    .row {
      display: grid;
      grid-template-columns: var(--_cols);
      inline-size: var(--_width);
      min-inline-size: 100%;
      block-size: var(--_row-height);
      box-sizing: border-box;
    }

    [part~='header'] {
      position: sticky;
      inset-block-start: 0;
      z-index: 2;
    }

    [part~='body'] {
      position: relative;
      contain: layout;
    }
    [part~='row'] {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: 0;
      --_row-bg: var(--argus-bg, Canvas);
      --_row-surface: var(--_row-bg);
      background: var(--_row-surface);
    }
    [part~='row-odd'] {
      --_row-bg: var(--argus-row-stripe-bg, var(--argus-bg, Canvas));
    }
    [part~='row']:hover {
      --_row-surface: var(--argus-row-hover-bg, var(--_row-bg));
    }

    [part~='cell'],
    [part~='header-cell'] {
      display: flex;
      align-items: center;
      min-inline-size: 0;
      box-sizing: border-box;
      padding-inline: var(--_pad);
      overflow: hidden;
      white-space: nowrap;
      border-block-end: var(--_border);
    }
    [part~='header-cell'] {
      background: var(--argus-header-bg, light-dark(#f9fafb, #111827));
      color: var(--argus-header-fg, inherit);
      font-weight: 600;
    }
    [part~='header-cell'] {
      position: relative;
    }
    [part~='resize-handle'] {
      position: absolute;
      inset-block: 0;
      inset-inline-end: 0;
      inline-size: 8px;
      z-index: 1;
      cursor: col-resize;
      touch-action: none;
    }
    [part~='resize-handle']::after {
      content: '';
      position: absolute;
      inset-block: 25%;
      inset-inline-end: 0;
      inline-size: 2px;
      background: var(--argus-resize-handle-color, light-dark(#9ca3af, #6b7280));
      opacity: 0;
    }
    [part~='header-cell']:hover [part~='resize-handle']::after,
    [part~='header-cell']:focus-visible [part~='resize-handle']::after,
    [part~='resize-handle'][data-active]::after {
      opacity: 1;
    }
    [data-sort-col] {
      cursor: pointer;
      user-select: none;
    }
    [part~='header-cell']:focus-visible,
    [part~='cell']:focus-visible {
      outline: var(--argus-focus-ring, 2px solid Highlight);
      outline-offset: -2px;
    }
    /* A small chevron after the header content; only the sorted column shows it. */
    .sort-indicator {
      flex: none;
      inline-size: 0.35em;
      block-size: 0.35em;
      margin-inline-start: 0.4em;
      /* Physical sides on purpose: the chevron is rotated, so it must not mirror in RTL. */
      border-right: 0.12em solid currentColor;
      border-bottom: 0.12em solid currentColor;
      visibility: hidden;
    }
    [aria-sort] .sort-indicator {
      visibility: visible;
    }
    [aria-sort='ascending'] .sort-indicator {
      transform: translateY(0.1em) rotate(-135deg);
    }
    [aria-sort='descending'] .sort-indicator {
      transform: translateY(-0.1em) rotate(45deg);
    }
    [data-align='end'] .sort-indicator {
      order: -1;
      margin-inline: 0 0.4em;
    }
    /*
     * Pinned columns: sticky inside the scroll container, with offsets from the
     * table model. Logical insets make RTL work without extra rules.
     */
    [data-pin] {
      position: sticky;
      z-index: 1;
    }
    [data-pin='start'] {
      inset-inline-start: var(--_pin-offset);
    }
    [data-pin='end'] {
      inset-inline-end: var(--_pin-offset);
    }
    /*
     * Pinned body cells are sticky only while the table scrolls sideways
     * (data-hscroll on the scroller). At rest they are plain cells shifted by the
     * horizontal scroll offset, which vertical scrolling never changes: a sticky
     * cell per row is a compositing layer each, and Safari stutters moving them
     * (PinScrollController). Both place the cells at the same spot.
     */
    [part~='row'] > [data-pin] {
      position: relative;
      inset-inline: auto;
    }
    [part~='row'] > [data-pin='start'] {
      transform: translateX(var(--_sx, 0px));
    }
    [part~='row'] > [data-pin='end'] {
      transform: translateX(calc(var(--_sx, 0px) - var(--_dir) * var(--_max-x, 0px)));
    }
    [data-hscroll] [part~='row'] > [data-pin] {
      position: sticky;
      transform: none;
    }
    [data-hscroll] [part~='row'] > [data-pin='start'] {
      inset-inline-start: var(--_pin-offset);
    }
    [data-hscroll] [part~='row'] > [data-pin='end'] {
      inset-inline-end: var(--_pin-offset);
    }
    [part~='cell-pinned'] {
      background: var(--_row-surface);
    }
    /*
     * The edge shadow, once per pinned side (.pin-shadow, beside the scroller).
     * --argus-pinned-shadow is written for a shadow falling toward the end side;
     * the start edge in RTL and the end edge in LTR mirror it.
     */
    .pin-shadow {
      position: absolute;
      inset-block-start: 0;
      block-size: min(var(--_view-h, 100%), var(--_content-h, 100%));
      z-index: 3;
      pointer-events: none;
    }
    .pin-shadow[data-side='start'] {
      inset-inline-start: 0;
    }
    .pin-shadow[data-side='end'] {
      inset-inline-end: var(--_sb-x, 0px);
    }
    .pin-shadow::after {
      content: '';
      position: absolute;
      inset: 0;
      box-shadow: var(
        --argus-pinned-shadow,
        4px 0 6px -4px light-dark(rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.6))
      );
      transform: scaleX(var(--_dir));
    }
    .pin-shadow[data-side='end']::after {
      transform: scaleX(calc(-1 * var(--_dir)));
    }

    [data-align='center'] {
      justify-content: center;
      text-align: center;
    }
    [data-align='end'] {
      justify-content: flex-end;
      text-align: end;
    }
    ::slotted(*) {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    [part~='empty'] {
      display: flex;
      align-items: center;
      justify-content: center;
      min-block-size: calc(100% - var(--_row-height));
      padding: var(--_pad);
      box-sizing: border-box;
    }

    /* Measures the resolved row height in px for the virtualizer. */
    .probe {
      position: absolute;
      inset-block-start: 0;
      inline-size: 0;
      block-size: var(--_row-height);
      visibility: hidden;
      pointer-events: none;
    }
  }
`;
