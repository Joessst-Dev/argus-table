// Types for draft.mjs (for the argus-table repo's tests; the skill runs the
// script with Node and needs no TypeScript).

export type Value = string | { light: string; dark: string };

export interface Draft {
  v: 1;
  name: string;
  preset: string;
  seeds: Record<string, unknown>;
  overrides: Record<string, Value>;
  parts: Record<string, string | boolean>;
  removedParts: string[];
}

export type FieldSpec =
  | { kind: 'color' }
  | { kind: 'boolean' }
  | { kind: 'string' }
  | { kind: 'enum'; values: string[] }
  | { kind: 'number'; min: number; max: number }
  | { kind: 'density'; min: number; max: number };

export declare const DEFAULT_BASE_URL: string;
export declare const STORY_ID: string;
export declare const HASH_KEY: string;
export declare const PRESETS: string[];
export declare const BASES: string[];
export declare const DENSITIES: string[];
export declare const SEEDS: Record<string, FieldSpec | Record<string, FieldSpec>>;
export declare const PART_OPTIONS: Record<string, FieldSpec>;
export declare const TOKENS: string[];

export declare function validateDraft(input: unknown): {
  draft: Draft | undefined;
  errors: string[];
  warnings: string[];
};
export declare function encodeDraft(draft: Draft): Promise<string>;
export declare function decodeLink(link: string): Promise<unknown>;
export declare function themeLink(draft: Draft, baseUrl?: string): Promise<string>;
