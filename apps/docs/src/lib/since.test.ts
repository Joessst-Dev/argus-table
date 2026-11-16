import { describe, expect, test } from 'vitest';
import { releaseBadge } from './since';

describe('releaseBadge', () => {
  test('a released version says since', () => {
    expect(releaseBadge('1.3', '1.3.0')).toEqual({ text: 'Since 1.3', upcoming: false });
    expect(releaseBadge('0.1', '1.3.0')).toEqual({ text: 'Since 0.1', upcoming: false });
  });

  test('a newer version says coming', () => {
    expect(releaseBadge('1.4', '1.3.0')).toEqual({ text: 'Coming in 1.4', upcoming: true });
    expect(releaseBadge('2.0', '1.12.3')).toEqual({ text: 'Coming in 2.0', upcoming: true });
  });

  test('compares numerically, not as text', () => {
    expect(releaseBadge('1.10', '1.9.0').upcoming).toBe(true);
  });

  test('a prerelease of that minor is still to come', () => {
    expect(releaseBadge('1.4', '1.4.0-rc.1').upcoming).toBe(true);
    expect(releaseBadge('1.3', '1.4.0-rc.1').upcoming).toBe(false);
  });
});
