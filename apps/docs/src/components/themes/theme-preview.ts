// <argus-theme-preview>: one shipped theme on the orders table, in a shadow
// root of its own. The site loads default.css for its own tables; a theme's
// rules (`argus-table { … }`) don't cross into a shadow root, nor out of one,
// so each preview shows exactly the shipped file. Its scheme is forced
// (`scheme="light"` / `"dark"`) or follows the site's (`"auto"`, through the
// `data-argus-theme` that Head.astro mirrors onto the document).
import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PinnedRows } from 'argus-table';
import 'argus-table';
import {
  getOrderId,
  orderColumns,
  orders,
  totals,
  type Order,
} from '@argus-table/theme-creator/orders';
// `?raw`, not `?inline`: the shipped file as it is, not re-minified and lowered.
import defaultCss from '@argus-table/themes/default.css?raw';
import materialCss from '@argus-table/themes/material.css?raw';
import fluentCss from '@argus-table/themes/fluent.css?raw';
import bootstrapCss from '@argus-table/themes/bootstrap.css?raw';
import minimalCss from '@argus-table/themes/minimal.css?raw';

export const THEMES = {
  default: defaultCss,
  material: materialCss,
  fluent: fluentCss,
  bootstrap: bootstrapCss,
  minimal: minimalCss,
} as const;

export type ThemeName = keyof typeof THEMES;

const sheets = new Map<ThemeName, CSSStyleSheet>();
function sheetOf(theme: ThemeName): CSSStyleSheet {
  let sheet = sheets.get(theme);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(THEMES[theme]);
    sheets.set(theme, sheet);
  }
  return sheet;
}

const pinnedRows: PinnedRows<Order> = { bottom: [totals] };

@customElement('argus-theme-preview')
export class ArgusThemePreview extends LitElement {
  static override styles = css`
    :host {
      display: block;
      margin-block: 1rem;
    }
    argus-table {
      block-size: 320px;
    }
    /* The status chips are page CSS, like an app's own: cell content is light DOM. */
    .chip {
      padding: 1px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 10%, transparent);
    }
  `;

  /** The shipped theme: `default`, `material`, `fluent`, `bootstrap` or `minimal`. */
  @property() theme: ThemeName = 'default';
  /** `auto` follows the site's light or dark mode. */
  @property() scheme: 'auto' | 'light' | 'dark' = 'auto';
  @property() density: 'compact' | 'comfortable' | 'spacious' = 'comfortable';
  /** Multi-row selection with checkboxes. */
  @property({ type: Boolean }) selection = false;
  /** The table's accessible name. */
  @property() label = '';

  #site = 'light';
  /** The element's own sheets, as Lit adopted them; the theme's goes after. */
  #own: CSSStyleSheet[] | undefined;
  #observer = new MutationObserver(() => {
    this.#readSite();
  });

  override connectedCallback(): void {
    super.connectedCallback();
    this.#readSite();
    this.#observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-argus-theme'],
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer.disconnect();
  }

  #readSite() {
    const site = document.documentElement.dataset.argusTheme === 'dark' ? 'dark' : 'light';
    if (site === this.#site) return;
    this.#site = site;
    this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const root = this.shadowRoot;
    if (!changed.has('theme') || !root) return;
    this.#own ??= [...root.adoptedStyleSheets];
    root.adoptedStyleSheets = [...this.#own, sheetOf(this.theme)];
  }

  protected override render() {
    const scheme = this.scheme === 'auto' ? this.#site : this.scheme;
    return html`<div data-argus-theme=${scheme}>
      <argus-table
        aria-label=${this.label}
        density=${this.density}
        selection-mode=${this.selection ? 'multi' : 'none'}
        ?selection-checkboxes=${this.selection}
        .columns=${orderColumns}
        .data=${orders}
        .pinnedRows=${pinnedRows}
        .getRowId=${getOrderId}
      ></argus-table>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'argus-theme-preview': ArgusThemePreview;
  }
}
