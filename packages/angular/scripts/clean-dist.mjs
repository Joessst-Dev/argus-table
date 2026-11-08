// ng-packagr writes a package.json (and LICENSE) into dist/ for publishing from
// there. This package publishes from its own folder, with its own exports map,
// so drop the copies: the nested manifest still holds `workspace:*`.
import { rmSync } from 'node:fs';

rmSync(new URL('../dist/package.json', import.meta.url));
rmSync(new URL('../dist/LICENSE', import.meta.url), { force: true });
