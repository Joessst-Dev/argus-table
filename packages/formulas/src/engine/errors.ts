/** The error values a formula can produce, as spreadsheets show them. */
export type FormulaErrorCode =
  '#DIV/0!' | '#VALUE!' | '#REF!' | '#NAME?' | '#NUM!' | '#N/A' | '#CYCLE!' | '#ERROR!';

/**
 * An error as a cell value: it flows through the formula like any other value
 * (most operators and functions pass it on) and the cell shows its `code`.
 */
export class FormulaError {
  constructor(
    readonly code: FormulaErrorCode,
    /** Says what went wrong, in a sentence (the cell's tooltip). */
    readonly message: string,
  ) {
    Object.freeze(this);
  }

  toString(): string {
    return this.code;
  }
}

export function isFormulaError(value: unknown): value is FormulaError {
  return value instanceof FormulaError;
}

export const DIV0 = new FormulaError('#DIV/0!', 'Division by zero.');
export const VALUE = new FormulaError('#VALUE!', 'A value has the wrong type.');
export const NUM = new FormulaError('#NUM!', 'The number is out of range.');

/** A formula that can't be read: the message points at the bad part through `start` and `end`. */
export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    /** Offset of the first character of the bad part. */
    readonly start: number,
    /** Offset after the last character of the bad part. */
    readonly end: number,
  ) {
    super(message);
    this.name = 'FormulaSyntaxError';
  }
}
