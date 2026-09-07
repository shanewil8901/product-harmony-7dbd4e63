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
import { LeaveService } from './leave.service';
import { ApplyLeaveDto, DecideLeaveDto, UpdateLeavePolicyDto } from './dto/leave.dto';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

const ALL_ROLES: RoleCode[] = ['admin', 'manager', 'supervisor', 'warehouse', 'sales', 'employee'];

@ApiTags('leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  /** Own requests for everyone; the whole company for supervisors and above. */
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

  @Get('balances')
  @Roles(...ALL_ROLES)
  async balances(@Req() req: AuthedRequest, @Query('employee_id') employeeId?: string) {
    const privileged = ['admin', 'manager', 'supervisor'].includes(req.user.role ?? '');
    const id =
      employeeId && privileged
        ? employeeId
        : (await this.service.resolveEmployeeForUser(req.user.id)).id;
    return this.service.balances(id);
  }

  /** Everyone on approved leave for a given day (defaults to today). */
  @Get('on-leave')
  @Roles('admin', 'manager', 'supervisor')
  onLeave(@Query('date') date?: string) {
    return this.service.onLeave(date || undefined);
  }

  @Get('policies')
  @Roles(...ALL_ROLES)
  policies() {
    return this.service.listPolicies();
  }

  /** Committed leave per role — used to warn before lowering an entitlement. */
  @Get('policies/usage')
  @Roles('admin', 'manager', 'supervisor')
  policyUsage() {
    return this.service.policyUsage();
  }

  @Patch('policies')
  @Roles('admin', 'manager', 'supervisor')
  updatePolicy(@Body() dto: UpdateLeavePolicyDto, @Req() req: AuthedRequest) {
    return this.service.updatePolicy(dto, req.user.id);
  }

  @Post()
  @Roles(...ALL_ROLES)
  apply(@Body() dto: ApplyLeaveDto, @Req() req: AuthedRequest) {
    return this.service.apply(dto, req.user);
  }

  @Patch(':id/decision')
  @Roles('admin', 'manager', 'supervisor')
  decide(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DecideLeaveDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.decide(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(...ALL_ROLES)
  cancel(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthedRequest) {
    return this.service.cancel(id, req.user);
  }
}
