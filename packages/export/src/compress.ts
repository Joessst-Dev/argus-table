/** Bytes as the writers make them. */
export type Bytes = Uint8Array<ArrayBuffer>;

/**
 * Compresses bytes with the platform's `CompressionStream`: `deflate-raw` for a
 * zip entry, `deflate` (zlib) for a PDF stream.
 */
export async function compress(data: Bytes, format: 'deflate' | 'deflate-raw'): Promise<Bytes> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Joins byte arrays into one. */
export function concat(parts: readonly Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
