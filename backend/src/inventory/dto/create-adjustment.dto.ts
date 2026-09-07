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
import { ADJUSTMENT_TYPES, type AdjustmentType } from '../stock-adjustment.entity';

export class CreateAdjustmentDto {
  @ApiProperty() @IsUUID() product_id!: string;

  @ApiPropertyOptional({ description: 'Batch this correction belongs to' })
  @IsOptional()
  @IsUUID()
  stock_id?: string;

  @ApiPropertyOptional({ description: 'Vendor for a vendor return' })
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @ApiProperty({ enum: ADJUSTMENT_TYPES })
  @IsIn(ADJUSTMENT_TYPES)
  type!: AdjustmentType;

  @ApiProperty({ example: 5, description: 'Always positive — the type sets the direction' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999999999.999)
  qty!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) reference_no?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) reason?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() adjusted_at?: string;
}
