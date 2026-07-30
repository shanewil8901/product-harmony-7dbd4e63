import { api, getToken } from './api';
import type { StockAttachment, StockAttachmentStage } from '../types/stock';

export const stockAttachmentsService = {
  async list(stockId: string) {
    const { data } = await api.get<StockAttachment[]>(`/stock/${stockId}/attachments`);
    return data;
  },
  async upload(
    stockId: string,
    file: File,
    meta: { stage: StockAttachmentStage; reference_no?: string; notes?: string },
  ) {
    const form = new FormData();
    form.append('file', file);
    form.append('stage', meta.stage);
    if (meta.reference_no) form.append('reference_no', meta.reference_no);
    if (meta.notes) form.append('notes', meta.notes);
    const { data } = await api.post<StockAttachment>(`/stock/${stockId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  async remove(stockId: string, attachmentId: string) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(
      `/stock/${stockId}/attachments/${attachmentId}`,
    );
    return data;
  },
  /** Downloads through axios so the bearer token is attached. */
  async download(stockId: string, attachment: StockAttachment) {
    const res = await api.get<Blob>(
      `/stock/${stockId}/attachments/${attachment.id}/download`,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(res.data as unknown as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  hasToken() {
    return Boolean(getToken());
  },
};
