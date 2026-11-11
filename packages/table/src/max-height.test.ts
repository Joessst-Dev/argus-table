import { afterEach, expect, test } from 'vitest';
import { bodyCap } from './max-height.js';

afterEach(() => {
  document.body.replaceChildren();
});

test('a body at the cap keeps a header stuck to the top, scrolled to its end', () => {
  // Any body this tall is capped; with nothing scrolling along, the cap is the
  // engine's limit less a margin.
  const cap = bodyCap(1_000_000_000, 0);
  expect(cap).toBeGreaterThanOrEqual(2_000_000);
  const scroller = document.createElement('div');
  scroller.style.cssText = 'block-size: 400px; inline-size: 300px; overflow: auto';
  const header = document.createElement('div');
  header.style.cssText = 'position: sticky; inset-block-start: 0; block-size: 40px';
  const body = document.createElement('div');
  body.style.blockSize = `${String(cap)}px`;
  scroller.append(header, body);
  document.body.append(scroller);
  expect(body.offsetHeight).toBe(cap);
  scroller.scrollTop = scroller.scrollHeight;
  expect(scroller.scrollTop).toBeGreaterThan(cap - 1000);
  const top = scroller.getBoundingClientRect().top;
  expect(header.getBoundingClientRect().top).toBeCloseTo(top, 0);
});
