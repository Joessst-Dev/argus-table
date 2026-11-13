// Events an add-on fires on <argus-table>, which the wrappers bind like the
// table's own. The add-ons aren't dependencies of the wrappers, so each wrapper
// writes the detail types itself, with its own content type, in the module
// named by `from` (relative to the generated file).
import type { Tag } from './manifest.ts';

export interface AddonEvent {
  /** The DOM event name, e.g. `argus-formula-column-add`. */
  name: string;
  /** The event type, as in `@fires {…}`; the types it names come from `from`. */
  type: string;
  description: string;
  /** The wrapper's module with the types, e.g. `../formula-events.js`. */
  from: string;
}

const FORMULAS = '../formula-events.js';
const APPLY =
  "The table doesn't change its columns: set `columns` to `detail.columns` to apply it. `detail: { column, columns }`";

export const ADDON_EVENTS: Readonly<Partial<Record<Tag, readonly AddonEvent[]>>> = {
  'argus-table': [
    {
      name: 'argus-formula-column-add',
      type: 'CustomEvent<FormulaColumnDetail<T>>',
      description: `From \`formulas()\` (\`@argus-table/formulas\`): the formula editor proposes a new formula column. ${APPLY}.`,
      from: FORMULAS,
    },
    {
      name: 'argus-formula-column-change',
      type: 'CustomEvent<FormulaColumnChangeDetail<T>>',
      description: `From \`formulas()\` (\`@argus-table/formulas\`): the formula editor proposes a changed formula column (its formula, or a rename). ${APPLY}, and \`previous\`, the column as it was.`,
      from: FORMULAS,
    },
    {
      name: 'argus-formula-column-remove',
      type: 'CustomEvent<FormulaColumnDetail<T>>',
      description: `From \`formulas()\` (\`@argus-table/formulas\`): the formula editor proposes removing a formula column. ${APPLY}.`,
      from: FORMULAS,
    },
  ],
};
