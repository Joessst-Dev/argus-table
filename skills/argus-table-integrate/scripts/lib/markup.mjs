// Reading tags, attributes, array literals and object keys out of source
// text without a parser: enough to find a table's bindings and its columns.

/**
 * Finds opening tags named `name` (`ArgusTable`, `argus-table`) and reads
 * their attributes. Works for JSX, Vue, Angular, Svelte and HTML.
 */
export function findTags(src, name) {
  const tags = [];
  // A JSX generic may follow the name: <ArgusTable<Order> …>.
  const re = new RegExp(`<${name.replace(/[-.]/g, '\\$&')}(?=[\\s/>]|<)`, 'g');
  for (const m of src.matchAll(re)) {
    const start = m.index ?? 0;
    let at = start + m[0].length;
    if (src[at] === '<') {
      const close = genericEnd(src, at);
      if (close === -1) continue;
      at = close + 1;
    }
    const parsed = readAttributes(src, at);
    if (!parsed) continue;
    tags.push({
      name,
      start,
      end: parsed.end,
      attrs: parsed.attrs,
      selfClosing: parsed.selfClosing,
    });
  }
  return tags;
}

/** The index of the `>` closing a type argument list that opens at `open`, or -1. */
function genericEnd(src, open) {
  let depth = 0;
  for (let i = open; i < src.length && i < open + 200; i++) {
    if (src[i] === '<') depth++;
    else if (src[i] === '>' && src[i - 1] !== '=' && --depth === 0) return i;
    else if (src[i] === '\n' || src[i] === ';') return -1;
  }
  return -1;
}

/** Reads attributes from `i` to the end of the opening tag. */
function readAttributes(src, i) {
  const attrs = [];
  const n = src.length;
  while (i < n) {
    while (i < n && /\s/.test(src[i])) i++;
    if (src[i] === '>') return { attrs, end: i + 1, selfClosing: false };
    if (src[i] === '/' && src[i + 1] === '>') return { attrs, end: i + 2, selfClosing: true };
    if (src[i] === '{') {
      // JSX spread: {...props}
      const close = matchBracket(src, i);
      if (close === -1) return undefined;
      attrs.push({
        raw: src.slice(i, close + 1),
        name: '{...}',
        kind: 'spread',
        value: src.slice(i + 1, close),
        index: i,
      });
      i = close + 1;
      continue;
    }
    const start = i;
    // Angular names hold brackets and parens: [(x)], (x), [attr.x], *ngIf, #ref.
    while (i < n && !/[\s=>]/.test(src[i]) && !(src[i] === '/' && src[i + 1] === '>')) i++;
    const rawName = src.slice(start, i);
    if (!rawName) return undefined;
    let value;
    let quoted = false;
    let braced = false;
    while (i < n && /\s/.test(src[i])) i++;
    if (src[i] === '=') {
      i++;
      while (i < n && /\s/.test(src[i])) i++;
      const q = src[i];
      if (q === '"' || q === "'") {
        const close = src.indexOf(q, i + 1);
        if (close === -1) return undefined;
        value = src.slice(i + 1, close);
        quoted = true;
        i = close + 1;
      } else if (q === '{') {
        const close = matchBracket(src, i);
        if (close === -1) return undefined;
        value = src.slice(i + 1, close);
        braced = true;
        i = close + 1;
      } else {
        const vs = i;
        while (i < n && !/[\s>]/.test(src[i])) i++;
        value = src.slice(vs, i);
      }
    }
    attrs.push({
      ...classify(rawName, value, quoted, braced),
      raw: src.slice(start, i),
      index: start,
    });
  }
  return undefined;
}

/**
 * What an attribute is: `static` (a plain attribute), `bound` (a JS value:
 * JSX braces, Vue `:x`, Angular `[x]`), `event` (`onX`, `@x`, `(x)`),
 * `twoWay` (`v-model:x`, `[(x)]`) or `directive`.
 */
function classify(rawName, value, quoted, braced) {
  let m;
  if ((m = /^\[\((.+)\)\]$/.exec(rawName))) return { kind: 'twoWay', name: m[1], value };
  if ((m = /^v-model:(.+)$/.exec(rawName))) return { kind: 'twoWay', name: m[1], value };
  if (rawName === 'v-model') return { kind: 'twoWay', name: 'modelValue', value };
  if ((m = /^\[(.+)\]$/.exec(rawName))) return { kind: 'bound', name: m[1], value };
  if ((m = /^\((.+)\)$/.exec(rawName))) return { kind: 'event', name: m[1], value };
  if ((m = /^(?::|v-bind:|\.)(.+)$/.exec(rawName))) return { kind: 'bound', name: m[1], value };
  if (rawName === 'v-bind') return { kind: 'spread', name: '{...}', value };
  if ((m = /^(?:@|v-on:)(.+)$/.exec(rawName)))
    return { kind: 'event', name: m[1].split('.')[0], value };
  if ((m = /^on:(.+)$/.exec(rawName))) return { kind: 'event', name: m[1], value }; // Svelte
  if (/^(?:v-|\*|#)/.test(rawName)) return { kind: 'directive', name: rawName, value };
  if (braced) {
    if (/^on[A-Z]/.test(rawName)) return { kind: 'event', name: rawName, value, jsx: true };
    return { kind: 'bound', name: rawName, value, jsx: true };
  }
  return { kind: 'static', name: rawName, value: value ?? (quoted ? '' : undefined) };
}

/** The index of the bracket closing the one at `open` (`{`, `[`, `(`), skipping strings; -1 if none. */
export function matchBracket(src, open) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const stack = [pairs[src[open]]];
  let i = open + 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      continue;
    }
    if (c in pairs) stack.push(pairs[c]);
    else if (c === '}' || c === ']' || c === ')') {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Index after the string literal starting at `i`. Template literals skip their `${…}` parts. */
function skipString(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === q) return j + 1;
    if (q !== '`' && c === '\n') return j + 1;
    if (q === '`' && c === '$' && src[j + 1] === '{') {
      const close = matchBracket(src, j + 1);
      j = close === -1 ? src.length : close + 1;
      continue;
    }
    j++;
  }
  return src.length;
}

/**
 * The object literals directly inside an array literal's text (`[ {...}, {...} ]`),
 * with their offsets in it. Spreads and other items are skipped.
 */
export function objectsInArray(arrayText) {
  const items = [];
  let i = arrayText.indexOf('[') + 1;
  if (i <= 0) return items;
  while (i < arrayText.length) {
    const c = arrayText[i];
    if (c === '{') {
      const close = matchBracket(arrayText, i);
      if (close === -1) break;
      items.push({ text: arrayText.slice(i, close + 1), index: i });
      i = close + 1;
    } else if (c === '[' || c === '(') {
      const close = matchBracket(arrayText, i);
      if (close === -1) break;
      i = close + 1;
    } else if (c === '"' || c === "'" || c === '`') {
      i = skipString(arrayText, i);
    } else if (c === ']') {
      break;
    } else {
      i++;
    }
  }
  return items;
}

/** The keys at the top level of an object literal's text, with offsets: `{ a: 1, 'b': 2, c }` → a, b, c. */
export function objectKeys(objectText) {
  const keys = [];
  let i = 1;
  let expectKey = true;
  const n = objectText.length - 1;
  while (i < n) {
    const c = objectText[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === ',') {
      expectKey = true;
      i++;
      continue;
    }
    if (expectKey) {
      if (objectText.startsWith('...', i)) {
        expectKey = false;
        i += 3;
        continue;
      }
      const m = /^(?:(['"])([^'"]+)\1|([A-Za-z_$][\w$]*))\s*(:|,|\(|}|$)/.exec(objectText.slice(i));
      if (m) {
        keys.push({ key: m[2] ?? m[3], index: i });
        // Leave the terminator (`:`, `,`, `(`, `}`) to the loop.
        i += m[0].length - m[4].length;
      }
      // Anything else (a computed `[key]`) is read as a value.
      expectKey = false;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') {
      const close = matchBracket(objectText, i);
      i = close === -1 ? n : close + 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(objectText, i);
      continue;
    }
    i++;
  }
  return keys;
}

/** The text of a top-level key's value in an object literal (`{ filter: 'set' }`, 'filter' → `'set'`). */
export function objectValue(objectText, key) {
  for (const k of objectKeys(objectText)) {
    if (k.key !== key) continue;
    let i = objectText.indexOf(':', k.index);
    if (i === -1) return undefined;
    i++;
    let j = i;
    while (j < objectText.length - 1 && objectText[j] !== ',') {
      const c = objectText[j];
      if (c === '{' || c === '[' || c === '(') {
        const close = matchBracket(objectText, j);
        j = close === -1 ? objectText.length - 1 : close + 1;
      } else if (c === '"' || c === "'" || c === '`') j = skipString(objectText, j);
      else j++;
    }
    return objectText.slice(i, j).trim();
  }
  return undefined;
}

/**
 * Finds where `name` is declared in a file: `const name =`, `let`, `var`, a
 * class field (`readonly name =`, `name: T =`) or a function. Returns the
 * initializer's offset and the declaration's indentation.
 */
export function findDeclaration(src, name) {
  const escaped = name.replace(/[$]/g, '\\$');
  const patterns = [
    new RegExp(
      `(^|\\n)([ \\t]*)(?:export\\s+)?(?:const|let|var)\\s+${escaped}\\b[^=\\n]*?=(?!=|>)`,
      'g',
    ),
    new RegExp(
      `(^|\\n)([ \\t]*)(?:(?:public|private|protected|readonly|static)\\s+)*${escaped}\\s*(?::[^=\\n]+?)?=(?!=|>)`,
      'g',
    ),
    new RegExp(`(^|\\n)([ \\t]*)(?:export\\s+)?(?:async\\s+)?function\\s+${escaped}\\b`, 'g'),
    new RegExp(
      `(^|\\n)([ \\t]*)(?:(?:public|private|protected|static)\\s+)*get\\s+${escaped}\\s*\\(\\s*\\)[^{\\n]*\\{`,
      'g',
    ),
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      const init = (m.index ?? 0) + m[0].length;
      // `columns={columns}`, `columns="…"`: an attribute in markup, not a declaration.
      if (
        re !== patterns[2] &&
        re !== patterns[3] &&
        /[{"']/.test(src[init] ?? '') &&
        !/\s/.test(src[init - 2] ?? '')
      ) {
        continue;
      }
      break;
    }
    if (m) {
      const at = (m.index ?? 0) + m[1].length;
      return {
        index: at,
        indent: m[2].length,
        init: (m.index ?? 0) + m[0].length,
        kind: re === patterns[2] ? 'function' : re === patterns[3] ? 'getter' : 'value',
      };
    }
  }
  return undefined;
}

/** The array literal an initializer starts with (directly, or inside `useMemo(() => [...])`, `computed(...)`, `ref(...)`), or undefined. */
export function arrayAt(src, from) {
  const head = src.slice(from, from + 400);
  const m =
    /^\s*(?:(?:useMemo|useState|useRef|computed|ref|shallowRef|signal|reactive|markRaw|Object\.freeze)\s*(?:<[^>]*>)?\s*\(\s*(?:\(\s*\)\s*=>\s*)?)?(?:\(\s*)?(\[)/.exec(
      head,
    );
  if (!m) return undefined;
  const open = from + (m.index ?? 0) + m[0].length - 1;
  const close = matchBracket(src, open);
  if (close === -1) return undefined;
  return { text: src.slice(open, close + 1), index: open };
}

/** Indexes of the `[` that most closely encloses `index`, or -1. */
export function enclosingArray(src, index) {
  let depth = 0;
  for (let i = index - 1; i >= 0; i--) {
    const c = src[i];
    if (c === ']' || c === ')' || c === '}') depth++;
    else if (c === '[' || c === '(' || c === '{') {
      if (depth === 0) return c === '[' ? i : -1;
      depth--;
    }
  }
  return -1;
}
