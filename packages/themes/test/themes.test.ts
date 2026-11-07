import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Features, transform, type Selector, type StyleRule } from 'lightningcss';

const root = join(import.meta.dirname, '..');
const elementSource = readFileSync(join(root, '../table/src/argus-table.ts'), 'utf8');

// The element's JSDoc is the list of public names (it feeds the manifest).
const tokens = new Set(
  [...elementSource.matchAll(/@cssprop \[(--argus-[\w-]+)/g)].map((m) => m[1]),
);
const parts = new Set([...elementSource.matchAll(/@csspart ([\w-]+)/g)].map((m) => m[1]));

interface Rule {
  selectors: Selector[];
  properties: string[];
}

/** Lowers nesting first, then collects every style rule. */
function rulesOf(file: string): Rule[] {
  const code = readFileSync(join(root, 'src', file));
  const flat = transform({ filename: file, code, include: Features.Nesting }).code;
  const rules: Rule[] = [];
  transform({
    filename: file,
    code: flat,
    visitor: {
      Rule: {
        style(rule: { value: StyleRule }) {
          const { selectors, declarations } = rule.value;
          const all = [
            ...(declarations?.declarations ?? []),
            ...(declarations?.importantDeclarations ?? []),
          ];
          rules.push({
            selectors,
            properties: all.map((d) => (d.property === 'custom' ? d.value.name : d.property)),
          });
        },
      },
    },
  });
  return rules;
}

const themes = readdirSync(join(root, 'src')).filter((f) => f.endsWith('.css'));

describe.each(themes)('%s', (file) => {
  const rules = rulesOf(file);

  it('only styles argus-table, through tokens or ::part()', () => {
    for (const { selectors, properties } of rules) {
      for (const selector of selectors) {
        const partIndex = selector.findIndex((c) => c.type === 'pseudo-element');
        const subject = partIndex === -1 ? selector : selector.slice(0, partIndex);
        const lastCompound = subject.slice(
          subject.findLastIndex((c) => c.type === 'combinator') + 1,
        );
        expect(lastCompound).toContainEqual({ type: 'type', name: 'argus-table' });

        if (partIndex === -1) {
          // On the host itself: tokens and color-scheme only.
          for (const p of properties)
            expect(p === 'color-scheme' || p.startsWith('--argus-'), p).toBe(true);
        } else {
          const part = selector[partIndex];
          expect(part).toMatchObject({ kind: 'part' });
          for (const name of (part as { names: string[] }).names)
            expect(parts, name).toContain(name);
        }
      }
    }
  });

  it('sets only documented tokens', () => {
    const set = rules.flatMap((r) => r.properties).filter((p) => p.startsWith('--argus-'));
    expect(set.length).toBeGreaterThan(0);
    for (const token of set) expect(tokens, token).toContain(token);
  });

  // Build tools polyfill light-dark() for older targets (Vite 8 minifies CSS with
  // Lightning CSS, es2022 by default). The polyfill switches light and dark only
  // where the same stylesheet declares color-scheme; the element's own
  // `color-scheme: light dark` sits in its shadow root, out of their reach. Without
  // a declaration on argus-table itself, every light-dark() token is invalid in
  // the automatic scheme (transparent header, no borders).
  it('keeps its light-dark() colours when a consumer build polyfills them', () => {
    const code = readFileSync(join(root, 'src', file));
    if (!code.includes('light-dark(')) return;
    const v = (major: number, minor = 0) => (major << 16) | (minor << 8);
    const lowered = transform({
      filename: file,
      code,
      targets: { chrome: v(94), firefox: v(93), safari: v(15) },
    }).code;

    const switches = new Set<string>();
    transform({
      filename: file,
      code: lowered,
      visitor: {
        Rule: {
          style(rule: { value: StyleRule }) {
            const { selectors, declarations } = rule.value;
            const bare = selectors.some(
              (s) => s.length === 1 && s[0]?.type === 'type' && s[0].name === 'argus-table',
            );
            if (!bare) return;
            for (const d of declarations?.declarations ?? [])
              if (d.property === 'custom') switches.add(d.value.name);
          },
        },
      },
    });
    expect(switches).toContain('--lightningcss-light');
    expect(switches).toContain('--lightningcss-dark');
  });

  it('sets every documented colour token, so the theme is complete', () => {
    const set = new Set(rules.flatMap((r) => r.properties));
    for (const token of tokens) {
      // Sizes stay per density in the element; a theme may leave them alone.
      if (token === '--argus-row-height' || token === '--argus-cell-padding-inline') continue;
      expect(set, token).toContain(token);
    }
  });
});
