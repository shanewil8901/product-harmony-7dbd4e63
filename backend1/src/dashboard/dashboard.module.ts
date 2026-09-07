import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Stock } from '../stock/stock.entity';
import { StockDocument } from '../stock/stock-document.entity';
import { StockHistory } from '../stock/stock-history.entity';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { User } from '../users/user.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { Customer } from '../customers/customer.entity';
import { EmployeeProfile } from '../hr/employee-profile.entity';
import { Attendance } from '../hr/attendance.entity';
import { LeaveRequest } from '../hr/leave.entity';
import { Payslip } from '../hr/payslip.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stock,
      StockDocument,
      StockHistory,
      Product,
      Vendor,
      User,
      SalesOrder,
      Customer,
      EmployeeProfile,
      Attendance,
      LeaveRequest,
      Payslip,
    ]),
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
