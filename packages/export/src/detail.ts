import type { ExportDetail } from './collect.js';
import { toValue, type ExportValue } from './sheet.js';

/** A body row of an export and its id, for its detail rows. */
export interface DetailItem<T> {
  row: T;
  rowId: string;
}

/** How many `rows()` calls may be in flight at once. */
const IN_FLIGHT = 6;
/** Rows between yields to the event loop, so a long export doesn't hold the page. */
const YIELD_EVERY = 50;

/**
 * Each item's detail rows as values, by item: `undefined` for items that are
 * `undefined` (pinned rows) or that `expandable` rejects. Calls `detail.rows()`
 * in item order, at most 6 at a time, and rejects when one rejects or `signal`
 * aborts, starting no more calls.
 */
export async function collectDetails<T>(
  items: readonly (DetailItem<T> | undefined)[],
  detail: ExportDetail<T>,
  expandable: ((row: T) => boolean) | undefined,
  signal: AbortSignal | undefined,
): Promise<(ExportValue[][] | undefined)[]> {
  const out: (ExportValue[][] | undefined)[] = new Array<undefined>(items.length).fill(undefined);
  const { columns } = detail;
  const running = new Set<Promise<void>>();
  // The first failure, kept until this loop gets to throw it (no unhandled rejections meanwhile).
  let failed: { error: unknown } | undefined;
  let started = 0;
  // Waiting for rows() calls stops at an abort, even when they ignore the signal.
  const aborted =
    signal &&
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          reject(signal.reason as Error);
        },
        { once: true },
      );
    });
  aborted?.catch(() => undefined);
  const wait = (promise: Promise<unknown>) =>
    aborted ? Promise.race([promise, aborted]) : promise;
  for (let at = 0; at < items.length; at++) {
    const item = items[at];
    if (!item || (expandable && !expandable(item.row))) continue;
    // Every 50 rows the page gets a turn: one loop starts every call, so this holds them all.
    if (++started % YIELD_EVERY === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    if (failed) throw failed.error;
    signal?.throwIfAborted();
    const call: Promise<void> = Promise.resolve()
      .then(() => detail.rows(item.row, { rowId: item.rowId, signal }))
      .then((lines) => {
        out[at] = lines.map((line) =>
          columns.map((c) =>
            toValue(c.value ? c.value(line) : (line as Record<string, unknown> | null)?.[c.id]),
          ),
        );
      })
      .catch((error: unknown) => {
        failed ??= { error };
      })
      .finally(() => {
        running.delete(call);
      });
    running.add(call);
    if (running.size >= IN_FLIGHT) await wait(Promise.race(running));
  }
  await wait(Promise.all(running));
  if (failed) throw failed.error;
  signal?.throwIfAborted();
  return out;
}
