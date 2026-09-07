import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeProfile } from './employee-profile.entity';
import { EmployeeDocument } from './employee-document.entity';
import { Attendance } from './attendance.entity';
import { AttendanceRequest } from './attendance-request.entity';
import { Payslip } from './payslip.entity';
import { LeaveRequest } from './leave.entity';
import { RoleLeavePolicy } from './leave-policy.entity';
import { PayrollRunLog, PayrollSettings, WorkCalendar } from './payroll-settings.entity';
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
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { PayrollSettingsService } from './payroll-settings.service';
import { PayrollSettingsController } from './payroll-settings.controller';
import { Resignation } from './resignation.entity';
import { ResignationService } from './resignation.service';
import { ResignationController } from './resignation.controller';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployeeProfile,
      EmployeeDocument,
      Attendance,
      AttendanceRequest,
      Payslip,
      LeaveRequest,
      Resignation,

      RoleLeavePolicy,
      PayrollSettings,
      WorkCalendar,
      PayrollRunLog,
      User,
      Role,
      Department,
      Currency,
    ]),
  ],
  providers: [
    EmployeesService,
    AttendanceService,
    PayrollService,
    LeaveService,
    PayrollSettingsService,
    ResignationService,
  ],
  controllers: [
    EmployeesController,
    AttendanceController,
    // The settings controller must be registered before the payroll controller
    // so /payroll/settings is not swallowed by /payroll/:id style routes.
    PayrollSettingsController,
    PayrollController,
    LeaveController,
    ResignationController,
  ],

  exports: [EmployeesService, AttendanceService, PayrollService, LeaveService],
})
export class HrModule {}
