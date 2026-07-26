import { BadRequestException, Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as bwipjs from 'bwip-js';

@ApiTags('barcodes')
@Controller('barcodes')
export class BarcodesController {
  @Get('ean13/:code')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({ summary: 'Render a 13-digit EAN-13 barcode as a PNG image' })
  async ean13(@Param('code') code: string, @Res() res: Response) {
    if (!/^\d{13}$/.test(code)) {
      throw new BadRequestException('code must be exactly 13 digits');
    }
    try {
      const png = await bwipjs.toBuffer({
        bcid: 'ean13',
        text: code,
        scale: 3,
        height: 20,
        includetext: true,
        textxalign: 'center',
        backgroundcolor: 'FFFFFF',
      });
      res.setHeader('Content-Length', png.length);
      res.end(png);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Failed to render barcode',
      );
    }
  }
}
