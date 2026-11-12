import { describe, expect, it } from 'vitest';
import { formatColor, luminance } from './color.js';
import { checkContrast, fixAccent, fixFor } from './contrast.js';
import { lookupIn, resolveColor, systemColor } from './values.js';
import { emptyTheme } from './model.js';
import { newDraft } from './presets.js';
import { resolveTheme } from './resolve.js';
import { decodeDraft, encodeDraft, fromStored, hashDraft, loadDraft, saveDraft } from './share.js';

describe('system colours', () => {
  it('are this browser’s Canvas and CanvasText', () => {
    const lookup = lookupIn({});
    const light = resolveColor('Canvas', 'light', lookup);
    const dark = resolveColor('Canvas', 'dark', lookup);
    expect(light && formatColor(light)).toBe('#ffffff');
    // Dark Canvas differs per engine, but it is dark.
    expect(dark && luminance(dark)).toBeLessThan(0.05);
    expect(systemColor('canvastext', 'dark')).toMatch(/^#[0-9a-f]{6}$/);
    const text = resolveColor('CanvasText', 'dark', lookup);
    expect(text && luminance(text)).toBeGreaterThan(0.8);
  });
});

describe('checkContrast', () => {
  it('passes the shipped default theme’s text', () => {
    const results = checkContrast(resolveTheme(newDraft('default')));
    const body = results.filter((r) => r.check.id === 'body');
    expect(body.map((r) => r.pass)).toEqual([true, true]);
  });

  it('flags a failing pair and fixes it', () => {
    const theme = {
      ...emptyTheme(),
      tokens: { '--argus-bg': '#ffffff', '--argus-fg': { light: '#bbbbbb', dark: '#eeeeee' } },
    };
    const failing = checkContrast(theme).find((r) => r.check.id === 'body' && r.scheme === 'light');
    expect(failing?.pass).toBe(false);
    if (!failing) return;
    const fix = fixFor(failing, theme);
    expect(fix?.token).toBe('--argus-fg');
    const fixed = { ...theme, tokens: { ...theme.tokens, [fix?.token ?? '']: fix?.value ?? '' } };
    const again = checkContrast(fixed).find((r) => r.check.id === 'body' && r.scheme === 'light');
    expect(again?.pass).toBe(true);
    // The other scheme keeps its colour.
    expect(fix?.value).toMatchObject({ dark: '#eeeeee' });
  });

  it('fixes the focus ring inside its shorthand', () => {
    const theme = {
      ...emptyTheme(),
      tokens: {
        '--argus-bg': '#ffffff',
        '--argus-focus-ring': '2px solid light-dark(#dddddd, #ffffff)',
      },
    };
    const failing = checkContrast(theme).find(
      (r) => r.check.id === 'focus' && r.scheme === 'light',
    );
    expect(failing?.pass).toBe(false);
    if (!failing) return;
    const fix = fixFor(failing, theme);
    expect(fix?.value).toMatch(/^2px solid light-dark\(#[0-9a-f]{6}, #ffffff\)$/);
  });

  it('fixes the sorted header through the accent', () => {
    const accent = { light: '#9ab0f0', dark: '#8aa6f2' };
    const theme = {
      ...emptyTheme(),
      tokens: { '--argus-bg': '#ffffff', '--argus-header-bg': '#f6f7f9' },
      parts: [
        {
          parts: ['header-cell-sorted'],
          declarations: [['color', '#9ab0f0']] as [string, string][],
        },
      ],
    };
    const failing = checkContrast(theme).find(
      (r) => r.check.id === 'sorted' && r.scheme === 'light',
    );
    expect(failing?.pass).toBe(false);
    if (!failing) return;
    expect(fixFor(failing, theme)).toBeUndefined();
    const fixed = fixAccent(failing, theme, accent);
    expect(fixed?.dark).toBe('#8aa6f2');
    const again = {
      ...theme,
      parts: [
        {
          parts: ['header-cell-sorted'],
          declarations: [['color', fixed?.light ?? '']] as [string, string][],
        },
      ],
    };
    expect(
      checkContrast(again).find((r) => r.check.id === 'sorted' && r.scheme === 'light')?.pass,
    ).toBe(true);
  });

  it('marks what it cannot resolve as not checked', () => {
    const theme = {
      ...emptyTheme(),
      tokens: { '--argus-bg': '#fff', '--argus-focus-ring': '2px solid Highlight' },
    };
    const focus = checkContrast(theme).filter((r) => r.check.id === 'focus');
    expect(focus.every((r) => r.ratio === undefined && r.pass === undefined)).toBe(true);
  });
});

describe('share', () => {
  it('round-trips a draft through a link', async () => {
    const draft = {
      ...newDraft('fluent', 'Ocean'),
      seeds: { accent: { light: '#0a7d5a', dark: '#5fd3a8' } },
      overrides: { '--argus-border-radius': '6px' },
    };
    const encoded = await encodeDraft(draft);
    expect(encoded).toMatch(/^[\w-]+$/);
    expect(await decodeDraft(encoded)).toEqual(draft);
    expect(hashDraft(`https://example.com/iframe.html?id=x#theme=${encoded}`)).toBe(encoded);
  });

  it('keeps an imported base in the link', async () => {
    const draft = {
      ...newDraft('default'),
      preset: 'imported' as const,
      base: { ...emptyTheme(), tokens: { '--argus-bg': '#123456' } },
    };
    expect(await decodeDraft(await encodeDraft(draft))).toEqual(draft);
  });

  it('ignores a broken link', async () => {
    expect(await decodeDraft('not-a-theme')).toBeUndefined();
    expect(fromStored({ v: 2 })).toBeUndefined();
    expect(fromStored(null)).toBeUndefined();
  });

  it('saves and loads a draft', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    } as unknown as Storage;
    const draft = { ...newDraft('minimal'), parts: { uppercase: false } };
    saveDraft(draft, storage);
    expect(loadDraft(storage)).toEqual(draft);
  });
});
