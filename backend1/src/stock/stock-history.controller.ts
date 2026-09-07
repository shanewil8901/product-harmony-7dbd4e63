import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StockHistoryService } from './stock-history.service';

@ApiTags('stock-history')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockHistoryController {
  constructor(private readonly service: StockHistoryService) {}

  @Get(':id/history')
  list(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listForStock(id);
  }
}
