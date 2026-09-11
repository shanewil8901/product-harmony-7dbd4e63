import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createGzip } from 'zlib';
import { createWriteStream, promises as fs } from 'fs';
import { join, resolve } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { DbBackup } from './backup.entity';
import { zipDirectories } from './zip.util';
import { GoogleDriveService } from './gdrive.service';

interface Actor {
  id: string;
  name?: string | null;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  /** Single-flight guard — a dump must never overlap with another dump. */
  private running = false;
  private uploading = false;
  private filesRunning = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(DbBackup) private readonly repo: Repository<DbBackup>,
    private readonly drive: GoogleDriveService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Configuration (environment only)                                    */
  /* ------------------------------------------------------------------ */

  private get dir(): string {
    return resolve(process.env.BACKUP_DIR ?? './backups');
  }

  /** Top-level folders under ./uploads that hold system files. */
  private get uploadDirs() {
    const root = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));
    return ['vendors', 'customers', 'stock', 'employees'].map((name) => ({
      name,
      path: join(root, name),
    }));
  }

  private get retentionDays(): number {
    const n = Number(process.env.BACKUP_RETENTION_DAYS ?? 30);
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  list(limit = 100) {
    return this.repo.find({ order: { created_at: 'DESC' }, take: Math.min(limit, 500) });
  }

  async status() {
    const [last] = await this.repo.find({ order: { created_at: 'DESC' }, take: 1 });
    const localFiles = await this.listLocalFiles();
    const totalBytes = localFiles.reduce((s, f) => s + f.size, 0);
    const [lastFiles] = await this.repo.find({
      where: { kind: 'files' },
      order: { created_at: 'DESC' },
      take: 1,
    });
    return {
      local_dir: this.dir,
      upload_dirs: this.uploadDirs.map((d) => d.path),
      last_files_backup: lastFiles ?? null,
      local_files: localFiles.length,
      local_bytes: totalBytes,
      retention_days: this.retentionDays,
      local_every_minutes: 15,
      drive_configured: this.drive.configured,
      drive_folder_set: Boolean(process.env.GDRIVE_FOLDER_ID),
      last_backup: last ?? null,
      running: this.running,
    };
  }

  /** Manual run — records the user's name in the file name and the log row. */
  async runManual(actor: Actor) {
    return this.run('manual', actor);
  }

  /** Manual files backup — zips every uploaded/generated document. */
  async runFilesManual(actor: Actor) {
    return this.runFiles('manual', actor);
  }

  /** Manual push of a stored backup to Google Drive. */
  async uploadNow(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Backup not found');
    if (row.local_deleted) throw new BadRequestException('Local file has already been purged');
    if (!this.drive.configured)
      throw new BadRequestException('Google Drive credentials are not configured');
    await this.uploadRow(row);
    return this.repo.findOne({ where: { id } });
  }

  async purgeNow() {
    const removed = await this.purgeOldLocalBackups();
    return { removed };
  }

  /* ------------------------------------------------------------------ */
  /* Schedules                                                           */
  /* ------------------------------------------------------------------ */

  /** Local dump every 15 minutes. */
  @Cron('*/15 * * * *', { name: 'db-backup-local' })
  async scheduledLocal() {
    if (process.env.BACKUP_ENABLED === 'false') return;
    try {
      await this.run('scheduled', null);
    } catch (err) {
      this.logger.error(`Scheduled backup failed: ${(err as Error).message}`);
    }
  }

  /** One Google Drive upload per day (02:15 server time by default). */
  @Cron(process.env.BACKUP_GDRIVE_CRON ?? '15 2 * * *', { name: 'db-backup-gdrive' })
  async scheduledDriveUpload() {
    if (process.env.BACKUP_ENABLED === 'false') return;
    if (!this.drive.configured || this.uploading) return;
    this.uploading = true;
    try {
      const [latest] = await this.repo.find({
        where: { status: 'success', local_deleted: false },
        order: { created_at: 'DESC' },
        take: 1,
      });
      if (!latest || latest.drive_status === 'uploaded') return;
      await this.uploadRow(latest);
    } catch (err) {
      this.logger.error(`Daily Drive upload failed: ${(err as Error).message}`);
    } finally {
      this.uploading = false;
    }
  }

  /** One files archive per day (03:15 server time by default). */
  @Cron(process.env.BACKUP_FILES_CRON ?? '15 3 * * *', { name: 'files-backup' })
  async scheduledFiles() {
    if (process.env.BACKUP_ENABLED === 'false') return;
    try {
      const row = await this.runFiles('scheduled', null);
      if (this.drive.configured && row.status === 'success') await this.uploadRow(row);
    } catch (err) {
      this.logger.error(`Scheduled files backup failed: ${(err as Error).message}`);
    }
  }

  /** Nightly sweep of local files older than the retention window. */
  @Cron('45 3 * * *', { name: 'db-backup-purge' })
  async scheduledPurge() {
    if (process.env.BACKUP_ENABLED === 'false') return;
    try {
      const removed = await this.purgeOldLocalBackups();
      if (removed.length) this.logger.log(`Purged ${removed.length} expired local backup(s)`);
    } catch (err) {
      this.logger.error(`Backup purge failed: ${(err as Error).message}`);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Core                                                                */
  /* ------------------------------------------------------------------ */

  private async run(trigger: 'scheduled' | 'manual', actor: Actor | null) {
    if (this.running) throw new BadRequestException('A backup is already running');
    this.running = true;
    const started = Date.now();
    await fs.mkdir(this.dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', 'Z');
    const who = actor?.name ? `_by-${this.slug(actor.name)}` : '';
    const filename = `erp-backup_${stamp}${who}.sql.gz`;
    const filePath = join(this.dir, filename);

    try {
      const { sql, tables } = await this.dumpSql();
      await pipeline(Readable.from([sql]), createGzip(), createWriteStream(filePath));
      const stat = await fs.stat(filePath);

      const row = this.repo.create({
        filename,
        file_path: filePath,
        kind: 'database',
        trigger,
        status: 'success',
        size_bytes: String(stat.size),
        table_count: tables,
        duration_ms: Date.now() - started,
        created_by_id: actor?.id ?? null,
        created_by_name: actor?.name ?? null,
        drive_status: 'pending',
        local_deleted: false,
        error: null,
      });
      const saved = await this.repo.save(row);
      this.logger.log(`Backup written: ${filename} (${stat.size} bytes)`);
      return saved;
    } catch (err) {
      const message = (err as Error).message;
      await this.repo.save(
        this.repo.create({
          filename,
          file_path: filePath,
          kind: 'database',
          trigger,
          status: 'failed',
          size_bytes: '0',
          table_count: 0,
          duration_ms: Date.now() - started,
          created_by_id: actor?.id ?? null,
          created_by_name: actor?.name ?? null,
          drive_status: 'skipped',
          error: message,
        }),
      );
      throw err;
    } finally {
      this.running = false;
    }
  }

  /** Zips every uploaded/generated document and records it like a DB dump. */
  private async runFiles(trigger: 'scheduled' | 'manual', actor: Actor | null) {
    if (this.filesRunning) throw new BadRequestException('A files backup is already running');
    this.filesRunning = true;
    const started = Date.now();
    await fs.mkdir(this.dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const who = actor?.name ? `_by-${this.slug(actor.name)}` : '';
    const filename = `erp-files_${stamp}${who}.zip`;
    const filePath = join(this.dir, filename);

    try {
      const result = await zipDirectories(this.uploadDirs, filePath);
      const saved = await this.repo.save(
        this.repo.create({
          filename,
          file_path: filePath,
          kind: 'files',
          trigger,
          status: 'success',
          size_bytes: String(result.bytes),
          table_count: result.files,
          duration_ms: Date.now() - started,
          created_by_id: actor?.id ?? null,
          created_by_name: actor?.name ?? null,
          drive_status: 'pending',
          local_deleted: false,
          error: null,
        }),
      );
      this.logger.log(`Files archive written: ${filename} (${result.files} files, ${result.bytes} bytes)`);
      return saved;
    } catch (err) {
      const message = (err as Error).message;
      await fs.rm(filePath, { force: true }).catch(() => undefined);
      await this.repo.save(
        this.repo.create({
          filename,
          file_path: filePath,
          kind: 'files',
          trigger,
          status: 'failed',
          size_bytes: '0',
          table_count: 0,
          duration_ms: Date.now() - started,
          created_by_id: actor?.id ?? null,
          created_by_name: actor?.name ?? null,
          drive_status: 'skipped',
          error: message,
        }),
      );
      throw err;
    } finally {
      this.filesRunning = false;
    }
  }

  /**
   * Pure-JS mysqldump: schema + data for every base table, so the container
   * needs no mysql client binary.
   */
  private async dumpSql(): Promise<{ sql: string; tables: number }> {
    const db = this.dataSource.options.database as string;
    const out: string[] = [
      `-- ERP database backup`,
      `-- database: ${db}`,
      `-- generated: ${new Date().toISOString()}`,
      `SET FOREIGN_KEY_CHECKS=0;`,
      `SET NAMES utf8mb4;`,
      '',
    ];

    const tableRows: Record<string, string>[] = await this.dataSource.query(
      `SELECT TABLE_NAME AS name FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [db],
    );
    const names = tableRows.map((r) => r.name ?? (r as Record<string, string>)['TABLE_NAME']);

    for (const table of names) {
      const [create] = await this.dataSource.query(`SHOW CREATE TABLE \`${table}\``);
      const ddl = (create['Create Table'] ?? create['Create View']) as string;
      out.push(`DROP TABLE IF EXISTS \`${table}\`;`, `${ddl};`, '');

      const rows: Record<string, unknown>[] = await this.dataSource.query(
        `SELECT * FROM \`${table}\``,
      );
      if (rows.length) {
        const cols = Object.keys(rows[0]);
        const colList = cols.map((c) => `\`${c}\``).join(', ');
        // Chunked multi-row inserts keep the dump small and restorable.
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const values = chunk
            .map((r) => `(${cols.map((c) => this.literal(r[c])).join(', ')})`)
            .join(',\n');
          out.push(`INSERT INTO \`${table}\` (${colList}) VALUES\n${values};`);
        }
        out.push('');
      }
    }

    out.push('SET FOREIGN_KEY_CHECKS=1;', '');
    return { sql: out.join('\n'), tables: names.length };
  }

  private literal(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
    if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
  }

  private async uploadRow(row: DbBackup) {
    try {
      const content = await fs.readFile(row.file_path);
      const fileId = await this.drive.upload(
        row.filename,
        content,
        row.filename.endsWith('.zip') ? 'application/zip' : 'application/gzip',
      );
      row.drive_status = 'uploaded';
      row.drive_file_id = fileId;
      row.drive_uploaded_at = new Date();
      row.error = null;
    } catch (err) {
      row.drive_status = 'failed';
      row.error = (err as Error).message;
      await this.repo.save(row);
      throw err;
    }
    await this.repo.save(row);
  }

  private async listLocalFiles() {
    try {
      const names = await fs.readdir(this.dir);
      const files = [];
      for (const name of names.filter((n) => n.endsWith('.sql.gz') || n.endsWith('.zip'))) {
        const stat = await fs.stat(join(this.dir, name));
        files.push({ name, size: stat.size, mtime: stat.mtime });
      }
      return files;
    } catch {
      return [];
    }
  }

  /** Deletes local dumps older than the retention window (default 30 days). */
  private async purgeOldLocalBackups(): Promise<string[]> {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const removed: string[] = [];
    for (const file of await this.listLocalFiles()) {
      if (file.mtime.getTime() >= cutoff) continue;
      await fs.rm(join(this.dir, file.name), { force: true });
      removed.push(file.name);
      await this.repo.update({ filename: file.name }, { local_deleted: true });
    }
    return removed;
  }

  private slug(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  }
}
