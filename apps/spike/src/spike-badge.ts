import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Status } from './data.js';

/** A small component with its own shadow DOM, like the ones users put in cells. */
@customElement('spike-badge')
export class SpikeBadge extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
      padding: 0 0.5em;
      border-radius: 999px;
      font-size: 0.8em;
      line-height: 1.6;
      background: light-dark(#eef2ff, #312e81);
    }
    :host([status='blocked']) {
      background: light-dark(#fee2e2, #7f1d1d);
    }
    :host([status='paused']) {
      background: light-dark(#fef3c7, #78350f);
    }
  `;

  @property({ reflect: true }) status: Status = 'active';

  protected override render() {
    return html`${this.status}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'spike-badge': SpikeBadge;
  }
}
