// Reads a theme stylesheet (nested or flat) into a ParsedTheme through the
// browser's CSS parser. Only what a theme may contain is kept: tokens and
// color-scheme on argus-table, tokens per density, and ::part() rules.
import { PARTS, TOKEN_NAMES } from './catalog.js';
import {
  DENSITIES,
  emptyTheme,
  type Density,
  type ParsedTheme,
  type PartRule,
  type Value,
} from './model.js';

export interface ParseResult {
  theme: ParsedTheme;
  /** What was left out, for the user. */
  warnings: string[];
}

/** Splits on `separator` outside brackets and quotes. */
export function splitTopLevel(text: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === separator && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim());
}

/** `light-dark(a, b)` as a pair; anything else as written. */
export function parseValue(raw: string): Value {
  const text = tidyValue(raw);
  const match = /^light-dark\((.*)\)$/s.exec(text);
  if (match?.[1] !== undefined) {
    const parts = splitTopLevel(match[1], ',');
    if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined)
      return { light: parts[0], dark: parts[1] };
  }
  return text;
}

/**
 * Normalises what CSSOM serialises: `rgb(1, 2, 3)` back to hex, runs of
 * whitespace (multi-line font stacks) to one space.
 */
export function tidyValue(raw: string): string {
  const byte = (n: string) => Number(n).toString(16).padStart(2, '0');
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/g,
      (_, r: string, g: string, b: string, a?: string) =>
        a === undefined || a === '1'
          ? `#${byte(r)}${byte(g)}${byte(b)}`
          : `rgb(${r} ${g} ${b} / ${a})`,
    );
}

/** Declarations of a style rule, shorthands kept (`cssText`, not the longhands). */
function declarationsOf(style: CSSStyleDeclaration): [string, string][] {
  return splitTopLevel(style.cssText, ';')
    .filter((d) => d !== '')
    .map((d) => {
      const colon = d.indexOf(':');
      const property = d.slice(0, colon).trim();
      const value = d
        .slice(colon + 1)
        .replace(/!important\s*$/, '')
        .trim();
      return [property, value];
    });
}

/** Replaces `&` in a nested selector with each of the parent's selectors. */
function nest(parents: string[], selector: string): string[] {
  return splitTopLevel(selector, ',').flatMap((s) => {
    if (parents.length === 0) return [s];
    const relative = s.includes('&') ? s : `& ${s}`;
    return parents.map((p) => relative.replaceAll('&', p));
  });
}

const normalise = (selector: string) =>
  selector
    .replace(/\s+/g, ' ')
    .replace(/"/g, "'")
    .replace(/\[(\w[\w-]*)=([\w-]+)\]/g, "[$1='$2']")
    .trim();

type Target =
  | { kind: 'host' }
  | { kind: 'density'; density: Density }
  | { kind: 'part'; part: string }
  | { kind: 'scheme' }
  | { kind: 'other' };

function classify(selector: string): Target {
  if (selector === 'argus-table') return { kind: 'host' };
  const density = /^argus-table\[density='(\w+)'\]$/.exec(selector)?.[1];
  if (density && (DENSITIES as string[]).includes(density))
    return { kind: 'density', density: density as Density };
  const part = /^argus-table::part\(([\w-]+)\)$/.exec(selector)?.[1];
  if (part) return { kind: 'part', part };
  if (
    /^\[data-argus-theme='(light|dark)'\] argus-table$/.test(selector) ||
    /^argus-table\[data-argus-theme='(light|dark)'\]$/.test(selector)
  )
    return { kind: 'scheme' };
  return { kind: 'other' };
}

export function parseTheme(css: string): ParseResult {
  const theme = emptyTheme();
  const warnings: string[] = [];
  const sheet = new CSSStyleSheet();
  try {
    sheet.replaceSync(css);
  } catch (error) {
    return { theme, warnings: [`The CSS couldn't be read: ${String(error)}`] };
  }

  const setToken = (into: Record<string, Value>, name: string, value: string, where: string) => {
    if (!TOKEN_NAMES.has(name)) {
      warnings.push(`Left out ${name} (${where}): not a documented token.`);
      return;
    }
    into[name] = parseValue(value);
  };

  const styleRule = (selectors: string[], declarations: [string, string][]) => {
    if (declarations.length === 0) return;
    const targets = selectors.map((s) => ({ selector: s, target: classify(normalise(s)) }));
    const parts = targets.filter((t) => t.target.kind === 'part');
    if (parts.length > 0) {
      if (parts.length !== targets.length) {
        warnings.push(`Left out "${selectors.join(', ')}": mixes parts with other selectors.`);
        return;
      }
      const names = parts.map((t) => (t.target.kind === 'part' ? t.target.part : ''));
      const unknown = names.filter((n) => !PARTS.has(n));
      if (unknown.length > 0) {
        warnings.push(`Left out ::part(${unknown.join('), ::part(')}): not a documented part.`);
        return;
      }
      const rule: PartRule = {
        parts: names,
        declarations: declarations.map(([p, v]) => [p, tidyValue(v)]),
      };
      theme.parts.push(rule);
      return;
    }
    for (const { selector, target } of targets) {
      switch (target.kind) {
        case 'host':
          for (const [property, value] of declarations) {
            if (property === 'color-scheme') continue;
            if (property.startsWith('--')) setToken(theme.tokens, property, value, 'argus-table');
            else warnings.push(`Left out ${property} on argus-table: a theme sets tokens only.`);
          }
          break;
        case 'density': {
          const block = (theme.density[target.density] ??= {});
          for (const [property, value] of declarations) {
            if (property.startsWith('--')) setToken(block, property, value, selector);
            else warnings.push(`Left out ${property} on ${selector}: a theme sets tokens only.`);
          }
          break;
        }
        case 'scheme':
          // Written again on export.
          break;
        default:
          warnings.push(`Left out "${selector}": a theme styles argus-table and its parts only.`);
      }
    }
  };

  const walk = (rules: CSSRuleList, parents: string[]) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const selectors = nest(parents, rule.selectorText);
        styleRule(selectors, declarationsOf(rule.style));
        walk(rule.cssRules, selectors);
      } else if (
        'CSSNestedDeclarations' in window &&
        rule instanceof
          (window as unknown as { CSSNestedDeclarations: typeof CSSRule }).CSSNestedDeclarations
      ) {
        styleRule(
          parents,
          declarationsOf((rule as CSSRule & { style: CSSStyleDeclaration }).style),
        );
      } else if (rule instanceof CSSLayerBlockRule) {
        walk(rule.cssRules, parents);
      } else if (rule instanceof CSSLayerStatementRule) {
        // Nothing to keep.
      } else {
        warnings.push(`Left out "${rule.cssText.slice(0, 60)}…": only plain style rules are kept.`);
      }
    }
  };
  walk(sheet.cssRules, []);
  return { theme, warnings };
}
