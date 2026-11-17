// Storybook's URLs from before the docs site replaced it, mapped to their new
// pages: manager URLs (`?path=/docs/<id>`, `?path=/story/<id>`) land on the
// home page, story frames (`iframe.html?id=<id>`, which theme-creator links
// open) on the static iframe.html. Both run `oldUrlTarget` inline, serialized
// from here, so it uses nothing but its arguments.

/**
 * Storybook title ids (the title kebab-cased: `Features/Auto width` →
 * `features-auto-width`) → site paths, without the base.
 */
export const STORYBOOK_PAGES: Readonly<Record<string, string>> = {
  'getting-started': 'getting-started/',
  api: 'api/',
  benchmarks: 'guides/performance/',
  'features-rendering': 'getting-started/',
  'features-auto-width': 'features/auto-width/',
  'features-column-groups': 'features/column-groups/',
  'features-column-pinning-and-visibility': 'features/column-visibility/',
  'features-column-reorder': 'features/column-reorder/',
  'features-column-virtualization': 'features/column-virtualization/',
  'features-declarative-columns': 'features/declarative-columns/',
  'features-density': 'features/density/',
  'features-filtering': 'features/filtering/',
  'features-infinite-loading': 'features/infinite-loading/',
  'features-keyboard': 'features/keyboard/',
  'features-labels': 'features/labels/',
  'features-pinned-columns': 'features/pinned-columns/',
  'features-pinned-rows': 'features/pinned-rows/',
  'features-resizing': 'features/resizing/',
  'features-row-height': 'features/row-height/',
  'features-row-selection': 'features/selection/',
  'features-saved-state': 'features/saved-state/',
  'features-scrolling': 'features/scrolling/',
  'features-sorting': 'features/sorting/',
  'add-ons-editing': 'features/editing/',
  'add-ons-export': 'features/export/',
  'add-ons-formulas': 'features/formulas/',
  'add-ons-header-menu': 'features/header-menu/',
  'styling-parts': 'features/styling/',
  'styling-tokens': 'features/styling/',
  'styling-slotted-content': 'features/styling/',
  'styling-tailwind-recipe': 'guides/tailwind/',
  'themes-default': 'themes/default/',
  'themes-material-inspired': 'themes/material/',
  'themes-fluent-inspired': 'themes/fluent/',
  'themes-bootstrap-inspired': 'themes/bootstrap/',
  'themes-minimal': 'themes/minimal/',
  'themes-theme-creator': 'themes/creator/',
  'recipes-react': 'guides/react/',
  'recipes-vue': 'guides/vue/',
  'recipes-angular': 'guides/angular/',
};

/**
 * The new URL of an old Storybook URL: the title's page, or the home page for
 * a title it doesn't know, with the hash kept (`#theme=` for creator links).
 * `undefined` for a URL that isn't Storybook's: no redirect.
 */
export function oldUrlTarget(
  href: string,
  base: string,
  pages: Readonly<Record<string, string>>,
): string | undefined {
  const url = new URL(href);
  let id: string | null = null;
  const path = url.searchParams.get('path');
  if (path !== null) {
    id = /^\/(?:docs|story)\/([^/]+)/.exec(path)?.[1] ?? null;
  } else if (url.pathname.endsWith('/iframe.html')) {
    id = url.searchParams.get('id');
  }
  if (id === null) return undefined;
  const title = id.split('--')[0] ?? '';
  const page = Object.prototype.hasOwnProperty.call(pages, title) ? pages[title] : '';
  return `${base}/${page ?? ''}${url.hash}`;
}

/** The inline script that sends an old Storybook URL on to its page. */
export function redirectScript(base: string): string {
  const pages = JSON.stringify(STORYBOOK_PAGES);
  return `(() => {
  const target = (${oldUrlTarget.toString()})(location.href, ${JSON.stringify(base)}, ${pages});
  if (target !== undefined) location.replace(target);
})();`;
}
