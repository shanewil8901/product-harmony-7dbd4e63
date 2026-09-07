import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from './sales-order.entity';
import { SalesOrderItem } from './sales-order-item.entity';
import { SalesDocument } from './sales-document.entity';
import { SalesPayment } from './sales-payment.entity';
import { SalesHistory } from './sales-history.entity';
import { SalesHistoryService } from './sales-history.service';
import { SalesHistoryController } from './sales-history.controller';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { Currency } from '../master-data/currency.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrder,
      SalesOrderItem,
      SalesDocument,
      SalesPayment,
      SalesHistory,
      Customer,
      Product,
      Currency,
    ]),
  ],
  providers: [SalesService, SalesHistoryService],
  controllers: [SalesController, SalesHistoryController],
  exports: [SalesService, SalesHistoryService],
})
export class SalesModule {}
