import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { RoleCode } from '../master-data/role.entity';
import { AttendanceService } from './attendance.service';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { PunchAttendanceDto } from './dto/punch-attendance.dto';
import { DecideAttendanceRequestDto } from './dto/attendance-request.dto';


interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  /** Non-sensitive employee list for the self check-in screen (all roles). */
  @Get('directory')
  @Roles('admin', 'manager', 'warehouse', 'sales', 'employee')
  directory() {
    return this.service.directory();
  }

  /** Punch state for one employee/day — used to prefill the self screen. */
  @Get('day-state')
  @Roles('admin', 'manager', 'warehouse', 'sales', 'employee')
  dayState(@Query('employee_id') employeeId: string, @Query('work_date') workDate?: string) {
    return this.service.dayState(
      employeeId,
      workDate ?? new Date().toISOString().slice(0, 10),
    );
  }

  /** Self-service check-in / check-out (all roles). */
  @Post('punch')
  @Roles('admin', 'manager', 'warehouse', 'sales', 'employee')
  punch(@Body() dto: PunchAttendanceDto, @Req() req: AuthedRequest) {
    return this.service.punch(dto, req.user.id);
  }

  /** Attendance re-entry requests awaiting approval (admin / manager / supervisor). */
  @Get('requests')
  @Roles('admin', 'manager', 'supervisor')
  requests(@Query('status') status?: string) {
    return this.service.listRequests(status ?? 'pending');
  }

  @Post('requests/:id/decision')
  @Roles('admin', 'manager', 'supervisor')
  decide(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DecideAttendanceRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.decideRequest(id, dto.action, req.user.id, req.user.role, dto.note);
  }

  /** Aggregated attendance report over a date span (admin / manager / supervisor). */
  @Get('report')
  @Roles('admin', 'manager', 'supervisor')
  report(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employee_id') employeeId?: string,
    @Query('department_id') departmentId?: string,
  ) {
    return this.service.report({
      from,
      to,
      employee_id: employeeId,
      department_id: departmentId,
    });
  }

  @Get()
  list(
    @Query('employee_id') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list({ employee_id: employeeId, from, to });
  }



  @Post()
  upsert(@Body() dto: UpsertAttendanceDto, @Req() req: AuthedRequest) {
    return this.service.upsert(dto, req.user.id);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
