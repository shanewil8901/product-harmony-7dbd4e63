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
/** Passport-size profile photos stay small on purpose. */
const MAX_PHOTO_MB = 5;
const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
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

  /** Read-only check used by the employee form — never mutates anything. */
  @Get('email-check')
  emailCheck(@Query('email') email: string) {
    return this.service.checkEmail(email);
  }

  /** Signed-in user's own HR dashboard (all roles). */
  @Get('me/overview')
  @Roles('admin', 'manager', 'warehouse', 'sales', 'employee')
  myOverview(@Req() req: AuthedRequest) {
    return this.service.selfOverview(req.user.id);
  }

  @Get('me/photo')
  @Roles('admin', 'manager', 'warehouse', 'sales', 'supervisor', 'employee')
  async myPhoto(@Req() req: AuthedRequest, @Res() res: Response) {
    const photo = await this.service.findPhotoByUser(req.user.id);
    if (!photo) {
      res.status(204).send();
      return;
    }
    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'no-store');
    createReadStream(photo.storage_path).pipe(res);
  }

  /** Read-only HR dashboard for one employee (admin / manager). */
  @Get(':id/overview')
  overview(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.employeeOverview(id);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }


  @Post()
  create(@Body() dto: CreateEmployeeDto, @Req() req: AuthedRequest) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(id, dto, req.user.id);
  }

  // --- Optional passport-size profile photo (max 5 MB) ---
  @Get(':id/photo')
  @Roles('admin', 'manager', 'supervisor')
  async photo(@Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    const photo = await this.service.findPhoto(id);
    if (!photo) {
      res.status(204).send();
      return;
    }
    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'no-store');
    createReadStream(photo.storage_path).pipe(res);
  }

  @Post(':id/photo')
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
          cb(null, `photo-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: MAX_PHOTO_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!PHOTO_MIME.has(file.mimetype)) {
          cb(new BadRequestException('The photo must be a JPG, PNG or WEBP image'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadPhoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    if (!file) throw new BadRequestException('Choose a photo to upload');
    return this.service.setPhoto(id, file, req.user.id);
  }

  @Delete(':id/photo')
  deletePhoto(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.removePhoto(id);
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
    return this.service.addDocument(id, docType as EmployeeDocType, file, req.user.id);
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
