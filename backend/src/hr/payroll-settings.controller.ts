import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { RoleCode } from '../master-data/role.entity';
import { PayrollSettingsService } from './payroll-settings.service';
import { PayrollService } from './payroll.service';
import { UpdatePayrollSettingsDto, UpsertWorkCalendarDto } from './dto/leave.dto';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

/** Admin/manager configuration for the automatic payroll run. */
@ApiTags('payroll-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('payroll/settings')
export class PayrollSettingsController {
  constructor(
    private readonly service: PayrollSettingsService,
    private readonly payroll: PayrollService,
  ) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  update(@Body() dto: UpdatePayrollSettingsDto, @Req() req: AuthedRequest) {
    return this.service.update(dto, req.user.id);
  }

  @Get('calendars')
  calendars() {
    return this.service.calendars();
  }

  @Post('calendars')
  upsertCalendar(@Body() dto: UpsertWorkCalendarDto, @Req() req: AuthedRequest) {
    return this.service.upsertCalendar(dto, req.user.id);
  }

  @Delete('calendars/:id')
  removeCalendar(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.removeCalendar(id);
  }

  /** Run the scheduled payroll immediately for a period (dry manual trigger). */
  @Post('run')
  run(@Body() body: { period?: string }, @Req() req: AuthedRequest) {
    return this.payroll.runScheduled(body?.period, req.user.id, 'manual');
  }

  /** Test generation — reports the calendar source used, writes no payslips. */
  @Post('test-run')
  testRun(@Body() body: { period?: string }, @Req() req: AuthedRequest) {
    return this.payroll.previewRun(body?.period, req.user.id);
  }

  /** Audit trail of every payroll generation attempt. */
  @Get('logs')
  logs() {
    return this.service.logs();
  }
}
