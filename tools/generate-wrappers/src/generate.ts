import { format, resolveConfig } from 'prettier';
import { readElements, type Manifest } from './manifest.ts';
import { emitReact } from './react.ts';
import { emitVue } from './vue.ts';

export const FRAMEWORKS = ['react', 'vue'] as const;
export type Framework = (typeof FRAMEWORKS)[number];

const EMITTERS: Readonly<Record<Framework, typeof emitReact>> = {
  react: emitReact,
  vue: emitVue,
};

/**
 * The formatted source of a framework's generated module. `outFile` is where it
 * goes; Prettier reads its options for that path, so the output matches the repo.
 */
export async function generate(
  framework: Framework,
  manifest: Manifest,
  outFile: string,
): Promise<string> {
  const source = EMITTERS[framework](readElements(manifest));
  const options = await resolveConfig(outFile);
  return format(source, { ...options, filepath: outFile });
}
