import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { RoleCode } from '../master-data/role.entity';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly service: StockService) {}

  @Get() findAll(@Query() q: QueryStockDto) { return this.service.findAll(q); }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('admin', 'manager', 'employee')
  create(@Body() dto: CreateStockDto, @Req() req: AuthedRequest) {
    return this.service.create(dto, req.user.email);
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'warehouse', 'sales', 'employee')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStockDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(id, dto, req.user.email);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthedRequest) {
    return this.service.remove(id, req.user.email);
  }
}
