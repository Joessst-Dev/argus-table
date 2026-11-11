// A resolved theme as a stylesheet in the shape of @argus-table/themes: flat
// CSS (no nesting, so any build tool reads it), tokens and color-scheme on
// argus-table, sizes per density, ::part() rules, and the data-argus-theme
// switches.
import { tokenOrder } from './catalog.js';
import { simplify, type Density, type ParsedTheme, type Value } from './model.js';

/** A value as CSS: a pair becomes `light-dark(light, dark)`. */
export function valueText(value: Value): string {
  const v = simplify(value);
  return typeof v === 'string' ? v : `light-dark(${v.light}, ${v.dark})`;
}

const block = (selector: string, lines: string[]) =>
  `${selector} {\n${lines.map((l) => `  ${l}`).join('\n')}\n}`;

const tokenLines = (tokens: Record<string, Value>) =>
  Object.keys(tokens)
    .sort(tokenOrder)
    .map((name) => `${name}: ${valueText(tokens[name] ?? '')};`);

export interface SerializeOptions {
  name: string;
  /** What the theme started from, for the header comment. */
  basedOn?: string;
}

export function serializeTheme(theme: ParsedTheme, options: SerializeOptions): string {
  const name = options.name.replace(/\*\//g, '* /').trim() || 'Custom theme';
  const out: string[] = [
    [
      '/*',
      ` * ${name}: an argus-table theme${options.basedOn ? `, based on ${options.basedOn}` : ''}.`,
      ' * Made with the argus-table theme creator.',
      ' *',
      ' * Load it after argus-table. It follows the light or dark preference; force a',
      ' * scheme with data-argus-theme="dark" or "light" on the table or an ancestor.',
      ' */',
    ].join('\n'),
    // color-scheme on argus-table itself, so build tools that polyfill
    // light-dark() switch these colours too (see @argus-table/themes).
    block('argus-table', ['color-scheme: light dark;', ...tokenLines(theme.tokens)]),
  ];

  for (const density of ['compact', 'comfortable', 'spacious'] as Density[]) {
    const tokens = theme.density[density];
    if (tokens && Object.keys(tokens).length > 0)
      out.push(block(`argus-table[density='${density}']`, tokenLines(tokens)));
  }

  for (const rule of theme.parts) {
    if (rule.declarations.length === 0) continue;
    const selector = rule.parts.map((p) => `argus-table::part(${p})`).join(',\n');
    out.push(
      block(
        selector,
        rule.declarations.map(([p, v]) => `${p}: ${v};`),
      ),
    );
  }

  out.push(
    [
      '/* The attribute on the table itself comes last, so it beats one on an ancestor. */',
      block("[data-argus-theme='dark'] argus-table", ['color-scheme: dark;']),
      block("[data-argus-theme='light'] argus-table", ['color-scheme: light;']),
      block("argus-table[data-argus-theme='dark']", ['color-scheme: dark;']),
      block("argus-table[data-argus-theme='light']", ['color-scheme: light;']),
    ].join('\n'),
  );
  return `${out.join('\n\n')}\n`;
}
