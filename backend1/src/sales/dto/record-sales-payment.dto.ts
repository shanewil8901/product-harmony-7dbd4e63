import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SALES_PAYMENT_METHODS, SalesPaymentMethod } from '../sales-payment.entity';

/** Records a settlement against a sales order (cash, bank transfer or credit). */
export class RecordSalesPaymentDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: SALES_PAYMENT_METHODS })
  @IsIn(SALES_PAYMENT_METHODS)
  method!: SalesPaymentMethod;

  @ApiPropertyOptional({ description: 'Cash — receipt / voucher number' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  proof_doc_no?: string;

  @ApiPropertyOptional({ description: 'Cash — uploaded proof file name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  proof_file_name?: string;

  @ApiPropertyOptional({ description: 'Cash — uploaded proof as a data URL' })
  @IsOptional()
  @IsString()
  proof_file_data?: string;

  @ApiPropertyOptional({ description: 'Bank transfer reference number' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bank_reference?: string;

  @ApiPropertyOptional({ description: 'Credit reference number' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  credit_reference?: string;

  @ApiPropertyOptional({ description: 'Credit — days until cash is expected' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  credit_days?: number;

  @ApiPropertyOptional({ description: 'Credit — expected cash arrival date' })
  @IsOptional()
  @IsISO8601()
  expected_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class DecideCreditDto {
  @ApiPropertyOptional({ description: 'Reason when marking funds as not received' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
