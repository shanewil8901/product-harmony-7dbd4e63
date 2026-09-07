import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_AUDIT, QUEUE_EMAIL, QUEUE_PDF, queueEnabled } from './queue.constants';
import { QueueService } from './queue.service';
import { AuditProcessor, EmailProcessor, PdfProcessor } from './queue.processors';

/**
 * Async messaging for non-blocking ERP work (invoice PDFs, audit logging,
 * email notifications). Redis/BullMQ is opt-in via QUEUE_ENABLED so local
 * development and the existing deployment keep working untouched.
 */
@Global()
@Module({})
export class QueueModule {
  static register(): DynamicModule {
    if (!queueEnabled()) {
      return { module: QueueModule, providers: [QueueService], exports: [QueueService] };
    }

    const connection = BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB ?? 0),
      },
      prefix: process.env.QUEUE_PREFIX ?? 'erp',
    });

    const queues = BullModule.registerQueue(
      { name: QUEUE_PDF },
      { name: QUEUE_AUDIT },
      { name: QUEUE_EMAIL },
    );

    return {
      module: QueueModule,
      imports: [connection, queues],
      providers: [QueueService, PdfProcessor, AuditProcessor, EmailProcessor],
      exports: [QueueService],
    };
  }
}
