// Fails the build if anything in dist/ still refers to the private
// @argus-table/core package: it is bundled and never published, so an import
// of it would break for every consumer. publint and attw don't catch this
// because core is a devDependency that resolves inside the workspace.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRIVATE = /from\s*['"]@argus-table\/core['"]|import\(\s*['"]@argus-table\/core['"]\s*\)/;
const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(js|d\.ts)$/.test(entry.name) && PRIVATE.test(readFileSync(path, 'utf8'))) {
      offenders.push(path);
    }
  }
}

walk('dist');
if (offenders.length > 0) {
  console.error(`These files import the private @argus-table/core:\n  ${offenders.join('\n  ')}`);
  process.exit(1);
}
console.log('dist/ has no import of @argus-table/core.');
