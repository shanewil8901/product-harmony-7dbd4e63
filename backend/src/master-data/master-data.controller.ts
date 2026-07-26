import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './department.entity';
import { Uom } from './uom.entity';
import { Currency } from './currency.entity';
import { Role } from './role.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('master-data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('master-data')
export class MasterDataController {
  constructor(
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    @InjectRepository(Uom) private readonly uomRepo: Repository<Uom>,
    @InjectRepository(Currency) private readonly curRepo: Repository<Currency>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

  @Get('departments')
  departments() {
    return this.deptRepo.find({ order: { name: 'ASC' } });
  }

  @Get('uoms')
  uoms() {
    return this.uomRepo.find({ order: { name: 'ASC' } });
  }

  @Get('currencies')
  currencies() {
    return this.curRepo.find({ order: { code: 'ASC' } });
  }

  @Get('roles')
  roles() {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }
}
