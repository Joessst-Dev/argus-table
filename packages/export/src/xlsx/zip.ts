import { compress, concat, type Bytes } from '../compress.js';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

/** The CRC-32 a zip entry carries (IEEE polynomial). */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A file to put in a zip. */
export interface ZipEntry {
  /** Its path in the archive, ASCII, `/` between folders. */
  name: string;
  data: Bytes;
}

// 1980-01-01 00:00 in DOS format, so the same input makes the same bytes.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/**
 * A zip archive of the entries: each one deflated, or stored when deflating
 * doesn't make it smaller. No zip64: an archive is limited to 4 GB.
 */
export async function zip(entries: readonly ZipEntry[]): Promise<Bytes> {
  const encoder = new TextEncoder();
  const parts: Bytes[] = [];
  const central: Bytes[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const deflated = await compress(entry.data, 'deflate-raw');
    const stored = deflated.length >= entry.data.length;
    const body = stored ? entry.data : deflated;
    const header = (size: number, signature: number) => {
      const bytes = new Uint8Array(size + name.length);
      const view = new DataView(bytes.buffer);
      view.setUint32(0, signature, true);
      bytes.set(name, size);
      return { bytes, view };
    };
    // The fields both headers share, at their own offsets.
    const common = (view: DataView, at: number) => {
      view.setUint16(at, 20, true); // version needed: 2.0
      view.setUint16(at + 4, stored ? 0 : 8, true);
      view.setUint16(at + 6, DOS_TIME, true);
      view.setUint16(at + 8, DOS_DATE, true);
      view.setUint32(at + 10, crc, true);
      view.setUint32(at + 14, body.length, true);
      view.setUint32(at + 18, entry.data.length, true);
      view.setUint16(at + 22, name.length, true);
    };
    const local = header(30, 0x04034b50);
    common(local.view, 4);
    const dir = header(46, 0x02014b50);
    dir.view.setUint16(4, 20, true); // version made by
    common(dir.view, 6);
    dir.view.setUint32(42, offset, true);
    parts.push(local.bytes, body);
    central.push(dir.bytes);
    offset += local.bytes.length + body.length;
    if (offset > 0xffffffff) throw new RangeError('argus-table export: the file is over 4 GB.');
  }
  const directory = concat(central);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, directory.length, true);
  view.setUint32(16, offset, true);
  return concat([...parts, directory, end]);
}
