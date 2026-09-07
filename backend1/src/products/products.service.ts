import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { Product } from './product.entity';
import { ProductHistory, ProductHistoryAction } from './product-history.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Department } from '../master-data/department.entity';
import { BarcodeCounter } from '../master-data/barcode-counter.entity';
import { Vendor } from '../vendors/vendor.entity';

const HISTORY_TRACKED_FIELDS: (keyof Product)[] = [
  'description',
  'baseQty',
  'weight',
  'buyingPrice',
  'sellingPrice',
  'department_id',
  'base_uom_id',
  'weight_uom_id',
  'buying_currency_id',
  'selling_currency_id',
  'productCode',
  'product_barcode',
  'vendor_id',
];

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly repo: Repository<Product>,
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    @InjectRepository(Vendor) private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(ProductHistory) private readonly historyRepo: Repository<ProductHistory>,
    private readonly dataSource: DataSource,
  ) {}

  private readonly PRODUCT_RELATIONS = [
    'department',
    'vendor',
    'base_uom',
    'weight_uom',
    'buying_currency',
    'selling_currency',
  ];

  private enrich<T extends Product>(p: T) {
    return {
      ...p,
      department_code: p.department?.code ?? null,
      vendor_name: p.vendor?.legal_name ?? null,
      vendor_code: p.vendor?.code ?? null,
      department_name: p.department?.name ?? null,
      base_uom_code: p.base_uom?.code ?? null,
      base_uom_name: p.base_uom?.name ?? null,
      weight_uom_code: p.weight_uom?.code ?? null,
      weight_uom_name: p.weight_uom?.name ?? null,
      buying_currency_code: p.buying_currency?.code ?? null,
      buying_currency_symbol: p.buying_currency?.symbol ?? null,
      selling_currency_code: p.selling_currency?.code ?? null,
      selling_currency_symbol: p.selling_currency?.symbol ?? null,
    };
  }

  async findAll(q: QueryProductDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.department', 'department')
      .leftJoinAndSelect('p.vendor', 'vendor')
      .leftJoinAndSelect('p.base_uom', 'base_uom')
      .leftJoinAndSelect('p.weight_uom', 'weight_uom')
      .leftJoinAndSelect('p.buying_currency', 'buying_currency')
      .leftJoinAndSelect('p.selling_currency', 'selling_currency')
      .where('p.deleted_at IS NULL');

    if (q.search && q.search.trim()) {
      const term = `%${q.search.trim()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('p.productCode LIKE :term', { term })
            .orWhere('p.product_barcode LIKE :term', { term }),
        ),
      );
    }

    qb.orderBy('p.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((r) => this.enrich(r)), total, page, limit };
  }

  async findOne(id: string) {
    const product = await this.repo.findOne({
      where: { id },
      relations: this.PRODUCT_RELATIONS,
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return this.enrich(product);
  }

  async findHistory(productId: string) {
    await this.findOne(productId);
    return this.historyRepo.find({
      where: { product_id: productId },
      order: { changed_at: 'DESC' },
    });
  }

  async create(dto: CreateProductDto, userEmail: string) {
    const dept = await this.deptRepo.findOne({ where: { id: dto.department_id } });
    if (!dept) throw new BadRequestException('Invalid department_id');
    if (dto.vendor_id) {
      const vendor = await this.vendorRepo.findOne({ where: { id: dto.vendor_id } });
      if (!vendor) throw new BadRequestException('Invalid vendor_id');
    }

    const descPart = dto.description.substring(0, 3).toUpperCase().replace(/\s/g, 'X');
    const timePart = Date.now().toString().slice(-6);
    const productCode = `${dept.code}-${descPart}-${timePart}`;
    const product_barcode = await this.generateEan13();

    const existing = await this.repo.findOne({ where: { productCode } });
    if (existing) throw new ConflictException('Generated productCode collision, please retry');

    const entity = this.repo.create({
      ...dto,
      productCode,
      product_barcode,
      baseQty: dto.baseQty.toFixed(3),
      weight: dto.weight.toFixed(3),
      buyingPrice: dto.buyingPrice.toFixed(2),
      sellingPrice: dto.sellingPrice.toFixed(2),
      created_by: userEmail,
      updated_by: userEmail,
    });
    const saved = await this.repo.save(entity);
    await this.logHistory(saved.id, 'create', null, saved, userEmail);
    return saved;
  }

  async update(id: string, dto: UpdateProductDto, userEmail: string) {
    const product = await this.findOne(id);
    if (dto.vendor_id) {
      const vendor = await this.vendorRepo.findOne({ where: { id: dto.vendor_id } });
      if (!vendor) throw new BadRequestException('Invalid vendor_id');
    }
    const before = { ...product };
    const { baseQty, weight, buyingPrice, sellingPrice, ...rest } = dto;
    const patch: Partial<Product> = { ...rest, updated_by: userEmail };
    if (baseQty !== undefined) patch.baseQty = baseQty.toFixed(3);
    if (weight !== undefined) patch.weight = weight.toFixed(3);
    if (buyingPrice !== undefined) patch.buyingPrice = buyingPrice.toFixed(2);
    if (sellingPrice !== undefined) patch.sellingPrice = sellingPrice.toFixed(2);

    Object.assign(product, patch);
    const saved = await this.repo.save(product);
    await this.logHistory(saved.id, 'update', before, saved, userEmail);
    return saved;
  }

  async remove(id: string, userEmail: string) {
    const product = await this.findOne(id);
    const before = { ...product };
    product.deleted_by = userEmail;
    await this.repo.save(product);
    await this.repo.softRemove(product);
    await this.logHistory(id, 'delete', before, null, userEmail);
    return { id, deleted: true };
  }

  // ---------- History ----------

  private async logHistory(
    productId: string,
    action: ProductHistoryAction,
    before: Partial<Product> | null,
    after: Partial<Product> | null,
    userEmail: string,
  ) {
    let changes: Record<string, { from: unknown; to: unknown }> | null = null;
    if (action === 'update' && before && after) {
      changes = {};
      for (const key of HISTORY_TRACKED_FIELDS) {
        const from = (before as Record<string, unknown>)[key as string];
        const to = (after as Record<string, unknown>)[key as string];
        if (String(from ?? '') !== String(to ?? '')) {
          changes[key as string] = { from: from ?? null, to: to ?? null };
        }
      }
      if (Object.keys(changes).length === 0) return; // nothing tracked changed
    }
    const record = this.historyRepo.create({
      product_id: productId,
      action,
      changes,
      snapshot: after ?? before ?? null,
      changed_by: userEmail,
    });
    await this.historyRepo.save(record);
  }

  // ---------- Barcode helpers ----------

  private async generateEan13(): Promise<string> {
    const prefix = (process.env.KSA_COMPANY_PREFIX ?? '6281234').replace(/\D/g, '');
    if (prefix.length < 4 || prefix.length > 11) {
      throw new BadRequestException('KSA_COMPANY_PREFIX must be 4-11 numeric digits');
    }
    const seq = await this.nextBarcodeSequence();
    const itemLen = 12 - prefix.length;
    const itemPart = String(seq).padStart(itemLen, '0').slice(-itemLen);
    const base12 = `${prefix}${itemPart}`;
    const check = this.ean13CheckDigit(base12);
    return `${base12}${check}`;
  }

  private async nextBarcodeSequence(): Promise<number> {
    return this.dataSource.transaction(async (tx) => {
      const row = await tx
        .getRepository(BarcodeCounter)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: 'default' })
        .getOne();

      const current = row ? Number(row.next_val) : 1;
      const next = current + 1;
      if (row) {
        await tx.getRepository(BarcodeCounter).update({ id: 'default' }, { next_val: String(next) });
      } else {
        await tx.getRepository(BarcodeCounter).save({ id: 'default', next_val: String(next) });
      }
      return current;
    });
  }

  private ean13CheckDigit(base12: string): number {
    if (!/^\d{12}$/.test(base12)) {
      throw new BadRequestException('EAN-13 base must be 12 digits');
    }
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const d = base12.charCodeAt(i) - 48;
      sum += i % 2 === 0 ? d : d * 3;
    }
    return (10 - (sum % 10)) % 10;
  }
}
