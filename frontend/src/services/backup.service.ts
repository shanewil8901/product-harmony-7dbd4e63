import { api } from './api';
import type { BackupStatusInfo, DbBackup } from '../types/backup';

export const backupService = {
  async list(limit = 100) {
    const { data } = await api.get<DbBackup[]>('/backups', { params: { limit } });
    return data;
  },
  async status() {
    const { data } = await api.get<BackupStatusInfo>('/backups/status');
    return data;
  },
  /** Manual run — the backend stamps the signed-in user's name on the file. */
  async run() {
    const { data } = await api.post<DbBackup>('/backups/run');
    return data;
  },
  async upload(id: string) {
    const { data } = await api.post<DbBackup>(`/backups/${id}/upload`);
    return data;
  },
  async purge() {
    const { data } = await api.post<{ removed: string[] }>('/backups/purge');
    return data;
  },
};
