// WCAG AA checks on a resolved theme, in both schemes, in this browser
// (Canvas and CanvasText differ between engines). A pair the checker can't
// resolve (other system colours, currentColor) is reported as not checked,
// never as a pass.
import { contrast, ensureContrast, formatColor, over, parseColor, type Rgb } from './color.js';
import {
  SCHEMES,
  isScheme,
  type ParsedTheme,
  type PartRule,
  type Scheme,
  type SchemeName,
  type Value,
} from './model.js';
import { colorIn, lookupIn, resolveColor, type Lookup } from './values.js';

export interface ContrastCheck {
  id: string;
  label: string;
  /** The token (or part declaration) whose colour is in front. */
  fg: string;
  /** The background token. */
  bg: string;
  /** 4.5 for text, 3 for focus indicators and other non-text marks. */
  min: number;
  /** Only when a part rule sets the colour. */
  part?: { part: string; property: string };
  /** The fg is the colour inside a compound value (`2px solid …`). */
  compound?: boolean;
}

export const CHECKS: readonly ContrastCheck[] = [
  { id: 'body', label: 'Text on the table', fg: '--argus-fg', bg: '--argus-bg', min: 4.5 },
  {
    id: 'stripe',
    label: 'Text on striped rows',
    fg: '--argus-fg',
    bg: '--argus-row-odd-bg',
    min: 4.5,
  },
  {
    id: 'hover',
    label: 'Text on the hovered row',
    fg: '--argus-fg',
    bg: '--argus-row-hover-bg',
    min: 4.5,
  },
  {
    id: 'selected',
    label: 'Text on selected rows',
    fg: '--argus-fg',
    bg: '--argus-row-selected-bg',
    min: 4.5,
  },
  {
    id: 'pinned-row',
    label: 'Text on pinned rows',
    fg: '--argus-fg',
    bg: '--argus-row-pinned-bg',
    min: 4.5,
  },
  {
    id: 'header',
    label: 'Header text',
    fg: '--argus-header-fg',
    bg: '--argus-header-bg',
    min: 4.5,
  },
  {
    id: 'sorted',
    label: 'Sorted column’s header',
    fg: '::part(header-cell-sorted) color',
    bg: '--argus-header-bg',
    min: 4.5,
    part: { part: 'header-cell-sorted', property: 'color' },
  },
  {
    id: 'focus',
    label: 'Focus ring on the table',
    fg: '--argus-focus-ring',
    bg: '--argus-bg',
    min: 3,
    compound: true,
  },
  {
    id: 'focus-selected',
    label: 'Focus ring on selected rows',
    fg: '--argus-focus-ring',
    bg: '--argus-row-selected-bg',
    min: 3,
    compound: true,
  },
  { id: 'menu', label: 'Menu text', fg: '--argus-menu-fg', bg: '--argus-menu-bg', min: 4.5 },
  {
    id: 'menu-active',
    label: 'Menu text on the active item',
    fg: '--argus-menu-fg',
    bg: '--argus-menu-item-active-bg',
    min: 4.5,
  },
  {
    id: 'dialog-accent',
    label: 'Formula editor’s save button',
    fg: '--argus-dialog-accent-fg',
    bg: '--argus-dialog-accent',
    min: 4.5,
  },
];

export interface ContrastResult {
  check: ContrastCheck;
  scheme: SchemeName;
  /** Undefined: not checked. */
  ratio?: number;
  pass?: boolean;
}

const solid = (color: Rgb, under: Rgb) => (color.a < 1 ? over(color, under) : color);

function fgValue(check: ContrastCheck, theme: ParsedTheme, lookup: Lookup): string | undefined {
  if (check.part) return partValue(theme.parts, check.part.part, check.part.property);
  const value = lookup(check.fg);
  return value === undefined
    ? undefined
    : typeof value === 'string'
      ? value
      : `light-dark(${value.light}, ${value.dark})`;
}

const partValue = (rules: readonly PartRule[], part: string, property: string) =>
  rules.find((r) => r.parts.includes(part))?.declarations.find(([p]) => p === property)?.[1];

function colorsOf(
  check: ContrastCheck,
  theme: ParsedTheme,
  scheme: SchemeName,
): { fg: Rgb; bg: Rgb } | undefined {
  const lookup = lookupIn(theme.tokens);
  const fgText = fgValue(check, theme, lookup);
  if (fgText === undefined) return undefined;
  const table = resolveColor('var(--argus-bg)', scheme, lookup);
  const bg = resolveColor(`var(${check.bg})`, scheme, lookup);
  const fg = check.compound
    ? colorIn(fgText, scheme, lookup)
    : resolveColor(fgText, scheme, lookup);
  if (!fg || !bg || !table) return undefined;
  // Row colours sit on the table's background.
  const ground = solid(bg, solid(table, { r: 1, g: 1, b: 1, a: 1 }));
  return { fg: solid(fg, ground), bg: ground };
}

export function checkContrast(theme: ParsedTheme): ContrastResult[] {
  const out: ContrastResult[] = [];
  for (const check of CHECKS) {
    if (check.part && partValue(theme.parts, check.part.part, check.part.property) === undefined)
      continue;
    for (const scheme of SCHEMES) {
      const colors = colorsOf(check, theme, scheme);
      if (!colors) {
        out.push({ check, scheme });
        continue;
      }
      const ratio = contrast(colors.fg, colors.bg);
      out.push({ check, scheme, ratio, pass: ratio >= check.min - 1e-6 });
    }
  }
  return out;
}

/**
 * A fix for a failing check: the foreground token (both schemes, the failing
 * one moved in OKLCH lightness until it passes). Undefined for checks on part
 * rules and on compound values other than the focus ring.
 */
export function fixFor(
  result: ContrastResult,
  theme: ParsedTheme,
): { token: string; value: Value } | undefined {
  const { check } = result;
  if (check.part || result.pass !== false) return undefined;
  const lookup = lookupIn(theme.tokens);
  const current = lookup(check.fg);
  if (current === undefined) return undefined;
  const pair: Record<SchemeName, string> = {
    light: isScheme(current) ? current.light : current,
    dark: isScheme(current) ? current.dark : current,
  };
  const colors = colorsOf(check, theme, result.scheme);
  if (!colors) return undefined;
  const fixed = formatColor(ensureContrast(colors.fg, colors.bg, check.min + 0.05));
  if (check.compound) {
    // `2px solid <colour>`: keep the width and style, swap the colour.
    const color = colorIn(pair[result.scheme], result.scheme, lookup);
    if (!color) return undefined;
    const prefix =
      /^(.*?\b(?:solid|dashed|dotted|double)\b)/.exec(pair[result.scheme])?.[1] ?? '2px solid';
    const other = result.scheme === 'light' ? 'dark' : 'light';
    const otherColor = colorIn(pair[other], other, lookup);
    if (!otherColor) return undefined;
    const light = result.scheme === 'light' ? fixed : formatColor(otherColor);
    const dark = result.scheme === 'dark' ? fixed : formatColor(otherColor);
    return {
      token: check.fg,
      value: `${prefix} ${light === dark ? light : `light-dark(${light}, ${dark})`}`,
    };
  }
  const otherScheme = result.scheme === 'light' ? 'dark' : 'light';
  const otherColor = resolveColor(pair[otherScheme], otherScheme, lookup);
  const keep = otherColor ? formatColor(otherColor) : pair[otherScheme];
  return {
    token: check.fg,
    value: result.scheme === 'light' ? { light: fixed, dark: keep } : { light: keep, dark: fixed },
  };
}

/**
 * A fix for the sorted header (a part rule in the accent colour): the accent
 * seed with the failing scheme's colour moved until it passes on the header.
 */
export function fixAccent(
  result: ContrastResult,
  theme: ParsedTheme,
  accent: Scheme,
): Scheme | undefined {
  if (result.check.id !== 'sorted' || result.pass !== false) return undefined;
  const colors = colorsOf(result.check, theme, result.scheme);
  const current = parseColor(accent[result.scheme]);
  if (!colors || !current) return undefined;
  const fixed = formatColor(ensureContrast(current, colors.bg, result.check.min + 0.05));
  return { ...accent, [result.scheme]: fixed };
}
