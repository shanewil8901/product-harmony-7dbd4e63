import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

/**
 * Liveness / readiness probes for Docker and Kubernetes.
 * Kept dependency-free (no @nestjs/terminus) so the image stays small.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Liveness — process is up and able to answer HTTP. */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok', uptime: process.uptime() };
  }

  /** Readiness — MySQL must answer before traffic is routed here. */
  @Get()
  @ApiOperation({ summary: 'Readiness probe (verifies MySQL connectivity)' })
  async ready() {
    const started = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        message: (err as Error).message,
      });
    }
    return {
      status: 'ok',
      database: 'up',
      latency_ms: Date.now() - started,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  readyAlias() {
    return this.ready();
  }
}
