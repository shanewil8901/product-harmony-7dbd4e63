import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ResignationService } from './resignation.service';
import { CreateResignationDto, DecideResignationDto } from './dto/resignation.dto';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

const ALL_ROLES: RoleCode[] = ['admin', 'manager', 'supervisor', 'warehouse', 'sales', 'employee'];

@ApiTags('resignations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resignations')
export class ResignationController {
  constructor(private readonly service: ResignationService) {}

  @Get()
  @Roles(...ALL_ROLES)
  list(
    @Req() req: AuthedRequest,
    @Query('status') status?: string,
    @Query('employee_id') employeeId?: string,
    @Query('mine') mine?: string,
  ) {
    return this.service.list(
      { status, employee_id: employeeId, mine: mine === 'true' },
      req.user,
    );
  }

  /** End-of-service benefit for a prospective last working day. */
  @Get('benefit-preview')
  @Roles(...ALL_ROLES)
  async preview(
    @Req() req: AuthedRequest,
    @Query('last_working_date') lastWorkingDate: string,
    @Query('employee_id') employeeId?: string,
  ) {
    const privileged = ['admin', 'manager', 'supervisor'].includes(req.user.role ?? '');
    const id =
      employeeId && privileged
        ? employeeId
        : (await this.service.resolveEmployeeForUser(req.user.id)).id;
    return this.service.preview(id, lastWorkingDate);
  }


  @Post()
  @Roles(...ALL_ROLES)
  create(@Body() dto: CreateResignationDto, @Req() req: AuthedRequest) {
    return this.service.create(dto, req.user);
  }

  @Patch(':id/decision')
  @Roles('admin', 'manager', 'supervisor')
  decide(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DecideResignationDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.decide(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(...ALL_ROLES)
  withdraw(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthedRequest) {
    return this.service.withdraw(id, req.user);
  }
}
