import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { STOCK_DOC_TYPES, StockDocType } from '../stock-document.entity';

export class CreateStockDocumentDto {
  @ApiProperty({ enum: STOCK_DOC_TYPES })
  @IsIn(STOCK_DOC_TYPES)
  doc_type!: StockDocType;

  @ApiPropertyOptional({ description: 'Type-specific fields (carrier, invoice_no, reason, …)' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 10000, description: 'Total amount for this stage' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total_amount?: number;

  @ApiPropertyOptional({ example: 'SAR', description: 'Required whenever total_amount is sent' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3,8}$/, { message: 'currency_code must be an uppercase ISO code (e.g. SAR)' })
  currency_code?: string;
}
