import { createWriteStream, promises as fs } from 'fs';
import { join, relative, sep } from 'path';
import { deflateRaw } from 'zlib';
import { promisify } from 'util';

const deflate = promisify(deflateRaw);

/* CRC-32 (IEEE) — required by the ZIP format. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time pair used by the ZIP headers. */
function dosStamp(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2)),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export interface ZipResult {
  files: number;
  bytes: number;
  rawBytes: number;
}

/**
 * Dependency-free deflate ZIP writer. Packs every file below `sourceDirs`
 * (each mounted under its own top-level folder inside the archive) into
 * `targetPath`. Files are read and compressed one at a time, so memory stays
 * bounded by the largest single upload.
 */
export async function zipDirectories(
  sourceDirs: { name: string; path: string }[],
  targetPath: string,
): Promise<ZipResult> {
  const stream = createWriteStream(targetPath);
  const write = (buf: Buffer) =>
    new Promise<void>((res, rej) => {
      stream.write(buf, (err) => (err ? rej(err) : res()));
    });

  let offset = 0;
  let rawBytes = 0;
  const central: Buffer[] = [];
  let count = 0;

  for (const source of sourceDirs) {
    const files = await walk(source.path);
    for (const file of files) {
      const stat = await fs.stat(file);
      const content = await fs.readFile(file);
      const compressed = await deflate(content);
      const nameInZip = [source.name, ...relative(source.path, file).split(sep)].join('/');
      const name = Buffer.from(nameInZip, 'utf8');
      const crc = crc32(content);
      const { time, date } = dosStamp(stat.mtime);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4); // version needed
      local.writeUInt16LE(0x0800, 6); // UTF-8 names
      local.writeUInt16LE(8, 8); // deflate
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(compressed.length, 18);
      local.writeUInt32LE(content.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);

      await write(local);
      await write(name);
      await write(compressed);

      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(20, 4);
      entry.writeUInt16LE(20, 6);
      entry.writeUInt16LE(0x0800, 8);
      entry.writeUInt16LE(8, 10);
      entry.writeUInt16LE(time, 12);
      entry.writeUInt16LE(date, 14);
      entry.writeUInt32LE(crc, 16);
      entry.writeUInt32LE(compressed.length, 20);
      entry.writeUInt32LE(content.length, 24);
      entry.writeUInt16LE(name.length, 28);
      entry.writeUInt16LE(0, 30); // extra
      entry.writeUInt16LE(0, 32); // comment
      entry.writeUInt16LE(0, 34); // disk
      entry.writeUInt16LE(0, 36); // internal attrs
      entry.writeUInt32LE(0, 38); // external attrs
      entry.writeUInt32LE(offset, 42);
      central.push(entry, name);

      offset += local.length + name.length + compressed.length;
      rawBytes += content.length;
      count += 1;
    }
  }

  const centralBuf = Buffer.concat(central);
  await write(centralBuf);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  await write(end);

  await new Promise<void>((res, rej) => {
    stream.end((err?: Error | null) => (err ? rej(err) : res()));
  });

  const stat = await fs.stat(targetPath);
  return { files: count, bytes: stat.size, rawBytes };
}
