import { describe, expect, test } from 'vitest';
import { filesOf } from './sources';

const raw = {
  '/src/examples/sorting/basic/html/main.js': 'js',
  '/src/examples/sorting/basic/html/index.html': 'html',
  '/src/examples/sorting/basic/react/Sorting.tsx': 'tsx',
  '/src/examples/sorting/basic/vue/Sorting.vue': 'vue',
  '/src/examples/sorting/basic/angular/sorting.component.ts': 'ts',
  '/src/examples/sorting/other/react/Other.tsx': 'x',
};

describe('filesOf', () => {
  test('groups an example’s files by flavour, index.html first', () => {
    const files = filesOf(raw, 'sorting/basic');
    expect(files.html.map((f) => f.name)).toEqual(['index.html', 'main.js']);
    expect(files.react).toEqual([{ name: 'Sorting.tsx', code: 'tsx', lang: 'tsx' }]);
    expect(files.angular[0]?.lang).toBe('ts');
  });

  test('leaves out other examples', () => {
    expect(filesOf(raw, 'sorting/basic').react).toHaveLength(1);
  });

  test('an example with no files has empty flavours', () => {
    expect(filesOf(raw, 'nope/none').vue).toEqual([]);
  });
});
