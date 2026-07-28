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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Product } from './product.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { RoleCode } from '../master-data/role.entity';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products; filter by productCode or product_barcode via ?search=' })
  @ApiOkResponse({ description: 'Paginated products' })
  findAll(@Query() q: QueryProductDto) {
    return this.service.findAll(q);
  }

  @Get(':id')
  @ApiOkResponse({ type: Product })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Change history for a product' })
  findHistory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findHistory(id);
  }


  @Post()
  @Roles('admin', 'manager', 'sales')
  @ApiOkResponse({ type: Product })
  create(@Body() dto: CreateProductDto, @Req() req: AuthedRequest) {
    return this.service.create(dto, req.user.email);
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'sales')
  @ApiOkResponse({ type: Product })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
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
