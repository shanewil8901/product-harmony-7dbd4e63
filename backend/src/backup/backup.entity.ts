import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type BackupKind = 'database' | 'files';
export type BackupTrigger = 'scheduled' | 'manual';
export type BackupStatus = 'success' | 'failed';
export type DriveStatus = 'pending' | 'uploaded' | 'skipped' | 'failed';

/**
 * One row per database dump written to the local backup folder.
 * Immutable history — rows are kept even after the file itself is purged.
 */
@Entity({ name: 'db_backups' })
export class DbBackup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** File name on disk, always carrying the generation timestamp. */
  @Index()
  @Column({ type: 'varchar', length: 255 })
  filename!: string;

  @Column({ name: 'file_path', type: 'varchar', length: 512 })
  file_path!: string;

  /** What was captured: the MySQL dump, or the uploaded/generated files. */
  @Index()
  @Column({ type: 'varchar', length: 16, default: 'database' })
  kind!: BackupKind;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  trigger!: BackupTrigger;

  @Column({ type: 'varchar', length: 16 })
  status!: BackupStatus;

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  size_bytes!: string;

  /** Tables for a database dump, archived files for a files backup. */
  @Column({ name: 'table_count', type: 'int', default: 0 })
  table_count!: number;

  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  duration_ms!: number;

  /** Set only for manual runs — the user who pressed the button. */
  @Column({ name: 'created_by_id', type: 'varchar', length: 36, nullable: true })
  created_by_id!: string | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 255, nullable: true })
  created_by_name!: string | null;

  @Column({ name: 'drive_status', type: 'varchar', length: 16, default: 'pending' })
  drive_status!: DriveStatus;

  @Column({ name: 'drive_file_id', type: 'varchar', length: 255, nullable: true })
  drive_file_id!: string | null;

  @Column({ name: 'drive_uploaded_at', type: 'datetime', nullable: true })
  drive_uploaded_at!: Date | null;

  /** True once the local file has been removed by the retention sweep. */
  @Column({ name: 'local_deleted', type: 'boolean', default: false })
  local_deleted!: boolean;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
