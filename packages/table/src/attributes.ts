import type { ComplexAttributeConverter } from 'lit';

// Boolean attributes on every element read `"false"` as off (ADR 0004), unlike
// Lit's `type: Boolean`, where any value, `"false"` too, means on.

/**
 * Boolean attribute with a default that may be `true`: absent → unset (the
 * default applies), `"false"` → `false`, anything else → `true`.
 * @internal
 */
export const flagConverter: ComplexAttributeConverter<boolean | undefined> = {
  fromAttribute(value) {
    return value === null ? undefined : value.trim().toLowerCase() !== 'false';
  },
};

/**
 * Boolean attribute that is off by default: absent or `"false"` → `false`,
 * anything else (`""` too) → `true`.
 * @internal
 */
export const switchConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value) {
    return value !== null && value.trim().toLowerCase() !== 'false';
  },
};
