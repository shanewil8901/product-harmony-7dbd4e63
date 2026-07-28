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
  create(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateStockDocumentDto,
    @Req() req: AuthedRequest,
  ) {
    if (!canRunStage(req.user.role, dto.doc_type)) {
      throw new ForbiddenException(
        `Your role (${req.user.role ?? 'none'}) cannot generate this document`,
      );
    }
    return this.service.createForStock(id, dto.doc_type, dto.payload, req.user.email);
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
