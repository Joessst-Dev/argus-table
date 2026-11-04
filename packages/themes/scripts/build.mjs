// Builds every theme in src/ to dist/ with Lightning CSS: nesting is lowered
// and the output is minified. Targets match the supported browsers (the last
// two versions of Chrome, Edge, Firefox and Safari), all of which support
// light-dark(), so Lightning CSS leaves it as is. Nesting is lowered anyway, so
// older CSS tooling in a user's build can read the file.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Features, transform } from 'lightningcss';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const out = join(root, 'dist');

// Lightning CSS encodes versions as major << 16 | minor << 8.
const v = (major, minor = 0) => (major << 16) | (minor << 8);
const targets = { chrome: v(123), firefox: v(120), safari: v(17, 5) };

mkdirSync(out, { recursive: true });
for (const file of readdirSync(src).filter((f) => f.endsWith('.css'))) {
  const { code, warnings } = transform({
    filename: file,
    code: readFileSync(join(src, file)),
    minify: true,
    targets,
    include: Features.Nesting,
  });
  for (const w of warnings) console.warn(`${file}: ${w.message}`);
  writeFileSync(join(out, file), code);
  console.log(`dist/${file}: ${String(code.length)} bytes`);
}
