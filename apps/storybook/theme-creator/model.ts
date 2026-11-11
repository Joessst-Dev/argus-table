// The theme creator's state: a draft is a base theme (a shipped preset or
// imported CSS), the seeds the user touched, per-token overrides and the
// curated part options the user touched. Everything else is derived.

export type SchemeName = 'light' | 'dark';
export const SCHEMES: readonly SchemeName[] = ['light', 'dark'];

/** A value for each colour scheme; written as `light-dark(light, dark)`. */
export interface Scheme {
  light: string;
  dark: string;
}

/** A token or declaration value: the same in both schemes, or one per scheme. */
export type Value = string | Scheme;

export type Density = 'compact' | 'comfortable' | 'spacious';
export const DENSITIES: readonly Density[] = ['compact', 'comfortable', 'spacious'];

/** A `::part()` rule on `argus-table`: one or more parts sharing declarations. */
export interface PartRule {
  /** The parts of the selector list, in order: `['header-cell', 'header-group-cell']`. */
  parts: string[];
  /** Declarations in order; values as written (they may hold `light-dark()`). */
  declarations: [property: string, value: string][];
}

/** A theme stylesheet, read into what the creator can edit. */
export interface ParsedTheme {
  /** Tokens set on `argus-table` itself. */
  tokens: Record<string, Value>;
  /** Tokens set on `argus-table[density='…']`. */
  density: Partial<Record<Density, Record<string, Value>>>;
  parts: PartRule[];
}

export type PresetId = 'default' | 'material' | 'fluent' | 'bootstrap' | 'minimal';
export type BaseId = PresetId | 'blank' | 'imported';

export interface Seeds {
  /** The accent: focus ring, resize handle, indicators, selection, sorted header. */
  accent: Scheme;
  /** The table's background. */
  surface: Scheme;
  /** The text colour. */
  text: Scheme;
  header: {
    /** `body`: the header sits on the body colour; `tinted`: a step towards the text colour; `accent`: towards the accent. */
    style: 'body' | 'tinted' | 'accent';
    /** 0–100. */
    strength: number;
    /** Header text a step towards the background. */
    muted: boolean;
  };
  lines: {
    /** Border contrast, 0–100. */
    strength: number;
    /** px */
    width: number;
    /** A border around the whole table. */
    outline: boolean;
    /** Corner radius in px. */
    radius: number;
  };
  rows: {
    stripes: boolean;
    hover: boolean;
    /** Row height per density, px. */
    height: Record<Density, number>;
    /** Inline cell padding per density, px. */
    padding: Record<Density, number>;
  };
  type: {
    /** Font family stack; empty inherits the page's font. */
    family: string;
    /** Font size (any CSS length); empty keeps the page's size. */
    size: string;
    weight: string;
    /** Monospace stack for formulas and menu details. */
    mono: string;
  };
  depth: {
    /** Shadow on pinned columns, 0 (none) – 100. */
    pinned: number;
    /** Shadow under menus and dialogs, 0 – 100. */
    popover: number;
  };
}

export type SeedName = keyof Seeds;
export const SEED_NAMES: readonly SeedName[] = [
  'accent',
  'surface',
  'text',
  'header',
  'lines',
  'rows',
  'type',
  'depth',
];

/** Curated `::part()` options. `undefined` (not in the draft) keeps the base theme's rules. */
export interface PartOptions {
  /** Header label size, any CSS font-size; empty: none. */
  headerSize: string;
  /** Header label weight; empty: none. */
  headerWeight: string;
  /** Small uppercase labels with letter spacing. */
  uppercase: boolean;
  /** The sorted column's header in the accent colour. */
  sortedAccent: boolean;
  /** Numbers line up (`font-variant-numeric: tabular-nums`). */
  tabularNums: boolean;
  /** Pinned rows in bold. */
  pinnedBold: boolean;
  /** A line between pinned rows and the body. */
  pinnedSeparator: boolean;
  /** Selection checkboxes in the accent colour. */
  checkboxAccent: boolean;
  /** Rounded skeleton bars. */
  skeletonRadius: boolean;
}

export type PartOptionName = keyof PartOptions;

export interface ThemeDraft {
  v: 1;
  name: string;
  preset: BaseId;
  /** The preset or imported theme everything starts from. */
  base: ParsedTheme;
  /** Only the seeds the user changed; the rest are read from `base`. */
  seeds: Partial<Seeds>;
  /** Per-token values that win over the base and the seeds. */
  overrides: Record<string, Value>;
  /** Only the part options the user changed. */
  parts: Partial<PartOptions>;
  /** Base part rules the user removed, by `partKey()`. */
  removedParts: string[];
}

export const emptyTheme = (): ParsedTheme => ({ tokens: {}, density: {}, parts: [] });

export const partKey = (rule: Pick<PartRule, 'parts'>): string => rule.parts.join(', ');

export const isScheme = (value: Value | undefined): value is Scheme => typeof value === 'object';

/** The value in one scheme. */
export const inScheme = (value: Value, scheme: SchemeName): string =>
  typeof value === 'string' ? value : value[scheme];

/** Collapses a pair with equal sides to one string. */
export const simplify = (value: Value): Value =>
  isScheme(value) && value.light === value.dark ? value.light : value;

export const sameValue = (a: Value | undefined, b: Value | undefined): boolean =>
  JSON.stringify(a === undefined ? a : simplify(a)) ===
  JSON.stringify(b === undefined ? b : simplify(b));

/** The file name for a draft: its name in kebab case. */
export function fileName(draft: Pick<ThemeDraft, 'name'>): string {
  const slug = draft.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'argus-theme'}.css`;
}
