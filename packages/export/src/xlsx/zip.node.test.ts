import { describe, expect, test } from 'vitest';
import { unzip } from '../test/unzip.js';
import { crc32, zip } from './zip.js';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('zip', () => {
  test('crc32 matches the standard check values', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
    expect(crc32(bytes(''))).toBe(0);
    expect(crc32(bytes('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });

  test('round-trips entries, deflating the ones that shrink and storing the rest', async () => {
    const long = 'abc'.repeat(1000);
    const archive = await zip([
      { name: 'a.txt', data: bytes(long) },
      { name: 'dir/b.txt', data: bytes('x') },
    ]);
    expect(archive.length).toBeLessThan(long.length);
    const files = await unzip(archive);
    expect([...files.keys()]).toEqual(['a.txt', 'dir/b.txt']);
    expect(files.get('a.txt')).toBe(long);
    expect(files.get('dir/b.txt')).toBe('x');
  });

  test('makes the same bytes for the same entries', async () => {
    const entries = [{ name: 'a', data: bytes('same') }];
    expect(await zip(entries)).toEqual(await zip(entries));
  });
});
