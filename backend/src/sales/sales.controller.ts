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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SalesService } from './sales.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { ChangeSalesStatusDto, UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { DecideCreditDto, RecordSalesPaymentDto } from './dto/record-sales-payment.dto';

interface AuthedRequest {
  user: { id: string; email: string; name: string };
}

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('customer_id') customer_id?: string,
  ) {
    return this.service.list({ search, status, customer_id });
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  /** System-issued delivery orders and invoices for this order. */
  @Get(':id/documents')
  documents(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.documents(id);
  }

  @Get(':id/documents/:docId/print')
  async print(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @Res() res: Response,
  ) {
    const html = await this.service.renderDocument(id, docId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }


  @Post()
  @Roles('admin', 'manager', 'sales')
  create(@Body() dto: CreateSalesOrderDto, @Req() req: AuthedRequest) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'sales')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSalesOrderDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(id, dto, req.user.id);
  }

  @Post(':id/status')
  @Roles('admin', 'manager', 'sales')
  changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeSalesStatusDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.changeStatus(id, dto, req.user.id);
  }

  @Get(':id/payments')
  paymentsList(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.payments(id);
  }

  @Post(':id/payments')
  @Roles('admin', 'manager', 'sales')
  pay(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecordSalesPaymentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.recordPayment(id, dto, req.user.id);
  }

  /** Supervisor sign-off that credit funds actually arrived. */
  @Post(':id/payments/:paymentId/confirm')
  @Roles('admin', 'manager', 'supervisor')
  confirmCredit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: DecideCreditDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.decideCredit(id, paymentId, 'received', req.user.id, dto?.note);
  }

  /** Funds never arrived — flags the order as high priority. */
  @Post(':id/payments/:paymentId/not-received')
  @Roles('admin', 'manager', 'supervisor')
  notReceived(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: DecideCreditDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.decideCredit(id, paymentId, 'not_received', req.user.id, dto?.note);
  }

  @Post(':id/payments/:paymentId/cancel')
  @Roles('admin', 'manager', 'supervisor', 'sales')
  cancelCredit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: DecideCreditDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.decideCredit(id, paymentId, 'cancelled', req.user.id, dto?.note);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: AuthedRequest) {
    return this.service.remove(id, req.user.id);
  }
}
