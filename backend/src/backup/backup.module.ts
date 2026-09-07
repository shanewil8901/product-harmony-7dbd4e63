import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbBackup } from './backup.entity';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { GoogleDriveService } from './gdrive.service';

/**
 * Database backup module: local dump every 15 minutes, one Google Drive
 * upload per day, nightly purge of local files older than the retention
 * window, plus manual runs from the admin screen.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DbBackup])],
  controllers: [BackupController],
  providers: [BackupService, GoogleDriveService],
  exports: [BackupService],
})
export class BackupModule {}
