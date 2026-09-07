import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStockDto } from './create-stock.dto';

/**
 * Status is intentionally omitted — it is driven only by document generation
 * (PO, Dispatch, GRN, Putaway, Sales Invoice, Write-Off, Cancellation).
 * Any `status` value sent by clients is ignored by the service.
 */
export class UpdateStockDto extends PartialType(OmitType(CreateStockDto, ['status'] as const)) {}
