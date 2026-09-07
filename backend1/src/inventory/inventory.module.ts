import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { Stock } from '../stock/stock.entity';
import { Vendor } from '../vendors/vendor.entity';
import { SalesOrderItem } from '../sales/sales-order-item.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { AdjustmentsService } from './adjustments.service';
import { StockAdjustment } from './stock-adjustment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Stock, Vendor, SalesOrderItem, StockAdjustment]),
  ],
  providers: [InventoryService, AdjustmentsService],
  controllers: [InventoryController],
  exports: [InventoryService, AdjustmentsService],
})
export class InventoryModule {}
