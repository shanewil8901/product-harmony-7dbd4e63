export type BackupTrigger = 'scheduled' | 'manual';
export type BackupStatus = 'success' | 'failed';
export type DriveStatus = 'pending' | 'uploaded' | 'skipped' | 'failed';

export interface DbBackup {
  id: string;
  filename: string;
  file_path: string;
  trigger: BackupTrigger;
  status: BackupStatus;
  size_bytes: string;
  table_count: number;
  duration_ms: number;
  created_by_id: string | null;
  created_by_name: string | null;
  drive_status: DriveStatus;
  drive_file_id: string | null;
  drive_uploaded_at: string | null;
  local_deleted: boolean;
  error: string | null;
  created_at: string;
}

export interface BackupStatusInfo {
  local_dir: string;
  local_files: number;
  local_bytes: number;
  retention_days: number;
  local_every_minutes: number;
  drive_configured: boolean;
  drive_folder_set: boolean;
  last_backup: DbBackup | null;
  running: boolean;
}
