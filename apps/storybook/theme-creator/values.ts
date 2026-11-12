// Resolving token values to colours in one scheme: light-dark() picks a side,
// var() follows the token chain (the element's own fallbacks for tokens a
// theme leaves out), and the system colours Canvas and CanvasText become
// what this browser draws them as. What can't be resolved stays undefined,
// never a guess.
import { formatColor, parseColor, type Rgb } from './color.js';
import { splitTopLevel } from './parse.js';
import { inScheme, type SchemeName, type Value } from './model.js';

/**
 * The element's and add-ons' fallbacks for tokens a theme leaves out, as CSS
 * (from packages/table/src/styles/base.ts and the add-ons' READMEs).
 */
export const FALLBACKS: Readonly<Record<string, string>> = {
  '--argus-bg': 'Canvas',
  '--argus-fg': 'CanvasText',
  '--argus-header-bg': 'light-dark(#f9fafb, #111827)',
  '--argus-header-fg': 'var(--argus-fg)',
  '--argus-border-color': 'light-dark(#e5e7eb, #374151)',
  '--argus-border-width': '1px',
  '--argus-border': 'none',
  '--argus-border-radius': '0',
  '--argus-row-odd-bg': 'var(--argus-bg)',
  '--argus-row-hover-bg': 'var(--argus-row-odd-bg)',
  '--argus-row-selected-bg': 'color-mix(in srgb, Highlight 22%, var(--argus-bg))',
  '--argus-row-pinned-bg': 'var(--argus-bg)',
  '--argus-resize-handle-color': 'light-dark(#9ca3af, #6b7280)',
  '--argus-drop-indicator-color': 'Highlight',
  '--argus-focus-ring': '2px solid Highlight',
  '--argus-filter-indicator-color': 'var(--argus-header-fg)',
  '--argus-skeleton-bg': 'color-mix(in srgb, var(--argus-fg) 12%, transparent)',
  '--argus-menu-bg': 'var(--argus-bg)',
  '--argus-menu-fg': 'var(--argus-fg)',
  '--argus-menu-item-active-bg':
    'color-mix(in srgb, var(--argus-menu-fg) 10%, var(--argus-menu-bg))',
  '--argus-dialog-bg': 'var(--argus-menu-bg)',
  '--argus-dialog-fg': 'var(--argus-menu-fg)',
  '--argus-dialog-accent': 'Highlight',
  '--argus-dialog-accent-fg': 'HighlightText',
};

const systemColors = new Map<string, string>();

/**
 * `Canvas` or `CanvasText` in `scheme`, as this browser draws them (dark
 * Canvas is #121212 in Chromium, #1c1b22 in Firefox): read once from a probe
 * element with that color-scheme. Other system colours follow the user's
 * settings, so they stay unresolved.
 */
export function systemColor(name: 'canvas' | 'canvastext', scheme: SchemeName): string {
  const key = `${name} ${scheme}`;
  let color = systemColors.get(key);
  if (color === undefined) {
    const probe = document.createElement('span');
    probe.style.colorScheme = scheme;
    probe.style.color = name;
    probe.style.display = 'none';
    document.body.append(probe);
    const computed = parseColor(getComputedStyle(probe).color);
    probe.remove();
    color = computed ? formatColor(computed) : name;
    systemColors.set(key, color);
  }
  return color;
}

/** Calls `replace` with the arguments of each `name(…)` in `text`, innermost last. */
function replaceCalls(
  text: string,
  name: string,
  replace: (args: string[]) => string | undefined,
): string | undefined {
  let out = text;
  for (;;) {
    const start = out.toLowerCase().indexOf(`${name}(`);
    if (start === -1) return out;
    let depth = 0;
    let end = -1;
    for (let i = start + name.length; i < out.length; i++) {
      if (out[i] === '(') depth++;
      else if (out[i] === ')' && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) return undefined;
    const args = splitTopLevel(out.slice(start + name.length + 1, end), ',');
    const replacement = replace(args);
    if (replacement === undefined) return undefined;
    out = out.slice(0, start) + replacement + out.slice(end + 1);
  }
}

/** A lookup of token values: the theme's, then the fallbacks. */
export type Lookup = (name: string) => Value | undefined;

export function lookupIn(tokens: Readonly<Record<string, Value>>): Lookup {
  return (name) => {
    const value = tokens[name];
    // `initial` makes the element use its own fallback.
    if (value === undefined || value === 'initial') return FALLBACKS[name];
    return value;
  };
}

/** `value` in `scheme` with every var() and light-dark() replaced. */
export function substitute(
  value: string,
  scheme: SchemeName,
  lookup: Lookup,
  depth = 0,
): string | undefined {
  if (depth > 12) return undefined;
  const withVars = replaceCalls(value, 'var', ([name = '', fallback]) => {
    const found = lookup(name);
    const text = found === undefined ? fallback : inScheme(found, scheme);
    return text === undefined ? undefined : substitute(text, scheme, lookup, depth + 1);
  });
  if (withVars === undefined) return undefined;
  const picked = replaceCalls(withVars, 'light-dark', ([light, dark]) =>
    scheme === 'light' ? light : dark,
  );
  if (picked === undefined) return undefined;
  return picked.replace(/\b(canvastext|canvas)\b/gi, (word) =>
    systemColor(word.toLowerCase() as 'canvas' | 'canvastext', scheme),
  );
}

/** A token's colour in `scheme`, or undefined when it can't be told. */
export function resolveColor(value: string, scheme: SchemeName, lookup: Lookup): Rgb | undefined {
  const text = substitute(value, scheme, lookup);
  return text === undefined ? undefined : parseColor(text);
}

/** The colour inside a compound value such as `2px solid #abc` or a shadow. */
export function colorIn(value: string, scheme: SchemeName, lookup: Lookup): Rgb | undefined {
  const text = substitute(value, scheme, lookup);
  if (text === undefined) return undefined;
  for (const word of splitTopLevel(text, ' ')) {
    if (/^-?[\d.]/.test(word)) continue;
    const color = parseColor(word);
    if (color) return color;
  }
  return undefined;
}

/** `light-dark(a, b)` from two colours, or one colour when they match. */
export function pairText(light: Rgb, dark: Rgb): string {
  const a = formatColor(light);
  const b = formatColor(dark);
  return a === b ? a : `light-dark(${a}, ${b})`;
}
