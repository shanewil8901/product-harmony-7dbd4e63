import { Module } from '@nestjs/common';
import { BarcodesController } from './barcodes.controller';

@Module({
  controllers: [BarcodesController],
})
export class BarcodesModule {}
