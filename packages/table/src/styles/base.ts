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
    /*
     * Pinned columns: sticky inside the scroll container, with offsets from the
     * table model. Logical insets make RTL work without extra rules.
     */
    [data-pin] {
      position: sticky;
      z-index: 1;
      /* Visible so the edge shadow isn't clipped; slotted content still clips itself. */
      overflow: visible;
    }
    [data-pin='start'] {
      inset-inline-start: var(--_pin-offset);
    }
    [data-pin='end'] {
      inset-inline-end: var(--_pin-offset);
    }
    [part~='cell-pinned'] {
      background: var(--_row-surface);
    }
    /*
     * The edge shadow. --argus-pinned-shadow is written for a shadow falling
     * toward the end side; the start edge in RTL and the end edge in LTR mirror it.
     */
    [data-pin-edge]::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      box-shadow: var(
        --argus-pinned-shadow,
        4px 0 6px -4px light-dark(rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.6))
      );
      transform: scaleX(var(--_dir));
    }
    [data-pin='end'][data-pin-edge]::after {
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
