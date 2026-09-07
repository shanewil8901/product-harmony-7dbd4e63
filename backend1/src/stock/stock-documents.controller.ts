import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StockDocumentsService } from './stock-documents.service';
import { StageAuditService } from './stage-audit.service';
import { StockService } from './stock.service';
import { CreateStockDocumentDto } from './dto/create-stock-document.dto';
import { renderDocumentHtml } from './document-templates';
import { canRunStage } from './lifecycle';
import type { RoleCode } from '../master-data/role.entity';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

@ApiTags('stock-documents')
@Controller('stock')
export class StockDocumentsController {
  constructor(
    private readonly service: StockDocumentsService,
    private readonly stockService: StockService,
    private readonly audit: StageAuditService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/documents')
  list(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listForStock(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'warehouse', 'sales', 'employee')
  @Post(':id/documents')
  async create(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateStockDocumentDto,
    @Req() req: AuthedRequest,
  ) {
    // Every attempt is audited — refusals included, so permission probing is visible.
    if (!canRunStage(req.user.role, dto.doc_type)) {
      const message = `Your role (${req.user.role ?? 'none'}) cannot generate this document`;
      await this.audit.log({
        stock_id: id,
        doc_type: dto.doc_type,
        result: 'denied',
        reason: message,
        payload: dto.payload ?? null,
        actor_email: req.user.id,
        actor_role: req.user.role,
      });
      throw new ForbiddenException(message);
    }
    // Lifecycle stages may be skipped out of order, but only by admin/manager and
    // only with a recorded reason — the reason lands on the document and the audit log.
    const skipReason = dto.skip_reason?.trim();
    if (skipReason && req.user.role !== 'admin' && req.user.role !== 'manager') {
      const message = 'Only an admin or manager can skip lifecycle stages';
      await this.audit.log({
        stock_id: id,
        doc_type: dto.doc_type,
        result: 'denied',
        reason: message,
        payload: dto.payload ?? null,
        actor_email: req.user.id,
        actor_role: req.user.role,
      });
      throw new ForbiddenException(message);
    }
    const payload = skipReason
      ? { ...(dto.payload ?? {}), skip_reason: skipReason, skipped_by: req.user.id }
      : dto.payload;
    try {
      return await this.service.createForStock(id, dto.doc_type, payload, req.user.id, {
        total_amount: dto.total_amount,
        currency_code: dto.currency_code,
        actor_role: req.user.role,
        skipTransitionCheck: !!skipReason,
      });
    } catch (err) {
      await this.audit.log({
        stock_id: id,
        doc_type: dto.doc_type,
        result: 'failed',
        reason: err instanceof Error ? err.message : 'Stage rejected',
        payload: dto.payload ?? null,
        total_amount: dto.total_amount !== undefined ? dto.total_amount.toFixed(2) : null,
        currency_code: dto.currency_code ?? null,
        actor_email: req.user.id,
        actor_role: req.user.role,
      });
      throw err;
    }
  }


  /**
   * Printable HTML view of a document. Public GET so it can be opened in a new tab
   * without wiring an Authorization header; contains no PII beyond what's already
   * in the app. Swap for a signed URL if you need stricter access.
   */
  @Get('documents/:docId/pdf')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async render(@Param('docId', new ParseUUIDPipe()) docId: string, @Res() res: Response) {
    const doc = await this.service.findOne(docId);
    try {
      const stock = await this.stockService.findOne(doc.stock_id);
      res.send(renderDocumentHtml(doc, stock as never));
    } catch {
      res.status(404).send('Stock not found');
    }
  }
}
