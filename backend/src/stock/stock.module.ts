import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './stock.entity';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { Product } from '../products/product.entity';
import { StockDocument } from './stock-document.entity';
import { StockDocumentsService } from './stock-documents.service';
import { StockDocumentsController } from './stock-documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Stock, Product, StockDocument])],
  providers: [StockService, StockDocumentsService],
  controllers: [StockController, StockDocumentsController],
  exports: [StockDocumentsService],
})
export class StockModule {}
