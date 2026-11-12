// Presets read and written again, seeds, and the rules every theme must keep
// (the same as packages/themes/test/themes.test.ts, checked through CSSOM).
import { afterEach, describe, expect, it } from 'vitest';
import 'argus-table';
import { PARTS, SIZE_TOKENS, TABLE_TOKEN_NAMES, TOKEN_NAMES, TOKENS } from './catalog.js';
import { DEFAULT_SEEDS, readSeeds } from './derive.js';
import { simplify, type PresetId, type ThemeDraft } from './model.js';
import { parseTheme } from './parse.js';
import { PRESET_CSS, newDraft, presetTheme } from './presets.js';
import { resolveTheme } from './resolve.js';
import { serializeTheme } from './serialize.js';

const PRESETS = Object.keys(PRESET_CSS) as PresetId[];
const cssOf = (draft: ThemeDraft) => serializeTheme(resolveTheme(draft), { name: draft.name });

/** Checks the rules of packages/themes on a stylesheet. */
function checkThemeRules(css: string): void {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const colorTokens = TOKENS.filter(
    (t) => t.group === 'table' && t.kind !== 'length' && !SIZE_TOKENS.has(t.name),
  ).map((t) => t.name);
  const set = new Set<string>();
  let bareScheme = false;
  for (const rule of sheet.cssRules) {
    expect(rule).toBeInstanceOf(CSSStyleRule);
    const { selectorText, style } = rule as CSSStyleRule;
    for (const selector of selectorText.split(',').map((s) => s.trim())) {
      const part = /::part\(([\w-]+)\)$/.exec(selector)?.[1];
      // The subject is always argus-table.
      expect(selector.replace(/::part\([\w-]+\)$/, ''), selector).toMatch(
        /argus-table(\[[^\]]+\])?$/,
      );
      if (part) {
        expect(PARTS, part).toContain(part);
        continue;
      }
      for (const property of style) {
        expect(property === 'color-scheme' || TOKEN_NAMES.has(property), property).toBe(true);
        set.add(property);
      }
      if (selector === 'argus-table' && style.getPropertyValue('color-scheme') === 'light dark')
        bareScheme = true;
    }
  }
  expect(bareScheme, 'color-scheme on bare argus-table').toBe(true);
  for (const token of colorTokens) expect(set, token).toContain(token);
}

let mounted: HTMLElement[] = [];
afterEach(() => {
  for (const el of mounted) el.remove();
  mounted = [];
});

/** Every catalogue token's computed value on a table under `css`, per scheme. */
async function computedTokens(css: string): Promise<Record<string, string>> {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];
  root.innerHTML = `<div data-argus-theme="light"><argus-table density="compact"></argus-table></div>
    <div data-argus-theme="dark"><argus-table density="spacious"></argus-table></div>
    <argus-table></argus-table>`;
  document.body.append(host);
  mounted.push(host);
  await Promise.all([...root.querySelectorAll('argus-table')].map((t) => t.updateComplete));
  const out: Record<string, string> = {};
  root.querySelectorAll('argus-table').forEach((table, i) => {
    const style = getComputedStyle(table);
    for (const { name } of TOKENS)
      out[`${String(i)} ${name}`] = style.getPropertyValue(name).replace(/\s+/g, '');
    out[`${String(i)} background`] = style.backgroundColor;
    out[`${String(i)} color`] = style.color;
  });
  return out;
}

describe.each(PRESETS)('the %s preset', (id) => {
  it('reads without warnings', () => {
    expect(parseTheme(PRESET_CSS[id]).warnings).toEqual([]);
  });

  it('is written back as the same theme', async () => {
    const css = cssOf(newDraft(id));
    expect(await computedTokens(css)).toEqual(await computedTokens(PRESET_CSS[id]));
    // And reads back to the same model.
    expect(parseTheme(css).theme).toEqual(presetTheme(id));
  });

  it('keeps the theme rules, untouched and with every seed changed', () => {
    checkThemeRules(PRESET_CSS[id]);
    checkThemeRules(cssOf(newDraft(id)));
    checkThemeRules(
      cssOf({
        ...newDraft(id),
        seeds: {
          ...DEFAULT_SEEDS,
          accent: { light: '#0a7d5a', dark: '#5fd3a8' },
          header: { style: 'accent', strength: 60, muted: true },
          rows: { ...DEFAULT_SEEDS.rows, stripes: true },
        },
        parts: { uppercase: true, pinnedSeparator: true, checkboxAccent: true },
      }),
    );
  });

  it('reads its seeds from its colours', () => {
    const seeds = readSeeds(presetTheme(id));
    expect(seeds.surface.light).toMatch(/^#[0-9a-f]{6}$/);
    expect(seeds.accent.light).not.toBe(seeds.surface.light);
  });
});

describe('seeds', () => {
  it('write only their own tokens', () => {
    const base = newDraft('material');
    const before = resolveTheme(base).tokens;
    const after = resolveTheme({
      ...base,
      seeds: { lines: { ...readSeeds(base.base).lines, radius: 4 } },
    }).tokens;
    const changed = Object.keys(after).filter(
      (name) =>
        JSON.stringify(simplify(after[name] ?? '')) !==
        JSON.stringify(simplify(before[name] ?? '')),
    );
    expect(changed).toEqual(['--argus-border-radius']);
    expect(after['--argus-border-radius']).toBe('4px');
  });

  it('change the accent everywhere it shows', () => {
    const draft = newDraft('default');
    const css = cssOf({ ...draft, seeds: { accent: { light: '#0a7d5a', dark: '#5fd3a8' } } });
    expect(css).toContain('--argus-focus-ring: 2px solid light-dark(#0a7d5a, #5fd3a8);');
    expect(css).toContain('--argus-resize-handle-color: light-dark(#0a7d5a, #5fd3a8);');
    // The default theme colours its sorted header with the accent: it follows.
    expect(css).toMatch(
      /::part\(header-cell-sorted\) \{\n {2}color: light-dark\(#0a7d5a, #5fd3a8\);/,
    );
  });

  it('write sizes per density', () => {
    const draft = newDraft('default');
    const theme = resolveTheme({
      ...draft,
      seeds: {
        rows: {
          ...DEFAULT_SEEDS.rows,
          height: { compact: 30, comfortable: 42, spacious: 56 },
        },
      },
    });
    expect(theme.tokens['--argus-row-height']).toBe('42px');
    expect(theme.density.compact?.['--argus-row-height']).toBe('30px');
    expect(theme.density.spacious?.['--argus-row-height']).toBe('56px');
  });

  it('make a complete theme from a blank start', () => {
    checkThemeRules(cssOf(newDraft('blank')));
  });
});

describe('overrides', () => {
  it('win over seeds', () => {
    const draft = newDraft('default');
    const theme = resolveTheme({
      ...draft,
      seeds: { accent: { light: '#0a7d5a', dark: '#5fd3a8' } },
      overrides: { '--argus-focus-ring': '3px dashed red' },
    });
    expect(theme.tokens['--argus-focus-ring']).toBe('3px dashed red');
  });
});

describe('part options', () => {
  it('change the base theme’s rule in place', () => {
    const theme = resolveTheme({ ...newDraft('minimal'), parts: { uppercase: false } });
    const header = theme.parts.find((r) => r.parts.includes('header-cell'));
    expect(header?.declarations).toEqual([['font-size', '0.6875rem']]);
  });

  it('add a rule the base theme lacks', () => {
    const theme = resolveTheme({ ...newDraft('default'), parts: { skeletonRadius: true } });
    expect(theme.parts).toContainEqual({
      parts: ['skeleton'],
      declarations: [['border-radius', '4px']],
    });
  });

  it('drop removed rules', () => {
    const draft = newDraft('default');
    const theme = resolveTheme({ ...draft, removedParts: ['cell'] });
    expect(theme.parts.some((r) => r.parts.includes('cell'))).toBe(false);
  });
});

describe('parseTheme', () => {
  it('reports what a theme may not contain', () => {
    const { theme, warnings } = parseTheme(`
      argus-table { --argus-bg: #fff; color: red; --my-own: 1; }
      argus-table::part(nope) { color: red; }
      .page argus-table::part(cell) { color: red; }
      @media (width > 1px) { argus-table { --argus-fg: #000; } }
      body { margin: 0; }
    `);
    expect(theme.tokens).toEqual({ '--argus-bg': '#fff' });
    expect(theme.parts).toEqual([]);
    expect(warnings).toHaveLength(6);
  });

  it('reads light-dark() as a build lowered it (Lightning CSS)', () => {
    // What Vite's production minifier makes of default.css.
    const { theme, warnings } = parseTheme(
      'argus-table{--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light dark;' +
        '--argus-header-bg:var(--lightningcss-light,#f6f7f9)var(--lightningcss-dark,#181c23);' +
        '--argus-focus-ring:2px solid var(--lightningcss-light,#2f5bd3)var(--lightningcss-dark,#8aa6f2);' +
        '--argus-pinned-shadow:4px 0 6px -4px var(--lightningcss-light,#00000029)var(--lightningcss-dark,#0000008c)}' +
        '[data-argus-theme=dark] argus-table{--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}' +
        'argus-table::part(header-cell-sorted){color:var(--lightningcss-light,#2f5bd3)var(--lightningcss-dark,#8aa6f2)}',
    );
    expect(warnings).toEqual([]);
    expect(theme.tokens).toEqual({
      '--argus-header-bg': { light: '#f6f7f9', dark: '#181c23' },
      '--argus-focus-ring': '2px solid light-dark(#2f5bd3, #8aa6f2)',
      '--argus-pinned-shadow': '4px 0 6px -4px light-dark(#00000029, #0000008c)',
    });
    expect(theme.parts[0]?.declarations).toEqual([['color', 'light-dark(#2f5bd3, #8aa6f2)']]);
  });

  it('reads light-dark() pairs and nested rules', () => {
    const { theme } = parseTheme(`argus-table {
      --argus-bg: light-dark(#fff, #111);
      &[density="compact"] { --argus-row-height: 30px; }
      &::part(cell) { color: light-dark(#111, #eee); }
    }`);
    expect(theme.tokens['--argus-bg']).toEqual({ light: '#fff', dark: '#111' });
    expect(theme.density.compact).toEqual({ '--argus-row-height': '30px' });
    expect(theme.parts).toEqual([
      { parts: ['cell'], declarations: [['color', 'light-dark(#111111, #eeeeee)']] },
    ]);
  });
});

describe('the catalogue', () => {
  it('has the table’s tokens and parts', () => {
    expect(TABLE_TOKEN_NAMES).toContain('--argus-bg');
    expect(PARTS).toContain('header-cell');
  });

  it('lists every token the add-ons read', () => {
    const sources = import.meta.glob<string>(
      [
        '../../../packages/header-menu/src/**/*.ts',
        '../../../packages/formulas/src/**/*.ts',
        '!**/*.test.ts',
      ],
      { query: '?raw', import: 'default', eager: true },
    );
    const used = new Set<string>();
    for (const text of Object.values(sources))
      for (const [, name] of text.matchAll(/var\((--argus-[\w-]+)/g)) if (name) used.add(name);
    const addons = [...used].filter((n) => !TABLE_TOKEN_NAMES.has(n)).sort();
    const listed = TOKENS.filter((t) => t.group !== 'table')
      .map((t) => t.name)
      .sort();
    expect(listed).toEqual(addons);
  });
});
