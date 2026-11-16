import type { ComplexAttributeConverter } from 'lit';

// Boolean attributes on every element read `"false"` as off (ADR 0004), unlike
// Lit's `type: Boolean`, where any value, `"false"` too, means on.

const on = (value: string) => value.trim().toLowerCase() !== 'false';

/**
 * Boolean attribute with a default that may be `true`: absent → unset (the
 * default applies), `"false"` → `false`, anything else → `true`.
 * @internal
 */
export const flagConverter: ComplexAttributeConverter<boolean | undefined> = {
  fromAttribute(value) {
    return value === null ? undefined : on(value);
  },
};

/**
 * Boolean attribute that is off by default: absent or `"false"` → `false`,
 * anything else (`""` too) → `true`.
 * @internal
 */
export const switchConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value) {
    return value !== null && on(value);
  },
};

/**
 * `row-height`: px (`48` or `48px`) or `auto`; anything else is unset.
 * @internal
 */
export const rowHeightConverter: ComplexAttributeConverter<number | 'auto' | undefined> = {
  fromAttribute(value) {
    if (value === null) return undefined;
    const text = value.trim().toLowerCase();
    if (text === 'auto') return 'auto';
    const px = Number(text.replace(/px$/, ''));
    return text !== '' && px > 0 ? px : undefined;
  },
};
