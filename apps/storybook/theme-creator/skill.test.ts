// The argus-table-theme agent skill (skills/argus-table-theme) writes drafts
// and links for this creator without importing it: these tests keep its
// script and references in step with the creator.
import { describe, expect, it } from 'vitest';
import {
  BASES,
  PART_OPTIONS,
  PRESETS,
  SEEDS,
  TOKENS as SKILL_TOKENS,
  decodeLink,
  themeLink,
  validateDraft,
} from '../../../skills/argus-table-theme/scripts/draft.mjs';
import draftFormat from '../../../skills/argus-table-theme/references/draft-format.md?raw';
import tokensDoc from '../../../skills/argus-table-theme/references/tokens.md?raw';
import { TOKENS } from './catalog.js';
import { DEFAULT_SEEDS, autoDarkAccent, autoText, readSeeds } from './derive.js';
import { SEED_NAMES, type Seeds } from './model.js';
import { PRESET_CSS, newDraft, presetTheme } from './presets.js';
import { PART_OPTION_NAMES } from './resolve.js';
import { decodeDraft, fromStored, hashDraft, shareLink } from './share.js';

const valid = (input: unknown) => {
  const { draft, errors } = validateDraft(input);
  expect(errors).toEqual([]);
  if (!draft) throw new Error('no draft');
  return draft;
};

describe('the skill’s draft script', () => {
  it('knows the creator’s presets, seeds, part options and tokens', () => {
    expect(PRESETS).toEqual(Object.keys(PRESET_CSS));
    expect(BASES).toEqual([...Object.keys(PRESET_CSS), 'blank']);
    expect(Object.keys(SEEDS)).toEqual([...SEED_NAMES]);
    for (const name of SEED_NAMES) {
      const spec = SEEDS[name] ?? {};
      const fields = 'kind' in spec ? ['light', 'dark'] : Object.keys(spec);
      expect(fields, name).toEqual(Object.keys(DEFAULT_SEEDS[name]));
    }
    expect(Object.keys(PART_OPTIONS).sort()).toEqual([...PART_OPTION_NAMES].sort());
    expect([...SKILL_TOKENS].sort()).toEqual(TOKENS.map((t) => t.name).sort());
  });

  it('accepts the seeds of every preset', () => {
    for (const preset of Object.keys(PRESET_CSS)) {
      const seeds = readSeeds(presetTheme(preset as keyof typeof PRESET_CSS));
      valid({ preset, seeds });
    }
    valid({ preset: 'blank', seeds: DEFAULT_SEEDS });
  });

  it('makes the link the creator makes', async () => {
    const draft = valid({ name: 'Acme', preset: 'fluent' });
    const docs = 'https://joessst-dev.github.io/argus-table/iframe.html?id=x&viewMode=story';
    const creator = await shareLink(newDraft('fluent', 'Acme'), { href: docs } as Location);
    const skill = await themeLink(draft);
    expect(skill.split('#')[0]).toBe(creator.split('#')[0]);
    const local = await themeLink(draft, 'http://localhost:6006');
    expect(local.split('#')[0]).toBe(
      'http://localhost:6006/iframe.html?id=themes-theme-creator--creator&viewMode=story',
    );
  });

  it('writes drafts the creator reads, and reads the creator’s links', async () => {
    const draft = valid({
      name: 'Acme',
      preset: 'material',
      seeds: { accent: { light: '#e4572e', dark: '#ff8a65' }, lines: { radius: 4 } },
      parts: { uppercase: true },
      overrides: { '--argus-header-fg': { light: '#5b2a1a', dark: '#f6c9b9' } },
    });
    const opened = await decodeDraft(hashDraft(await themeLink(draft)) ?? '');
    const base = readSeeds(presetTheme('material'));
    expect(opened).toMatchObject({
      name: 'Acme',
      preset: 'material',
      seeds: {
        accent: { light: '#e4572e', dark: '#ff8a65' },
        lines: { ...base.lines, radius: 4 },
      },
      parts: { uppercase: true },
      overrides: { '--argus-header-fg': { light: '#5b2a1a', dark: '#f6c9b9' } },
    });
    expect(opened?.base).toEqual(presetTheme('material'));

    const theirs = { ...newDraft('minimal', 'Night'), overrides: { '--argus-bg': '#000000' } };
    const decoded = await decodeLink(
      await shareLink(theirs, { href: 'https://x.test/' } as Location),
    );
    expect(decoded).toMatchObject({
      name: 'Night',
      preset: 'minimal',
      overrides: theirs.overrides,
    });
    expect(validateDraft(decoded).errors).toEqual([]);
  });

  it('names the problems in a draft', () => {
    const { draft, errors } = validateDraft({
      preset: 'fluid',
      seeds: {
        accent: '#ff0000',
        surface: { light: 'var(--bg)' },
        header: { style: 'loud', strenght: 5 },
        rows: { height: { comfy: 40, compact: 4 } },
      },
      parts: { uppercase: 'yes', bold: true },
      overrides: { bg: 'red', '--argus-fg': 'red; color: blue' },
      extra: 1,
    });
    expect(draft).toBeUndefined();
    expect(errors).toEqual([
      'extra: unknown key (known: v, name, preset, seeds, overrides, parts, removedParts)',
      expect.stringContaining('preset: unknown base "fluid"'),
      expect.stringContaining('seeds.accent: expected { "light": colour'),
      expect.stringContaining('seeds.surface.light: expected a plain CSS colour'),
      expect.stringContaining('seeds.header.style: expected one of'),
      expect.stringContaining('seeds.header.strenght: unknown field'),
      expect.stringContaining('seeds.rows.height.comfy: unknown density'),
      'seeds.rows.height.compact: 4 is outside 20–120',
      'parts.uppercase: expected true or false',
      expect.stringContaining('parts.bold: unknown part option'),
      'overrides.bg: unknown token (did you mean "--argus-bg"?)',
      expect.stringContaining("overrides.--argus-fg: a value can't hold"),
    ]);
  });
});

describe('a draft written by hand or by an agent', () => {
  it('gets touched seeds completed from the base', () => {
    const base = readSeeds(presetTheme('fluent'));
    const draft = fromStored({
      v: 1,
      preset: 'fluent',
      seeds: { header: { style: 'accent' }, rows: { height: { comfortable: 48 } } },
    });
    expect(draft?.seeds).toEqual({
      header: { ...base.header, style: 'accent' },
      rows: { ...base.rows, height: { ...base.rows.height, comfortable: 48 } },
    });
  });

  it('gets a dark side for a light-only colour', () => {
    const base = readSeeds(presetTheme('default'));
    const draft = fromStored({
      v: 1,
      preset: 'default',
      seeds: { accent: { light: '#e4572e' }, text: { light: '#202020' } },
    });
    expect(draft?.seeds.accent).toEqual({
      light: '#e4572e',
      dark: autoDarkAccent('#e4572e', base.surface.dark),
    });
    expect(draft?.seeds.text).toEqual({ light: '#202020', dark: autoText(base.surface.dark) });
    // A dark surface given with it is the one the dark side is picked for.
    const onSurface = fromStored({
      v: 1,
      preset: 'default',
      seeds: { accent: { light: '#e4572e' }, surface: { light: '#ffffff', dark: '#301010' } },
    });
    expect(onSurface?.seeds.accent?.dark).toBe(autoDarkAccent('#e4572e', '#301010'));
  });

  it('keeps the base’s light colour for a dark-only one', () => {
    const base = readSeeds(presetTheme('fluent'));
    valid({ preset: 'fluent', seeds: { surface: { dark: '#0b1220' } } });
    const draft = fromStored({ v: 1, preset: 'fluent', seeds: { surface: { dark: '#0b1220' } } });
    expect(draft?.seeds.surface).toEqual({ light: base.surface.light, dark: '#0b1220' });
  });

  it('leaves out what isn’t a draft’s', () => {
    const base = readSeeds(presetTheme('default'));
    const draft = fromStored({
      v: 1,
      preset: 'default',
      seeds: {
        loud: true,
        header: { style: 'shouting', strength: '50', muted: true },
        accent: { light: 'not a colour', dark: '#8aa6f2' },
      },
      parts: { uppercase: 'yes', tabularNums: true, bold: true },
      overrides: { color: 'red', '--argus-bg': { light: '#fff' }, '--argus-fg': '#111' },
    });
    expect(draft?.seeds).toEqual({
      header: { ...base.header, muted: true },
      accent: { light: base.accent.light, dark: '#8aa6f2' },
    } satisfies Partial<Seeds>);
    expect(draft?.parts).toEqual({ tabularNums: true });
    expect(draft?.overrides).toEqual({ '--argus-fg': '#111' });
  });

  it('starts a blank draft without a base from the default seeds', () => {
    const draft = fromStored({ v: 1, preset: 'blank', seeds: { lines: { radius: 6 } } });
    expect(draft?.base).toEqual({ tokens: {}, density: {}, parts: [] });
    expect(draft?.seeds).toEqual({
      ...DEFAULT_SEEDS,
      lines: { ...DEFAULT_SEEDS.lines, radius: 6 },
    });
    expect(draft?.parts).toEqual(newDraft('blank').parts);
  });

  it('keeps a draft the creator wrote as it was', () => {
    const draft = {
      ...newDraft('bootstrap', 'Mine'),
      seeds: {
        ...readSeeds(presetTheme('bootstrap')),
        lines: { strength: 60, width: 2, outline: true, radius: 6 },
      },
      parts: { uppercase: true, headerSize: '0.75rem' },
    };
    expect(fromStored(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
    const blank = newDraft('blank');
    expect(fromStored(JSON.parse(JSON.stringify(blank)))).toEqual(blank);
  });
});

describe('the skill’s references', () => {
  it('describe every seed field, part option and preset', () => {
    for (const name of SEED_NAMES)
      for (const field of Object.keys(DEFAULT_SEEDS[name]))
        expect(draftFormat, `${name}.${field}`).toContain(`\`${name}.${field}`);
    for (const name of PART_OPTION_NAMES) expect(draftFormat, name).toContain(`| \`${name}\``);
    for (const preset of [...Object.keys(PRESET_CSS), 'blank'])
      expect(draftFormat, preset).toContain(`| \`${preset}\``);
  });

  it('give the presets’ colours', () => {
    const rows = draftFormat.split('\n');
    for (const preset of ['material', 'fluent', 'bootstrap', 'minimal'] as const) {
      const seeds = readSeeds(presetTheme(preset));
      const pairs = (['surface', 'text', 'accent'] as const).map(
        (name) => `\`${seeds[name].light}\` / \`${seeds[name].dark}\``,
      );
      const row = rows.find((r) => r.startsWith(`| \`${preset}\``) && r.includes(' / '));
      expect(row, preset).toBeDefined();
      for (const pair of pairs) expect(row, preset).toContain(pair);
    }
    // The default theme's surface and text are system colours.
    const accent = readSeeds(presetTheme('default')).accent;
    const row = rows.find((r) => r.startsWith('| `default`') && r.includes(' / '));
    expect(row).toMatch(/`Canvas` \(system\).*`CanvasText` \(system\)/);
    expect(row).toContain(`\`${accent.light}\` / \`${accent.dark}\``);
  });

  it('list every token and no other', () => {
    const listed = [...tokensDoc.matchAll(/^\| `(--argus-[\w-]+)`/gm)].map((m) => m[1]);
    expect(listed.sort()).toEqual(TOKENS.map((t) => t.name).sort());
  });
});
