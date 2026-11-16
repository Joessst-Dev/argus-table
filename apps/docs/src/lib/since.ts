/** A release badge: "Since 1.3", or "Coming in 1.4" for a release still to come. */
export interface ReleaseBadge {
  text: string;
  upcoming: boolean;
}

/**
 * The badge for something added in `since` (`<major>.<minor>`), given the
 * version last released (`packages/table/package.json`, which changes only at a
 * release). Versions compare as numbers: 1.10 is after 1.9.
 */
export function releaseBadge(since: string, released: string): ReleaseBadge {
  const [major = 0, minor = 0] = since.split('.').map(Number);
  const [relMajor = 0, relMinor = 0] = released.split('.').map(Number);
  const upcoming = major > relMajor || (major === relMajor && minor > relMinor);
  return { text: `${upcoming ? 'Coming in' : 'Since'} ${since}`, upcoming };
}
