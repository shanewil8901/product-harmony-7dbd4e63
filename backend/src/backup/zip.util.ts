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
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
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
  encrypted: boolean;
}

/** Legacy PKWARE (ZipCrypto) stream cipher — understood by every unzip tool. */
class ZipCrypto {
  private k0 = 0x12345678;
  private k1 = 0x23456789;
  private k2 = 0x34567890;

  constructor(password: string) {
    for (const byte of Buffer.from(password, 'utf8')) this.update(byte);
  }

  private update(byte: number) {
    this.k0 = (CRC_TABLE[(this.k0 ^ byte) & 0xff] ^ (this.k0 >>> 8)) >>> 0;
    this.k1 = (this.k1 + (this.k0 & 0xff)) >>> 0;
    this.k1 = (Math.imul(this.k1, 134775813) + 1) >>> 0;
    this.k2 = (CRC_TABLE[(this.k2 ^ (this.k1 >>> 24)) & 0xff] ^ (this.k2 >>> 8)) >>> 0;
  }

  private streamByte(): number {
    const temp = (this.k2 | 2) & 0xffff;
    return (Math.imul(temp, temp ^ 1) >>> 8) & 0xff;
  }

  encrypt(buf: Buffer): Buffer {
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i += 1) {
      const plain = buf[i];
      out[i] = plain ^ this.streamByte();
      this.update(plain);
    }
    return out;
  }
}

/** 12-byte encryption header; its last byte must match the CRC high byte. */
function encryptEntry(data: Buffer, password: string, crc: number): Buffer {
  const cipher = new ZipCrypto(password);
  const header = Buffer.alloc(12);
  for (let i = 0; i < 11; i += 1) header[i] = Math.floor(Math.random() * 256);
  header[11] = (crc >>> 24) & 0xff;
  return Buffer.concat([cipher.encrypt(header), cipher.encrypt(data)]);
}

/**
 * Dependency-free deflate ZIP writer. Packs every file below `sourceDirs`
 * (each mounted under its own top-level folder inside the archive) into
 * `targetPath`. When `password` is supplied every entry is encrypted with
 * ZipCrypto. Files are read one at a time, so memory stays bounded by the
 * largest single upload.
 */
export async function zipDirectories(
  sourceDirs: { name: string; path: string }[],
  targetPath: string,
  password?: string,
): Promise<ZipResult> {
  const stream = createWriteStream(targetPath);
  const write = (buf: Buffer) =>
    new Promise<void>((res, rej) => {
      stream.write(buf, (err) => (err ? rej(err) : res()));
    });

  const secret = password && password.length ? password : undefined;
  const flags = 0x0800 | (secret ? 0x0001 : 0);

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
      const nameInZip = [source.name, ...relative(source.path, file).split(sep)]
        .filter(Boolean)
        .join('/');
      const name = Buffer.from(nameInZip, 'utf8');
      const crc = crc32(content);
      const { time, date } = dosStamp(stat.mtime);
      const payload = secret ? encryptEntry(compressed, secret, crc) : compressed;

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4); // version needed
      local.writeUInt16LE(flags, 6);
      local.writeUInt16LE(8, 8); // deflate
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(payload.length, 18);
      local.writeUInt32LE(content.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);

      await write(local);
      await write(name);
      await write(payload);

      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(20, 4);
      entry.writeUInt16LE(20, 6);
      entry.writeUInt16LE(flags, 8);
      entry.writeUInt16LE(8, 10);
      entry.writeUInt16LE(time, 12);
      entry.writeUInt16LE(date, 14);
      entry.writeUInt32LE(crc, 16);
      entry.writeUInt32LE(payload.length, 20);
      entry.writeUInt32LE(content.length, 24);
      entry.writeUInt16LE(name.length, 28);
      entry.writeUInt16LE(0, 30); // extra
      entry.writeUInt16LE(0, 32); // comment
      entry.writeUInt16LE(0, 34); // disk
      entry.writeUInt16LE(0, 36); // internal attrs
      entry.writeUInt32LE(0, 38); // external attrs
      entry.writeUInt32LE(offset, 42);
      central.push(entry, name);

      offset += local.length + name.length + payload.length;
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
    stream.on('error', rej);
    stream.end(() => res());
  });

  const stat = await fs.stat(targetPath);
  return { files: count, bytes: stat.size, rawBytes, encrypted: Boolean(secret) };
}
