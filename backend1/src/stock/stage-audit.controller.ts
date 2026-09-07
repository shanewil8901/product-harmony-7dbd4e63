import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StageAuditService } from './stage-audit.service';

@ApiTags('stock-stage-audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StageAuditController {
  constructor(private readonly service: StageAuditService) {}

  /** Full stage attempt log (successful and refused) for one stock line. */
  @Get(':id/stage-audit')
  list(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listForStock(id);
  }

  /** Organisation-wide recent stage activity — supervisors only. */
  @Get('stage-audit/recent')
  @Roles('admin', 'manager')
  recent(@Query('limit') limit?: string) {
    const n = Number(limit);
    return this.service.recent(Number.isFinite(n) ? n : 100);
  }
}
