import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * The host carries the grid role, so rows rendered in the shadow root become
 * its children in the accessibility tree. Set through ElementInternals (not an
 * attribute) so users can still override it with their own `role`.
 */
function attachGridInternals(host: HTMLElement): ElementInternals {
  const internals = host.attachInternals();
  internals.role = 'grid';
  return internals;
}

/**
 * A virtualized data table.
 *
 * Phase 0 skeleton: renders an empty grid container. Columns, data,
 * virtualization and the rest of the public API arrive in Phase 1.
 *
 * @summary Data table with pinned rows and columns and infinite loading.
 * @csspart table - The scroll container that holds header, body and footer.
 */
@customElement('argus-table')
export class ArgusTable extends LitElement {
  static override styles = css`
    @layer argus-base {
      :host {
        display: block;
      }
    }
  `;

  constructor() {
    super();
    attachGridInternals(this);
  }

  protected override render() {
    return html`<div part="table"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'argus-table': ArgusTable;
  }
}
