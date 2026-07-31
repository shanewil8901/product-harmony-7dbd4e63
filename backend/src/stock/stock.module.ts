import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './stock.entity';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { StockDocument } from './stock-document.entity';
import { StockDocumentsService } from './stock-documents.service';
import { StockDocumentsController } from './stock-documents.controller';
import { StockHistory } from './stock-history.entity';
import { StockHistoryService } from './stock-history.service';
import { StockHistoryController } from './stock-history.controller';
import { StockAttachment } from './stock-attachment.entity';
import { StockAttachmentsService } from './stock-attachments.service';
import { StockAttachmentsController } from './stock-attachments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Stock, Product, Vendor, StockDocument, StockHistory, StockAttachment])],
  providers: [StockService, StockDocumentsService, StockHistoryService, StockAttachmentsService],
  controllers: [
    StockController,
    StockDocumentsController,
    StockHistoryController,
    StockAttachmentsController,
  ],
  exports: [StockDocumentsService, StockHistoryService, StockAttachmentsService],
})
export class StockModule {}
