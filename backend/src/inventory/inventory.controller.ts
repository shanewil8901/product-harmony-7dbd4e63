import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustmentsService } from './adjustments.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { RoleCode } from '../master-data/role.entity';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

/** Stock levels are derived; only adjustments can be written here. */
@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly adjustments: AdjustmentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Available stock per product, derived from stock and sales' })
  overview(@Query('search') search?: string, @Query('status') status?: string) {
    return this.service.overview({ search, status });
  }

  @Get('vendors')
  @ApiOperation({ summary: 'Supplier breakdown of stock on hand and incoming' })
  vendors(@Query('search') search?: string) {
    return this.service.vendorBreakdown({ search });
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Low and out of stock alerts with reorder suggestions' })
  alerts(@Query('threshold') threshold?: string) {
    return this.service.alerts(threshold ? Number(threshold) : undefined);
  }

  @Get('adjustments')
  @ApiOperation({ summary: 'Stock adjustment ledger (returns, damage, corrections)' })
  listAdjustments(
    @Query('product_id') product_id?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.adjustments.findAll({ product_id, type, search });
  }

  @Post('adjustments')
  @Roles('admin', 'manager', 'warehouse')
  createAdjustment(@Body() dto: CreateAdjustmentDto, @Req() req: AuthedRequest) {
    return this.adjustments.create(dto, req.user.id);
  }

  @Delete('adjustments/:id')
  @Roles('admin', 'manager')
  voidAdjustment(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthedRequest) {
    return this.adjustments.remove(id, req.user.id);
  }

  @Get(':productId/movements')
  @ApiOperation({ summary: 'Inbound batches and outbound sales lines for one product' })
  movements(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return this.service.movements(productId);
  }
}
