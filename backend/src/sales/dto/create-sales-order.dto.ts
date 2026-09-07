import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SalesOrderItemDto {
  @ApiProperty()
  @IsUUID()
  product_id!: string;

  @ApiPropertyOptional({ description: 'Warehouse batch this line is served from' })
  @IsOptional()
  @IsUUID()
  stock_id?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.001)
  qty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uom_id?: string;

  @ApiPropertyOptional({ description: 'Defaults to the product selling price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unit_price?: number;

  @ApiPropertyOptional({ description: 'Line discount as a percentage of the gross line value' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_percent?: number;

  @ApiPropertyOptional({ description: 'Deprecated — use discount_percent' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;
}

export class CreateSalesOrderDto {
  @ApiProperty()
  @IsUUID()
  customer_id!: string;

  @ApiPropertyOptional({ example: '2026-08-09' })
  @IsOptional()
  @IsDateString()
  order_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expected_delivery_date?: string;

  @ApiPropertyOptional({ description: 'ISO code — defaults to the customer currency or SAR' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency_code?: string;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  vat_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SalesOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items!: SalesOrderItemDto[];
}
