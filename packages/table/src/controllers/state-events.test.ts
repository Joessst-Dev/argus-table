import { afterEach, describe, expect, test } from 'vitest';
import { ReactiveElement } from 'lit';
import { controllable } from '@argus-table/core';
import { StateEvents } from './state-events.js';

class Host extends ReactiveElement {}
customElements.define('state-events-host', Host);

let host: Host;

function setup(): { events: StateEvents; fired: [string, unknown][] } {
  host = document.createElement('state-events-host') as Host;
  document.body.append(host);
  const events = new StateEvents(host, ['a-change', 'b-change']);
  const fired: [string, unknown][] = [];
  for (const name of ['a-change', 'b-change']) {
    host.addEventListener(name, (e) => fired.push([name, (e as CustomEvent).detail]));
  }
  return { events, fired };
}

afterEach(() => {
  host.remove();
});

describe('StateEvents', () => {
  test('an applied change fires on flush, with the value first, then the cause', async () => {
    const { events, fired } = setup();
    const state = controllable<number[]>([]);
    const value = events.change('a', state, [1], 'a-change', [['x', { columnId: 'x' }]]);
    expect(value).toEqual([1]);
    expect(state.value).toEqual([1]);
    expect(fired).toEqual([]);
    expect(host.isUpdatePending).toBe(true);
    await host.updateComplete;
    events.flush();
    expect(fired).toEqual([['a-change', { a: [1], columnId: 'x' }]]);
    expect(Object.keys(fired[0]?.[1] as object)).toEqual(['a', 'columnId']);
    events.flush();
    expect(fired).toHaveLength(1);
  });

  test('a controlled change fires the proposed value right away and changes nothing', () => {
    const { events, fired } = setup();
    const state = controllable<number[]>([]);
    state.set([0]);
    const value = events.change('a', state, [1], 'a-change', [['', {}]]);
    expect(value).toEqual([1]);
    expect(state.value).toEqual([0]);
    expect(fired).toEqual([['a-change', { a: [1] }]]);
  });

  test('the latest detail per key fires, every one with the latest value', () => {
    const { events, fired } = setup();
    const state = controllable<string>('');
    events.change('a', state, 'v1', 'a-change', [['x', { n: 1 }]]);
    events.change('a', state, 'v2', 'a-change', [['y', { n: 2 }]]);
    events.change('a', state, 'v3', 'a-change', [['x', { n: 3 }]]);
    events.flush();
    expect(fired).toEqual([
      ['a-change', { a: 'v3', n: 3 }],
      ['a-change', { a: 'v3', n: 2 }],
    ]);
  });

  test('queued events fire in the order given, not the order queued', () => {
    const { events, fired } = setup();
    events.emit('b-change', '', { b: 1 }, false);
    events.change('a', controllable(0), 1, 'a-change', [['', {}]]);
    events.flush();
    expect(fired.map(([name]) => name)).toEqual(['a-change', 'b-change']);
  });
});
