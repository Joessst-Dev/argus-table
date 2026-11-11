// The shipped themes as starting points, read from their source CSS.
import defaultCss from '../../../packages/themes/src/default.css?inline';
import materialCss from '../../../packages/themes/src/material.css?inline';
import fluentCss from '../../../packages/themes/src/fluent.css?inline';
import bootstrapCss from '../../../packages/themes/src/bootstrap.css?inline';
import minimalCss from '../../../packages/themes/src/minimal.css?inline';
import { DEFAULT_SEEDS } from './derive.js';
import {
  emptyTheme,
  type BaseId,
  type ParsedTheme,
  type PresetId,
  type ThemeDraft,
} from './model.js';
import { parseTheme } from './parse.js';

export const PRESET_CSS: Readonly<Record<PresetId, string>> = {
  default: defaultCss,
  material: materialCss,
  fluent: fluentCss,
  bootstrap: bootstrapCss,
  minimal: minimalCss,
};

export const BASE_LABELS: Readonly<Record<BaseId, string>> = {
  default: 'Default',
  material: 'Material-inspired',
  fluent: 'Fluent-inspired',
  bootstrap: 'Bootstrap-inspired',
  minimal: 'Minimal',
  blank: 'Blank (seeds only)',
  imported: 'Imported CSS',
};

export const isPreset = (id: string): id is PresetId => id in PRESET_CSS;

const cache = new Map<PresetId, ParsedTheme>();

export function presetTheme(id: PresetId): ParsedTheme {
  let theme = cache.get(id);
  if (!theme) {
    theme = parseTheme(PRESET_CSS[id]).theme;
    cache.set(id, theme);
  }
  return structuredClone(theme);
}

/** A fresh draft from a preset, or a blank one with every seed set. */
export function newDraft(
  base: Exclude<BaseId, 'imported'> = 'default',
  name = 'My theme',
): ThemeDraft {
  if (base === 'blank')
    return {
      v: 1,
      name,
      preset: 'blank',
      base: emptyTheme(),
      // Every seed touched, so the theme is complete.
      seeds: structuredClone(DEFAULT_SEEDS),
      overrides: {},
      parts: { tabularNums: true, sortedAccent: true, checkboxAccent: true },
      removedParts: [],
    };
  return {
    v: 1,
    name,
    preset: base,
    base: presetTheme(base),
    seeds: {},
    overrides: {},
    parts: {},
    removedParts: [],
  };
}
