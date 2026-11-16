import type { ReactiveElement } from 'lit';
import type { Controllable } from '@argus-table/core';
import { fire } from '../events.js';

type Detail = Record<string, unknown>;

/**
 * The change events of controllable state (ADR 0004). A change the table
 * applies itself fires once the update that renders it is done (`flush()` in
 * `updated()`): one event per key (a column, or `''`), the latest detail for
 * each, all with the latest value. A change to state the host controls fires
 * right away, with the proposed value.
 */
export class StateEvents {
  readonly #host: ReactiveElement;
  /** Details to fire after the update: by event, in the order they fire, then by key. */
  readonly #queued: Map<string, Map<string, Detail>>;

  /** `order`: the events, in the order queued ones fire. */
  constructor(host: ReactiveElement, order: readonly string[]) {
    this.#host = host;
    this.#queued = new Map(order.map((event) => [event, new Map<string, Detail>()]));
  }

  /**
   * Requests `next` for the property `name` through `state` (`controllable()`).
   * Applied, the update is requested and `event` fires after it for each of
   * `details`; controlled, it fires now. Each detail gets the value under
   * `name`, first. Returns the value: applied, or proposed.
   */
  change<V>(
    name: string,
    state: Controllable<V>,
    next: V,
    event: string,
    details: readonly (readonly [key: string, detail: Detail])[],
  ): V {
    const old = state.value;
    const { value, applied } = state.request(next);
    if (applied) {
      // Events still queued fire with the latest value too.
      for (const queued of this.#queued.get(event)?.values() ?? []) queued[name] = value;
      this.#host.requestUpdate(name, old);
    }
    for (const [key, detail] of details)
      this.emit(event, key, { [name]: value, ...detail }, !applied);
    return value;
  }

  /** Fires `event` now, or once the update is done (replacing the detail queued under `key`). */
  emit(event: string, key: string, detail: Detail, now: boolean): void {
    if (now) {
      fire(this.#host, event, detail);
      return;
    }
    this.#queued.get(event)?.set(key, detail);
    this.#host.requestUpdate();
  }

  /** Fires the queued events, in order. Call once the update is done. */
  flush(): void {
    for (const [event, queued] of this.#queued) {
      if (queued.size === 0) continue;
      const details = [...queued.values()];
      queued.clear();
      for (const detail of details) fire(this.#host, event, detail);
    }
  }
}
