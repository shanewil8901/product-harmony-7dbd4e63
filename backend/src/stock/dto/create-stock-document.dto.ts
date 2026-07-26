import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional } from 'class-validator';
import { STOCK_DOC_TYPES, StockDocType } from '../stock-document.entity';

export class CreateStockDocumentDto {
  @ApiProperty({ enum: STOCK_DOC_TYPES })
  @IsIn(STOCK_DOC_TYPES)
  doc_type!: StockDocType;

  @ApiPropertyOptional({ description: 'Type-specific fields (carrier, invoice_no, reason, …)' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
