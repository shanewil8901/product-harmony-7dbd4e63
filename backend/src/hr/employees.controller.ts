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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EMPLOYEE_DOC_TYPES, EmployeeDocType } from './employee-document.entity';

interface AuthedRequest {
  user: { id: string; email: string; name: string; role: RoleCode | null };
}

const MAX_UPLOAD_MB = 10;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  list(@Query('search') search?: string, @Query('status') status?: string) {
    return this.service.list({ search, status });
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto, @Req() req: AuthedRequest) {
    return this.service.create(dto, req.user.email);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(id, dto, req.user.email);
  }

  // --- Documents (Iqama copy is optional but validated when provided) ---
  @Get(':id/documents')
  listDocs(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listDocuments(id);
  }

  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: async (req, _file, cb) => {
          const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
          const dir = path.resolve(process.cwd(), 'uploads', 'employees', idParam as string);
          await fs.mkdir(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
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
    @Body('doc_type') docType: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    if (!file) throw new BadRequestException('Choose a file to upload');
    if (!EMPLOYEE_DOC_TYPES.includes(docType as EmployeeDocType))
      throw new BadRequestException('Select a valid document type');
    return this.service.addDocument(id, docType as EmployeeDocType, file, req.user.email);
  }

  @Get(':id/documents/:docId/file')
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @Res() res: Response,
  ) {
    const doc = await this.service.findDocument(id, docId);
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
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
