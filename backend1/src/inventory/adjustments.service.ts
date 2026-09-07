import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ADJUSTMENT_SIGN, StockAdjustment } from './stock-adjustment.entity';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { Product } from '../products/product.entity';
import { Stock } from '../stock/stock.entity';
import { Vendor } from '../vendors/vendor.entity';

@Injectable()
export class AdjustmentsService {
  constructor(
    @InjectRepository(StockAdjustment) private readonly repo: Repository<StockAdjustment>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Stock) private readonly stockRepo: Repository<Stock>,
    @InjectRepository(Vendor) private readonly vendorRepo: Repository<Vendor>,
  ) {}

  private enrich(a: StockAdjustment) {
    const sign = ADJUSTMENT_SIGN[a.type];
    return {
      ...a,
      sign,
      signed_qty: (sign * Number(a.qty)).toFixed(3),
      product_code: a.product?.productCode ?? null,
      product_description: a.product?.description ?? null,
      vendor_name: a.vendor?.legal_name ?? null,
      batch_no: a.stock?.batch_no ?? null,
    };
  }

  async findAll(q: { product_id?: string; type?: string; search?: string } = {}) {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.product', 'product')
      .leftJoinAndSelect('a.vendor', 'vendor')
      .leftJoinAndSelect('a.stock', 'stock')
      .where('a.deleted_at IS NULL');

    if (q.product_id) qb.andWhere('a.product_id = :pid', { pid: q.product_id });
    if (q.type && q.type !== 'all') qb.andWhere('a.type = :t', { t: q.type });
    if (q.search?.trim()) {
      const term = `%${q.search.trim()}%`;
      qb.andWhere(
        '(product.productCode LIKE :term OR product.description LIKE :term OR a.reference_no LIKE :term OR a.reason LIKE :term)',
        { term },
      );
    }
    const rows = await qb.orderBy('a.adjusted_at', 'DESC').take(200).getMany();
    return { items: rows.map((r) => this.enrich(r)) };
  }

  async create(dto: CreateAdjustmentDto, userEmail: string) {
    const product = await this.productRepo.findOne({
      where: { id: dto.product_id, deleted_at: IsNull() },
    });
    if (!product) throw new BadRequestException('Invalid product_id');

    if (dto.stock_id) {
      const batch = await this.stockRepo.findOne({ where: { id: dto.stock_id } });
      if (!batch || batch.product_id !== product.id)
        throw new BadRequestException('Batch does not belong to this product');
    }
    if (dto.vendor_id) {
      const vendor = await this.vendorRepo.findOne({ where: { id: dto.vendor_id } });
      if (!vendor) throw new BadRequestException('Unknown vendor');
    }
    if (dto.type === 'vendor_return' && !dto.vendor_id)
      throw new BadRequestException('A vendor return requires the vendor it is returned to');

    const entity = this.repo.create({
      product_id: product.id,
      stock_id: dto.stock_id ?? null,
      vendor_id: dto.vendor_id ?? null,
      type: dto.type,
      qty: dto.qty.toFixed(3),
      reference_no: dto.reference_no ?? null,
      reason: dto.reason ?? null,
      adjusted_at: dto.adjusted_at ? new Date(dto.adjusted_at) : new Date(),
      created_by: userEmail,
    });
    return this.repo.save(entity);
  }

  /** Adjustments are never edited — they are reversed by voiding (soft delete). */
  async remove(id: string, userEmail: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException(`Adjustment ${id} not found`);
    a.deleted_by = userEmail;
    await this.repo.save(a);
    await this.repo.softRemove(a);
    return { id, voided: true };
  }
}
