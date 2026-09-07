import {
  BadRequestException,
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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CUSTOMER_DOC_TYPES, CustomerDocType } from './customer-document.entity';

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

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('search_field') search_field?: string,
    @Query('status') status?: string,
    @Query('customer_type') customer_type?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      search,
      search_field,
      status,
      customer_type,
      sort,
      order,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('admin', 'manager', 'sales')
  create(@Body() dto: CreateCustomerDto, @Req() req: AuthedRequest) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles('admin', 'manager', 'sales')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(id);
  }

  // ---------- Documents ----------

  @Get(':id/documents')
  listDocs(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listDocuments(id);
  }

  @Post(':id/documents')
  @Roles('admin', 'manager', 'sales')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: async (req, _file, cb) => {
          const customerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
          const dir = path.resolve(process.cwd(), 'uploads', 'customers', customerId);
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
  async uploadDoc(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('doc_type') doc_type: CustomerDocType,
    @Body('reference_no') reference_no: string | undefined,
    @Body('issue_date') issue_date: string | undefined,
    @Body('expiry_date') expiry_date: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    if (!doc_type || !CUSTOMER_DOC_TYPES.includes(doc_type)) {
      throw new BadRequestException('Invalid doc_type');
    }
    return this.service.addDocument(
      id,
      file,
      { doc_type, reference_no, issue_date, expiry_date },
      req.user.id,
    );
  }

  @Get(':id/documents/:docId/download')
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @Res() res: Response,
  ) {
    const doc = await this.service.getDocument(id, docId);
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.file_name)}"`,
    );
    createReadStream(doc.storage_path).pipe(res);
  }

  @Delete(':id/documents/:docId')
  @Roles('admin', 'manager')
  removeDoc(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
  ) {
    return this.service.removeDocument(id, docId);
  }
}
