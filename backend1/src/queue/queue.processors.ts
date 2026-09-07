import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_AUDIT, QUEUE_EMAIL, QUEUE_PDF } from './queue.constants';

/**
 * Workers run in the same process by default; scale them out by running the
 * image with WORKER_ONLY=true and a separate K8s Deployment if throughput grows.
 */

@Processor(QUEUE_PDF)
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);
  async process(job: Job): Promise<unknown> {
    this.logger.log(`PDF job ${job.id}: ${JSON.stringify(job.data)}`);
    // Document HTML/PDF rendering hooks into the existing document services.
    return { ok: true };
  }
}

@Processor(QUEUE_AUDIT)
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);
  async process(job: Job): Promise<unknown> {
    this.logger.log(`Audit job ${job.id}: ${JSON.stringify(job.data)}`);
    return { ok: true };
  }
}

@Processor(QUEUE_EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  async process(job: Job): Promise<unknown> {
    this.logger.log(`Email job ${job.id}: ${JSON.stringify(job.data)}`);
    return { ok: true };
  }
}
