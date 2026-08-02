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
    return this.service.upsert(dto, req.user.email);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
