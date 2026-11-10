/** What a formula, or part of one, evaluates to, as far as is known without data. */
export type ValueType = 'number' | 'text' | 'boolean' | 'date' | 'unknown';

/** A function formulas can call, as the engine sees it. */
export interface FunctionDef {
  /** Fewest arguments. */
  min: number;
  /** Most arguments (`Infinity` for any number). */
  max: number;
  /** The result type, for alignment. */
  returns: ValueType;
  /**
   * For functions that return one of their arguments (`IF`, `IFERROR`, `IFS`):
   * the positions of those arguments, given the argument count. The result type
   * is theirs when they agree.
   */
  branches?: (count: number) => number[];
  /**
   * Gets the argument values. If one of them is an error, the call returns it
   * without running `fn`.
   */
  fn?: (...args: unknown[]) => unknown;
  /**
   * Gets the arguments unevaluated and evaluates only those it needs: for
   * short-circuits and functions that look at errors (`IF`, `IFERROR`, `ISBLANK`).
   */
  lazy?: (args: readonly (() => unknown)[]) => unknown;
}

export type FunctionTable = Readonly<Record<string, FunctionDef>>;
