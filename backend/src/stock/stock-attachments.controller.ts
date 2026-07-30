import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { RoleCode } from '../master-data/role.entity';
import { StockAttachmentsService } from './stock-attachments.service';
import type { StockAttachmentStage } from './stock-attachment.entity';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock/:id/attachments')
export class StockAttachmentsController {
  constructor(private readonly service: StockAttachmentsService) {}

  @Get()
  list(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listForStock(id);
  }

  /** Optional at every lifecycle stage — any operational role may attach evidence. */
  @Post()
  @Roles('admin', 'manager', 'employee', 'warehouse', 'sales')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: async (req, _file, cb) => {
          const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
          const dir = path.resolve(process.cwd(), 'uploads', 'stock', idParam as string);
          await fs.mkdir(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException('Only PDF, JPG, PNG or WEBP files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('stage') stage: StockAttachmentStage | undefined,
    @Body('reference_no') reference_no: string | undefined,
    @Body('notes') notes: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.service.add(id, file, { stage, reference_no, notes }, req.user.email);
  }

  @Get(':attachmentId/download')
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Res() res: Response,
  ) {
    const doc = await this.service.getOne(id, attachmentId);
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.file_name)}"`,
    );
    createReadStream(doc.storage_path).pipe(res);
  }

  @Delete(':attachmentId')
  @Roles('admin', 'manager')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.service.remove(id, attachmentId, req.user.email);
  }
}
