import { describe, expect, it } from 'vitest';
import { controllable } from './controllable.js';

describe('controllable', () => {
  it('starts uncontrolled with the initial value', () => {
    const state = controllable<string[]>([]);
    expect(state.controlled).toBe(false);
    expect(state.value).toEqual([]);
  });

  it('applies requests while uncontrolled', () => {
    const state = controllable(1);
    expect(state.request(2)).toEqual({ value: 2, applied: true });
    expect(state.value).toBe(2);
  });

  it('becomes controlled when the host sets a value', () => {
    const state = controllable(1);
    state.set(5);
    expect(state.controlled).toBe(true);
    expect(state.value).toBe(5);
  });

  it('only proposes while controlled', () => {
    const state = controllable(1);
    state.set(5);
    expect(state.request(6)).toEqual({ value: 6, applied: false });
    expect(state.value).toBe(5);
    // The host accepts the proposal by setting it.
    state.set(6);
    expect(state.value).toBe(6);
  });

  it('hands control back on undefined and keeps the last value', () => {
    const state = controllable(1);
    state.set(5);
    state.set(undefined);
    expect(state.controlled).toBe(false);
    expect(state.value).toBe(5);
    expect(state.request(7).applied).toBe(true);
    expect(state.value).toBe(7);
  });
});
