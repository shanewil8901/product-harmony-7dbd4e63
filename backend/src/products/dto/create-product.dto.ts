import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Organic almond flour 1kg pack' })
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ example: 12.5, description: 'DECIMAL(10,3)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(9999999.999)
  baseQty!: number;

  @ApiProperty({ example: 1.25, description: 'DECIMAL(10,3)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(9999999.999)
  weight!: number;

  @ApiProperty({ example: 8.5, description: 'DECIMAL(10,2)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  buyingPrice!: number;

  @ApiProperty({ example: 12.99, description: 'DECIMAL(10,2)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  sellingPrice!: number;

  @ApiProperty({ description: 'Department master-data id' })
  @IsUUID()
  department_id!: string;

  @ApiProperty({ description: 'Base UOM master-data id' })
  @IsUUID()
  base_uom_id!: string;

  @ApiProperty({ description: 'Weight UOM master-data id' })
  @IsUUID()
  weight_uom_id!: string;

  @ApiProperty({ description: 'Buying currency master-data id' })
  @IsUUID()
  buying_currency_id!: string;

  @ApiProperty({ description: 'Selling currency master-data id' })
  @IsUUID()
  selling_currency_id!: string;

  // productCode and product_barcode are auto-generated on the server.
  @ApiPropertyOptional({ readOnly: true, description: 'Auto-generated on create' })
  @IsOptional()
  @IsString()
  productCode?: string;

  @ApiPropertyOptional({ readOnly: true, description: 'Auto-generated EAN-13 on create' })
  @IsOptional()
  @IsString()
  product_barcode?: string;
}
