/**
 * State that works like a form input: uncontrolled until the host sets it,
 * controlled from then on. See `docs/plan/code-architecture/04-state-and-events.md`.
 *
 * - **Uncontrolled:** `request()` applies the change. The caller then fires the change event.
 * - **Controlled:** `request()` changes nothing and returns the proposed value for the
 *   event. The value only changes when the host calls `set()` again.
 * - `set(undefined)` hands ownership back to the table and keeps the last value.
 */
export interface Controllable<T> {
  /** The current value. */
  readonly value: T;
  /** `true` once the host has set a value (and not handed it back with `undefined`). */
  readonly controlled: boolean;
  /** Called when the host sets the property. */
  set(value: T | undefined): void;
  /**
   * Called when the table wants to change the state, for example after a header click.
   * Returns the proposed value and whether it was applied.
   */
  request(next: T): { value: T; applied: boolean };
}

export function controllable<T>(initial: T): Controllable<T> {
  let value = initial;
  let controlled = false;
  return {
    get value() {
      return value;
    },
    get controlled() {
      return controlled;
    },
    set(next) {
      if (next === undefined) {
        controlled = false;
        return;
      }
      controlled = true;
      value = next;
    },
    request(next) {
      if (!controlled) value = next;
      return { value: next, applied: !controlled };
    },
  };
}
