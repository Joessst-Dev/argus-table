// A draft to the theme it describes: the base theme, then the tokens of the
// touched seeds, then per-token overrides; part rules from the base, less the
// removed ones, with the curated part options applied.
import {
  accentText,
  changedPaths,
  deriveTokens,
  readSeeds,
  separatorColor,
  type SeedPath,
} from './derive.js';
import {
  partKey,
  type Density,
  type ParsedTheme,
  type PartOptionName,
  type PartOptions,
  type PartRule,
  type Seeds,
  type ThemeDraft,
  type Value,
} from './model.js';

export type ResolvedTheme = ParsedTheme;

/** The seeds in effect: the base theme's, with the touched ones over them. */
export function effectiveSeeds(draft: Pick<ThemeDraft, 'base' | 'seeds'>): Seeds {
  return { ...readSeeds(draft.base), ...draft.seeds };
}

/** What changed from the base theme's seeds; everything, from a blank start. */
function changeTest(draft: ThemeDraft): (path: SeedPath) => boolean {
  if (draft.preset === 'blank') return (path) => (path.split('.')[0] ?? '') in draft.seeds;
  return changedPaths(draft.seeds, readSeeds(draft.base));
}

interface OptionTarget {
  /** The part whose first rule gets the declarations. */
  part: string;
  /** The selector of a new rule when the base has none for `part`. */
  parts: string[];
  /** The properties the option owns: removed before its declarations go in. */
  properties: string[];
}

interface OptionSpec<K extends PartOptionName> {
  targets: OptionTarget[];
  /** Declarations per target for a value; empty to remove. */
  declarations: (value: PartOptions[K], seeds: Seeds) => [string, string][][];
  /** The option's value as the rules stand. */
  read: (rules: readonly PartRule[]) => PartOptions[K];
  /** Seeds whose change re-applies the option while it's on. */
  follows?: SeedPath[];
}

const HEADER: OptionTarget = {
  part: 'header-cell',
  parts: ['header-cell', 'header-group-cell'],
  properties: [],
};

function ruleOf(rules: readonly PartRule[], part: string): PartRule | undefined {
  return rules.find((r) => r.parts.includes(part));
}

function valueIn(rules: readonly PartRule[], part: string, property: string): string | undefined {
  return ruleOf(rules, part)?.declarations.find(([p]) => p === property)?.[1];
}

const flag =
  (part: string, property: string, test: (v: string) => boolean = () => true) =>
  (rules: readonly PartRule[]) => {
    const value = valueIn(rules, part, property);
    return value !== undefined && test(value);
  };

const OPTIONS: { [K in PartOptionName]: OptionSpec<K> } = {
  headerSize: {
    targets: [{ ...HEADER, properties: ['font-size'] }],
    declarations: (v) => [v ? [['font-size', v]] : []],
    read: (rules) => valueIn(rules, 'header-cell', 'font-size') ?? '',
  },
  headerWeight: {
    targets: [{ ...HEADER, properties: ['font-weight'] }],
    declarations: (v) => [v ? [['font-weight', v]] : []],
    read: (rules) => valueIn(rules, 'header-cell', 'font-weight') ?? '',
  },
  uppercase: {
    targets: [{ ...HEADER, properties: ['text-transform', 'letter-spacing'] }],
    declarations: (v) => [
      v
        ? [
            ['letter-spacing', '0.06em'],
            ['text-transform', 'uppercase'],
          ]
        : [],
    ],
    read: flag('header-cell', 'text-transform', (v) => v === 'uppercase'),
  },
  sortedAccent: {
    targets: [{ part: 'header-cell-sorted', parts: ['header-cell-sorted'], properties: ['color'] }],
    declarations: (v, seeds) => [v ? [['color', accentText(seeds)]] : []],
    read: flag('header-cell-sorted', 'color'),
    follows: ['accent'],
  },
  tabularNums: {
    targets: [{ part: 'cell', parts: ['cell'], properties: ['font-variant-numeric'] }],
    declarations: (v) => [v ? [['font-variant-numeric', 'tabular-nums']] : []],
    read: flag('cell', 'font-variant-numeric', (v) => v.includes('tabular-nums')),
  },
  pinnedBold: {
    targets: [{ part: 'row-pinned', parts: ['row-pinned'], properties: ['font-weight'] }],
    declarations: (v) => [v ? [['font-weight', '600']] : []],
    read: flag('row-pinned', 'font-weight', (v) => Number(v) >= 600 || v === 'bold'),
  },
  pinnedSeparator: {
    targets: [
      { part: 'row-pinned-top', parts: ['row-pinned-top'], properties: ['box-shadow'] },
      { part: 'row-pinned-bottom', parts: ['row-pinned-bottom'], properties: ['box-shadow'] },
    ],
    declarations: (v, seeds) => {
      const line = separatorColor(seeds);
      return v
        ? [[['box-shadow', `0 1px 0 ${line}`]], [['box-shadow', `0 -1px 0 ${line}`]]]
        : [[], []];
    },
    read: flag('row-pinned-bottom', 'box-shadow', (v) => v !== 'none'),
    follows: ['surface', 'text', 'lines.strength'],
  },
  checkboxAccent: {
    targets: [
      { part: 'selection-checkbox', parts: ['selection-checkbox'], properties: ['accent-color'] },
    ],
    declarations: (v, seeds) => [v ? [['accent-color', accentText(seeds)]] : []],
    read: flag('selection-checkbox', 'accent-color'),
    follows: ['accent'],
  },
  skeletonRadius: {
    targets: [{ part: 'skeleton', parts: ['skeleton'], properties: ['border-radius'] }],
    declarations: (v) => [v ? [['border-radius', '4px']] : []],
    read: flag('skeleton', 'border-radius', (v) => Number.parseFloat(v) > 0),
  },
};

export const PART_OPTION_NAMES = Object.keys(OPTIONS) as PartOptionName[];

/** The part options as the base rules stand, before the user's changes. */
export function readPartOptions(rules: readonly PartRule[]): PartOptions {
  const out: Record<string, unknown> = {};
  for (const name of PART_OPTION_NAMES) out[name] = OPTIONS[name].read(rules);
  return out as unknown as PartOptions;
}

/** The parts and properties a part option writes, for marking rules it owns. */
export function optionProperties(name: PartOptionName): { part: string; properties: string[] }[] {
  return OPTIONS[name].targets.map(({ part, properties }) => ({ part, properties }));
}

function applyOption<K extends PartOptionName>(
  rules: PartRule[],
  name: K,
  value: PartOptions[K],
  seeds: Seeds,
): void {
  const spec = OPTIONS[name];
  const all = spec.declarations(value, seeds);
  spec.targets.forEach((target, i) => {
    const declarations = all[i] ?? [];
    let rule = ruleOf(rules, target.part);
    if (rule) {
      rule.declarations = rule.declarations.filter(([p]) => !target.properties.includes(p));
    } else if (declarations.length > 0) {
      rule = { parts: [...target.parts], declarations: [] };
      rules.push(rule);
    }
    rule?.declarations.push(...declarations);
  });
}

export function resolveTheme(draft: ThemeDraft): ResolvedTheme {
  const seeds = effectiveSeeds(draft);
  const changed = changeTest(draft);
  const derived = deriveTokens(seeds, changed);

  const tokens: Record<string, Value> = {
    ...draft.base.tokens,
    ...derived.tokens,
    ...draft.overrides,
  };
  const density: Partial<Record<Density, Record<string, Value>>> = {};
  for (const d of ['compact', 'comfortable', 'spacious'] as const) {
    const block = { ...draft.base.density[d], ...derived.density?.[d] };
    if (Object.keys(block).length > 0) density[d] = block;
  }

  const removed = new Set(draft.removedParts);
  const parts: PartRule[] = draft.base.parts
    .filter((r) => !removed.has(partKey(r)))
    .map((r) => ({ parts: [...r.parts], declarations: r.declarations.map(([p, v]) => [p, v]) }));
  const baseOptions = readPartOptions(draft.base.parts);
  for (const name of PART_OPTION_NAMES) {
    const own = draft.parts[name];
    const follows = OPTIONS[name].follows?.some(changed) ?? false;
    if (own !== undefined) applyOption(parts, name, own, seeds);
    else if (follows && baseOptions[name]) applyOption(parts, name, baseOptions[name], seeds);
  }

  return { tokens, density, parts: parts.filter((r) => r.declarations.length > 0) };
}
