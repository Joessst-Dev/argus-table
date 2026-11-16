/** The four ways every feature example is written. */
export type Flavour = 'html' | 'react' | 'vue' | 'angular';

/** In the order the tabs show them. */
export const FLAVOURS: readonly Flavour[] = ['html', 'react', 'vue', 'angular'];

/** One source file of an example, as the page shows it. */
export interface ExampleFile {
  name: string;
  code: string;
  lang: 'html' | 'js' | 'tsx' | 'vue' | 'ts' | 'css';
}

const LANGS: Record<string, ExampleFile['lang']> = {
  html: 'html',
  js: 'js',
  tsx: 'tsx',
  vue: 'vue',
  ts: 'ts',
  css: 'css',
};

/**
 * One example's files by flavour, from raw sources keyed by path
 * (`import.meta.glob` keys such as `/src/examples/sorting/basic/react/Sorting.tsx`).
 * `example` is `<feature>/<example>`. Files are sorted by name, so the HTML
 * flavour shows `index.html` before `main.js`; the feature's shared
 * `data.ts` and `styles.css`, which every flavour imports, come last in each.
 */
export function filesOf(
  raw: Record<string, string>,
  example: string,
): Record<Flavour, ExampleFile[]> {
  const files: Record<Flavour, ExampleFile[]> = { html: [], react: [], vue: [], angular: [] };
  const prefix = `/src/examples/${example}/`;
  for (const [path, code] of Object.entries(raw)) {
    if (!path.startsWith(prefix)) continue;
    const [flavour, name, ...rest] = path.slice(prefix.length).split('/');
    if (!name || rest.length > 0 || !FLAVOURS.includes(flavour as Flavour)) continue;
    const lang = LANGS[name.slice(name.lastIndexOf('.') + 1)];
    if (lang) files[flavour as Flavour].push({ name, code, lang });
  }
  for (const flavour of FLAVOURS) files[flavour].sort((a, b) => a.name.localeCompare(b.name));
  const feature = example.split('/')[0] ?? '';
  const shared: ExampleFile[] = [];
  const data = raw[`/src/examples/${feature}/data.ts`];
  if (data !== undefined) shared.push({ name: 'data.ts', code: data, lang: 'ts' });
  const styles = raw[`/src/examples/${feature}/styles.css`];
  if (styles !== undefined) shared.push({ name: 'styles.css', code: styles, lang: 'css' });
  for (const flavour of FLAVOURS) {
    if (files[flavour].length > 0) files[flavour].push(...shared);
  }
  return files;
}
