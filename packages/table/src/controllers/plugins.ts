import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { ArgusPlugin, CellTarget, PluginHost } from '../plugins.js';
import type { ColumnDef, ColumnGroup } from '../types.js';

type Hook = 'connect' | 'cleanup' | 'columns' | 'columnGroups' | 'keydown';

interface Memo<V> {
  input: readonly V[];
  plugins: readonly unknown[];
  version: number;
  output: readonly V[];
}

/**
 * Runs the table's plugins: connects them while the table is connected (in
 * array order, cleaning up in reverse), chains their column transforms, and
 * offers keys to them before the table handles them. A hook that throws is
 * reported and skipped, so a broken plugin can't break the update.
 */
export class PluginController<T> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #api: PluginHost<T>;
  #plugins: readonly ArgusPlugin<T>[] = [];
  /** Connected plugins and their cleanups. */
  readonly #connected = new Map<ArgusPlugin<T>, (() => void) | undefined>();
  /** Plugins whose `connect` threw: off until `plugins` changes. */
  readonly #failed = new Set<ArgusPlugin<T>>();
  #version = 0;
  #memo: Memo<ColumnDef<T>> | undefined;
  #groupsMemo: Memo<ColumnGroup> | undefined;

  constructor(host: ReactiveControllerHost & HTMLElement, api: PluginHost<T>) {
    this.#host = host;
    this.#api = api;
    host.addController(this);
  }

  /** Takes a new plugin list; connects and cleans up to match it if the host is connected. */
  set(plugins: readonly ArgusPlugin<T>[]): void {
    if (plugins === this.#plugins) return;
    this.#plugins = plugins;
    this.#failed.clear();
    if (this.#host.isConnected) this.#sync();
  }

  hostConnected(): void {
    this.#sync();
  }

  hostDisconnected(): void {
    for (const plugin of [...this.#connected.keys()].reverse()) this.#disconnect(plugin);
  }

  /** The plugins' `columns` transforms applied in order; the same array while nothing changed. */
  transform(input: readonly ColumnDef<T>[]): readonly ColumnDef<T>[] {
    const memo = this.#run('columns', input, this.#memo, (plugin, defs) =>
      plugin.columns?.(defs, this.#api),
    );
    this.#memo = memo;
    return memo.output;
  }

  /** The plugins' `columnGroups` transforms applied in order; the same array while nothing changed. */
  transformGroups(input: readonly ColumnGroup[]): readonly ColumnGroup[] {
    const memo = this.#run('columnGroups', input, this.#groupsMemo, (plugin, groups) =>
      plugin.columnGroups?.(groups, this.#api),
    );
    this.#groupsMemo = memo;
    return memo.output;
  }

  #run<V>(
    hook: 'columns' | 'columnGroups',
    input: readonly V[],
    memo: Memo<V> | undefined,
    apply: (plugin: ArgusPlugin<T>, items: readonly V[]) => readonly V[] | undefined,
  ): Memo<V> {
    if (memo?.input === input && memo.plugins === this.#plugins && memo.version === this.#version) {
      return memo;
    }
    let output = input;
    for (const plugin of this.#plugins) {
      if (!plugin[hook] || this.#failed.has(plugin)) continue;
      const before = output;
      const result = this.#guard(plugin, hook, () => apply(plugin, before));
      if (result.ok && result.value) output = result.value;
    }
    // Plugins may return a fresh array each time: keep the old one when its items are the same.
    if (memo && sameItems(memo.output, output)) output = memo.output;
    return { input, plugins: this.#plugins, version: this.#version, output };
  }

  /** Runs the transforms again on the next `transform()`. */
  invalidate(): void {
    this.#version++;
  }

  /** Offers a key to the plugins in order; `true` once one claims it. */
  keydown(event: KeyboardEvent, target: CellTarget): boolean {
    for (const plugin of this.#plugins) {
      if (!plugin.keydown || this.#failed.has(plugin)) continue;
      const result = this.#guard(plugin, 'keydown', () =>
        plugin.keydown?.(event, target, this.#api),
      );
      if (result.ok && result.value === true) return true;
    }
    return false;
  }

  #sync(): void {
    const wanted = new Set(this.#plugins);
    for (const plugin of [...this.#connected.keys()].reverse()) {
      if (!wanted.has(plugin)) this.#disconnect(plugin);
    }
    for (const plugin of this.#plugins) {
      if (this.#connected.has(plugin) || this.#failed.has(plugin)) continue;
      const result = this.#guard(plugin, 'connect', () => plugin.connect?.(this.#api));
      if (result.ok) this.#connected.set(plugin, result.value);
      else this.#failed.add(plugin);
    }
  }

  #disconnect(plugin: ArgusPlugin<T>): void {
    const cleanup = this.#connected.get(plugin);
    this.#connected.delete(plugin);
    if (cleanup) this.#guard(plugin, 'cleanup', cleanup);
  }

  #guard<R>(
    plugin: ArgusPlugin<T>,
    hook: Hook,
    run: () => R,
  ): { ok: true; value: R } | { ok: false } {
    try {
      return { ok: true, value: run() };
    } catch (error) {
      console.error(`argus-table: plugin "${plugin.name}" threw in ${hook}`, error);
      return { ok: false };
    }
  }
}

/** Whether two lists hold the same items in the same order. */
export function sameItems<V>(a: readonly V[], b: readonly V[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}
