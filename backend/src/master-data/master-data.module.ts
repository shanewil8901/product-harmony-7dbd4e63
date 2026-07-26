import { Module, OnModuleInit } from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './department.entity';
import { Uom } from './uom.entity';
import { Currency } from './currency.entity';
import { BarcodeCounter } from './barcode-counter.entity';
import { Role } from './role.entity';
import { MasterDataController } from './master-data.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Department, Uom, Currency, BarcodeCounter, Role])],
  controllers: [MasterDataController],
  exports: [TypeOrmModule],
})
export class MasterDataModule implements OnModuleInit {
  constructor(
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    @InjectRepository(Uom) private readonly uomRepo: Repository<Uom>,
    @InjectRepository(Currency) private readonly curRepo: Repository<Currency>,
    @InjectRepository(BarcodeCounter) private readonly counterRepo: Repository<BarcodeCounter>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
  ) {}

  async onModuleInit() {
    await this.seed(this.deptRepo, 'code', [
      { code: 'GRO', name: 'Grocery', location: 'Aisle 1' },
      { code: 'BAK', name: 'Bakery', location: 'Aisle 2' },
      { code: 'DAI', name: 'Dairy', location: 'Cold Room' },
      { code: 'BEV', name: 'Beverages', location: 'Aisle 3' },
      { code: 'HOU', name: 'Household', location: 'Aisle 4' },
    ]);
    await this.seed(this.uomRepo, 'code', [
      { code: 'PCS', name: 'Pieces', kind: 'base' },
      { code: 'BOX', name: 'Box', kind: 'base' },
      { code: 'PACK', name: 'Pack', kind: 'base' },
      { code: 'KG', name: 'Kilogram', kind: 'weight' },
      { code: 'G', name: 'Gram', kind: 'weight' },
      { code: 'L', name: 'Liter', kind: 'weight' },
      { code: 'ML', name: 'Milliliter', kind: 'weight' },
    ]);
    await this.seed(this.curRepo, 'code', [
      { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    ]);
    await this.seed(this.roleRepo, 'code', [
      { code: 'admin', name: 'Administrator' },
      { code: 'manager', name: 'Manager' },
      { code: 'warehouse', name: 'Warehouse Staff' },
      { code: 'sales', name: 'Sales Staff' },
      { code: 'employee', name: 'Employee' },
    ]);
    const existing = await this.counterRepo.findOne({ where: { id: 'default' } });
    if (!existing) {
      await this.counterRepo.save({ id: 'default', next_val: '1' });
    }
  }

  private async seed<T extends { code: string }>(
    repo: Repository<T>,
    key: 'code',
    rows: Array<Partial<T>>,
  ) {
    for (const row of rows) {
      const existing = await repo.findOne({ where: { [key]: row[key] } as any });
      if (!existing) await repo.save(repo.create(row as any) as any);
    }
  }
}
