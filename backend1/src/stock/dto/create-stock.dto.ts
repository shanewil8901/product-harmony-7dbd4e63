import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STOCK_STATUSES, StockStatus } from '../stock.entity';
import { IsNotBeforeDate } from '../../common/date-range';

export class CreateStockDto {
  @ApiProperty({ description: 'Product being stocked' })
  @IsUUID()
  product_id!: string;

  @ApiProperty({ example: 100.0, description: 'DECIMAL(12,3)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(9999999999.999)
  qty!: number;

  @ApiPropertyOptional({ description: 'UOM master-data id for the ordered qty' })
  @IsOptional()
  @IsUUID()
  qty_uom_id?: string;

  @ApiProperty({ description: 'Registered vendor id — must exist and be active' })
  @IsUUID(undefined, { message: 'Vendor is required — select a registered vendor' })
  vendor_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  batch_no?: string;

  @ApiPropertyOptional({ example: '2026-01-15', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  manufacture_date?: string;

  @ApiProperty({ example: '2027-01-15', description: 'YYYY-MM-DD — required' })
  @IsDateString({}, { message: 'Expiry date is required (YYYY-MM-DD)' })
  @IsNotBeforeDate('manufacture_date', {
    message: 'Expiry date cannot be earlier than the manufacture date',
  })
  expiry_date!: string;



  @ApiPropertyOptional({ example: '2026-07-23T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  ordered_at?: string;

  @ApiPropertyOptional({ enum: STOCK_STATUSES, default: 'ordered' })
  @IsOptional()
  @IsIn(STOCK_STATUSES)
  status?: StockStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
