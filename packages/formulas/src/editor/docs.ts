/** How the editor describes a function: its arguments (`[name]` is optional, `…` repeats) and what it gives. */
export interface FunctionDoc {
  group: 'Math' | 'Logic' | 'Text' | 'Date' | 'Yours';
  params: readonly string[];
  description: string;
}

const doc = (
  group: FunctionDoc['group'],
  params: readonly string[],
  description: string,
): FunctionDoc => ({ group, params, description });

/** The built-in functions, as the editor's hints and function list show them. */
export const DOCS: Readonly<Record<string, FunctionDoc>> = {
  SUM: doc('Math', ['value', '…'], 'Adds the values; empty ones are skipped.'),
  MIN: doc('Math', ['value', '…'], 'The smallest of the values; empty ones are skipped.'),
  MAX: doc('Math', ['value', '…'], 'The largest of the values; empty ones are skipped.'),
  AVERAGE: doc('Math', ['value', '…'], 'The mean of the values; empty ones are skipped.'),
  ROUND: doc(
    'Math',
    ['value', '[digits]'],
    'Rounds a number to the given number of decimal places.',
  ),
  ROUNDUP: doc('Math', ['value', '[digits]'], 'Rounds a number away from zero.'),
  ROUNDDOWN: doc('Math', ['value', '[digits]'], 'Rounds a number toward zero.'),
  ABS: doc('Math', ['value'], 'The number without its sign.'),
  INT: doc('Math', ['value'], 'Rounds a number down to a whole number.'),
  MOD: doc(
    'Math',
    ['value', 'divisor'],
    'The remainder after division, with the sign of the divisor.',
  ),
  POWER: doc('Math', ['base', 'exponent'], 'A number raised to a power.'),
  SQRT: doc('Math', ['value'], 'The square root of a number.'),
  IF: doc(
    'Logic',
    ['condition', 'then', '[else]'],
    'One value if the condition is true, another if not.',
  ),
  IFS: doc('Logic', ['condition', 'value', '…'], 'The value of the first condition that is true.'),
  AND: doc('Logic', ['condition', '…'], 'TRUE if every condition is true.'),
  OR: doc('Logic', ['condition', '…'], 'TRUE if any condition is true.'),
  NOT: doc('Logic', ['condition'], 'TRUE if the condition is false.'),
  IFERROR: doc(
    'Logic',
    ['value', 'fallback'],
    'The value, or the fallback if the value is an error.',
  ),
  ISBLANK: doc('Logic', ['value'], 'TRUE if the value is empty.'),
  CONCAT: doc('Text', ['text', '…'], 'Joins the texts together.'),
  LEFT: doc('Text', ['text', '[count]'], 'The first characters of a text.'),
  RIGHT: doc('Text', ['text', '[count]'], 'The last characters of a text.'),
  MID: doc(
    'Text',
    ['text', 'start', 'count'],
    'Characters from the middle of a text, counting from 1.',
  ),
  LEN: doc('Text', ['text'], 'The number of characters in a text.'),
  UPPER: doc('Text', ['text'], 'The text in upper case.'),
  LOWER: doc('Text', ['text'], 'The text in lower case.'),
  TRIM: doc('Text', ['text'], 'The text without extra spaces.'),
  TEXT: doc(
    'Text',
    ['value', 'pattern'],
    'A number or date as text, such as "0.00" or "yyyy-mm-dd".',
  ),
  TODAY: doc('Date', [], 'Today’s date.'),
  YEAR: doc('Date', ['date'], 'The year of a date.'),
  MONTH: doc('Date', ['date'], 'The month of a date, 1 to 12.'),
  DAY: doc('Date', ['date'], 'The day of the month of a date.'),
  DAYS: doc('Date', ['end', 'start'], 'The number of days from the start date to the end date.'),
  DATEDIF: doc(
    'Date',
    ['start', 'end', 'unit'],
    'The time between two dates in "Y", "M", "D", "YM", "MD" or "YD".',
  ),
};
