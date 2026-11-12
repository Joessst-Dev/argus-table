import { date } from './date.js';
import { logic } from './logic.js';
import { lookup } from './lookup.js';
import { math } from './math.js';
import { text } from './text.js';
import type { FunctionTable } from './types.js';

export type { FunctionDef, FunctionTable, ValueType } from './types.js';

/** Every built-in function, by upper-case name. */
export const BUILTINS: FunctionTable = { ...math, ...logic, ...text, ...date, ...lookup };
