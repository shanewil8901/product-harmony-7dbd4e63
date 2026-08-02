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
import { PayrollService } from './payroll.service';
import { GeneratePayslipDto, UpdatePayslipStatusDto } from './dto/payslip.dto';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  @Get('payslips')
  list(
    @Query('period') period?: string,
    @Query('employee_id') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({ period, employee_id: employeeId, status });
  }

  @Get('payslips/:id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Post('payslips')
  generate(@Body() dto: GeneratePayslipDto, @Req() req: AuthedRequest) {
    return this.service.generate(dto, req.user.email);
  }

  @Patch('payslips/:id/status')
  setStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePayslipStatusDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.setStatus(id, dto.status, req.user.email);
  }

  @Delete('payslips/:id')
  @Roles('admin')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }
}
