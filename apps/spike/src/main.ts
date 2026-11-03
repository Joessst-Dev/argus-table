import { makePeople } from './data.js';
import { installBenchHooks } from './bench-hooks.js';
import type { Keying, Variant } from './spike-grid.js';
import './spike-grid.js';

const params = new URLSearchParams(location.search);
const variant: Variant = params.get('variant') === 'slotted' ? 'slotted' : 'shadow';
const rowCount = Number(params.get('rows') ?? 100_000);
const overscan = Number(params.get('overscan') ?? 8);
const keying: Keying = params.get('keying') === 'pool' ? 'pool' : 'row';
document.documentElement.dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr';

const grid = document.createElement('spike-grid');
grid.variant = variant;
grid.overscan = overscan;
grid.keying = keying;
grid.rows = makePeople(rowCount);
document.body.append(grid);

if (params.has('bench')) installBenchHooks(grid);
