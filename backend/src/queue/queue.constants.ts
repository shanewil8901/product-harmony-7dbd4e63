export const QUEUE_PDF = 'pdf-generation';
export const QUEUE_AUDIT = 'audit-log';
export const QUEUE_EMAIL = 'email-notification';

export const ALL_QUEUES = [QUEUE_PDF, QUEUE_AUDIT, QUEUE_EMAIL] as const;

export type QueueName = (typeof ALL_QUEUES)[number];

export interface PdfJob {
  kind: 'sales-invoice' | 'purchase-document' | 'payslip';
  documentId: string;
  requestedBy?: string;
}

export interface AuditJob {
  entity: string;
  entityId: string;
  action: string;
  actor?: string;
  payload?: Record<string, unknown>;
}

export interface EmailJob {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, unknown>;
}

/** True when Redis-backed async processing is configured. */
export const queueEnabled = () => process.env.QUEUE_ENABLED === 'true';
