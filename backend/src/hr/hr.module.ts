import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeProfile } from './employee-profile.entity';
import { EmployeeDocument } from './employee-document.entity';
import { Attendance } from './attendance.entity';
import { Payslip } from './payslip.entity';
import { User } from '../users/user.entity';
import { Role } from '../master-data/role.entity';
import { Department } from '../master-data/department.entity';
import { Currency } from '../master-data/currency.entity';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployeeProfile,
      EmployeeDocument,
      Attendance,
      Payslip,
      User,
      Role,
      Department,
      Currency,
    ]),
  ],
  providers: [EmployeesService, AttendanceService, PayrollService],
  controllers: [EmployeesController, AttendanceController, PayrollController],
  exports: [EmployeesService, AttendanceService, PayrollService],
})
export class HrModule {}
