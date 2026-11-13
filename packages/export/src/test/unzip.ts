/** Reads a zip's entries through its central directory, inflating deflated ones. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  if (view.getUint32(end, true) !== 0x06054b50) throw new Error('no end of central directory');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('bad central header');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error('bad local header');
    const localName = view.getUint16(offset + 26, true);
    const localExtra = view.getUint16(offset + 28, true);
    const start = offset + 30 + localName + localExtra;
    const body = bytes.slice(start, start + size);
    const data = method === 0 ? body : await inflate(body, 'deflate-raw');
    files.set(name, decoder.decode(data));
    at += 46 + nameLength;
  }
  return files;
}

/** Inflates bytes with the platform's `DecompressionStream`. */
export async function inflate(
  bytes: Uint8Array<ArrayBuffer>,
  format: 'deflate' | 'deflate-raw',
): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
