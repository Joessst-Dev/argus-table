// The add-on and framework guides: the packages' READMEs, rendered on the site
// as they are (rendered.ts), so they stay one source with npm.
import { firstTitle, type RenderedPage } from './rendered';

export type PackageGroup = 'Add-ons' | 'Frameworks';

/** The READMEs the site renders, in sidebar order: `packages/<id>/README.md`. */
export const PACKAGE_GUIDES: readonly {
  id: string;
  title: string;
  label: string;
  group: PackageGroup;
}[] = [
  { id: 'header-menu', title: 'Header menu add-on', label: 'Header menu', group: 'Add-ons' },
  { id: 'formulas', title: 'Formulas add-on', label: 'Formulas', group: 'Add-ons' },
  { id: 'export', title: 'Export add-on', label: 'Export', group: 'Add-ons' },
  { id: 'editing', title: 'Editing add-on', label: 'Editing', group: 'Add-ons' },
  { id: 'react', title: 'React', label: 'React', group: 'Frameworks' },
  { id: 'vue', title: 'Vue', label: 'Vue', group: 'Frameworks' },
  { id: 'angular', title: 'Angular', label: 'Angular', group: 'Frameworks' },
];

/** The package guides as pages, at `guides/<id>/`; a missing or untitled README throws. */
export function packageGuides(repoRoot: string): (RenderedPage & { group: PackageGroup })[] {
  return PACKAGE_GUIDES.map((guide) => {
    const file = `packages/${guide.id}/README.md`;
    firstTitle(repoRoot, file);
    return { ...guide, file, path: `guides/${guide.id}/` };
  });
}
