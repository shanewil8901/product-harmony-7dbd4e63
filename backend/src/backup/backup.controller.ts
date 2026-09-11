import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BackupService } from './backup.service';

interface AuthedRequest {
  user: { id: string; name?: string; email?: string };
}

@ApiTags('backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Controller('backups')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Get()
  @ApiOperation({ summary: 'Backup history (newest first)' })
  list(@Query('limit') limit?: string) {
    const n = Number(limit);
    return this.service.list(Number.isFinite(n) ? n : 100);
  }

  @Get('status')
  @ApiOperation({ summary: 'Schedule, retention and Google Drive status' })
  status() {
    return this.service.status();
  }

  @Post('run')
  @ApiOperation({ summary: 'Run a backup now (file name carries the user name)' })
  run(@Req() req: AuthedRequest) {
    return this.service.runManual({ id: req.user.id, name: req.user.name ?? req.user.email });
  }

  @Post('run-files')
  @ApiOperation({ summary: 'Zip all uploaded/generated files now and log the archive' })
  runFiles(@Req() req: AuthedRequest) {
    return this.service.runFilesManual({ id: req.user.id, name: req.user.name ?? req.user.email });
  }

  @Post(':id/upload')
  @ApiOperation({ summary: 'Push a stored backup to Google Drive now' })
  upload(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.uploadNow(id);
  }

  @Post('purge')
  @ApiOperation({ summary: 'Delete local backups older than the retention window' })
  purge() {
    return this.service.purgeNow();
  }
}
