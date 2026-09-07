import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CreateSalesOrderDto } from './create-sales-order.dto';
import { SALES_ORDER_STATUSES, SalesOrderStatus } from '../sales-order.entity';

/** Status is never patched directly — use POST /sales/:id/status. */
export class UpdateSalesOrderDto extends PartialType(
  OmitType(CreateSalesOrderDto, ['customer_id'] as const),
) {}

export class ChangeSalesStatusDto {
  @ApiPropertyOptional({ enum: SALES_ORDER_STATUSES })
  @IsIn(SALES_ORDER_STATUSES)
  status!: SalesOrderStatus;

  @ApiPropertyOptional({ description: 'Required when moving to invoiced' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  invoice_no?: string;

  @ApiPropertyOptional({ description: 'Required when moving to paid' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount_paid?: number;

  @ApiPropertyOptional({ description: 'Required when cancelling' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
