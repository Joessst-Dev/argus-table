import { describe, expect, test } from 'vitest';
import { anchorOf, linkTypes, renderDoc } from './render';

const href = (name: string) => `/api/types/#${anchorOf(name)}`;

describe('renderDoc', () => {
  test('renders code spans, links and lists', () => {
    const html = renderDoc('Use `sorting`. See [ADR](https://x.y).\n\n- a\n- b');
    expect(html).toContain('<code>sorting</code>');
    expect(html).toContain('<a href="https://x.y">ADR</a>');
    expect(html).toContain('<li>a</li>');
  });

  test('a line break inside a paragraph stays one paragraph', () => {
    expect(renderDoc('one\ntwo')).toBe('<p>one\ntwo</p>\n');
  });

  test('raw HTML shows as text', () => {
    expect(renderDoc('A <template> child')).toContain('&lt;template&gt;');
  });

  test('an empty doc renders nothing', () => {
    expect(renderDoc('')).toBe('');
  });
});

describe('linkTypes', () => {
  test('escapes type text and links known types', () => {
    expect(linkTypes('readonly ColumnDef<T>[] | undefined', new Set(['ColumnDef']), href)).toBe(
      'readonly <a href="/api/types/#columndef">ColumnDef</a>&lt;T&gt;[] | undefined',
    );
  });

  test('leaves unknown names and T alone', () => {
    expect(linkTypes('(row: T) => Node & {}', new Set(['ColumnDef']), href)).toBe(
      '(row: T) =&gt; Node &amp; {}',
    );
  });

  test('links whole words only', () => {
    expect(linkTypes('ColumnDefs | ColumnDef', new Set(['ColumnDef']), href)).toBe(
      'ColumnDefs | <a href="/api/types/#columndef">ColumnDef</a>',
    );
  });
});
