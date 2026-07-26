import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './stock.entity';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { Product } from '../products/product.entity';
import { StockDocument } from './stock-document.entity';
import { StockDocumentsService } from './stock-documents.service';
import { StockDocumentsController } from './stock-documents.controller';
import { StockHistory } from './stock-history.entity';
import { StockHistoryService } from './stock-history.service';
import { StockHistoryController } from './stock-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Stock, Product, StockDocument, StockHistory])],
  providers: [StockService, StockDocumentsService, StockHistoryService],
  controllers: [StockController, StockDocumentsController, StockHistoryController],
  exports: [StockDocumentsService, StockHistoryService],
})
export class StockModule {}
