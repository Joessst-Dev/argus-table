import type { RangeChangeDetail } from '@argus-table/core';

/** Fired after an update when the visible row range changed. */
export const RANGE_CHANGE = 'argus-range-change';

declare global {
  interface HTMLElementEventMap {
    'argus-range-change': CustomEvent<RangeChangeDetail>;
  }
}

/** Dispatches a bubbling, composed `CustomEvent`, the shape of every public event. */
export function fire(host: HTMLElement, name: string, detail: unknown): boolean {
  return host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}
