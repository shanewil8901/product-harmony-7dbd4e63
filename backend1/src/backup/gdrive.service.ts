import { Injectable, Logger } from '@nestjs/common';

/**
 * Minimal Google Drive uploader.
 *
 * Credentials come exclusively from the environment:
 *   GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN, GDRIVE_FOLDER_ID
 * When any of them is missing the service reports itself as not configured and
 * the backup job simply keeps the dump locally.
 */
@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);

  get configured(): boolean {
    return Boolean(
      process.env.GDRIVE_CLIENT_ID &&
        process.env.GDRIVE_CLIENT_SECRET &&
        process.env.GDRIVE_REFRESH_TOKEN,
    );
  }

  private async accessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: process.env.GDRIVE_CLIENT_ID ?? '',
      client_secret: process.env.GDRIVE_CLIENT_SECRET ?? '',
      refresh_token: process.env.GDRIVE_REFRESH_TOKEN ?? '',
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json()) as { access_token?: string; error_description?: string };
    if (!res.ok || !json.access_token) {
      throw new Error(`Google token exchange failed: ${json.error_description ?? res.status}`);
    }
    return json.access_token;
  }

  /** Multipart upload of a single file. Returns the Drive file id. */
  async upload(filename: string, content: Buffer, mimeType = 'application/gzip'): Promise<string> {
    const token = await this.accessToken();
    const folder = process.env.GDRIVE_FOLDER_ID;
    const metadata = {
      name: filename,
      ...(folder ? { parents: [folder] } : {}),
    };

    const boundary = `erp-${Date.now().toString(16)}`;
    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([head, content, tail]);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const json = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) {
      throw new Error(`Google Drive upload failed: ${json.error?.message ?? res.status}`);
    }
    this.logger.log(`Uploaded ${filename} to Google Drive (${json.id})`);
    return json.id;
  }
}
