import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  AuditJob,
  EmailJob,
  PdfJob,
  QUEUE_AUDIT,
  QUEUE_EMAIL,
  QUEUE_PDF,
} from './queue.constants';

/**
 * Thin façade used by ERP modules. When QUEUE_ENABLED is false the queues are
 * not registered and every enqueue call degrades to a logged no-op, so the app
 * boots and behaves exactly as before without Redis.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Optional() @InjectQueue(QUEUE_PDF) private readonly pdf?: Queue,
    @Optional() @InjectQueue(QUEUE_AUDIT) private readonly audit?: Queue,
    @Optional() @InjectQueue(QUEUE_EMAIL) private readonly email?: Queue,
  ) {}

  enqueuePdf(data: PdfJob) {
    return this.add(this.pdf, QUEUE_PDF, data);
  }

  enqueueAudit(data: AuditJob) {
    return this.add(this.audit, QUEUE_AUDIT, data);
  }

  enqueueEmail(data: EmailJob) {
    return this.add(this.email, QUEUE_EMAIL, data);
  }

  private async add(queue: Queue | undefined, name: string, data: unknown) {
    if (!queue) {
      this.logger.debug(`Queue "${name}" disabled — skipped job ${JSON.stringify(data)}`);
      return null;
    }
    return queue.add(name, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    });
  }
}
