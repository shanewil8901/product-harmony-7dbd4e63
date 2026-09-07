import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /** Aggregated analytics for the ERP home screen. `days` drives the rolling window (7–365). */
  @Get('overview')
  overview(@Query('days') days?: string) {
    const parsed = Number(days);
    const window = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 7), 365) : 30;
    return this.service.overview(window);
  }
}
