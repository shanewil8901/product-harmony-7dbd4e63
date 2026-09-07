import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SalesHistoryService } from './sales-history.service';

@ApiTags('sales-history')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesHistoryController {
  constructor(private readonly service: SalesHistoryService) {}

  @Get(':id/history')
  list(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listForOrder(id);
  }
}
