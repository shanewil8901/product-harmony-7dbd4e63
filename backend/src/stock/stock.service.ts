import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Stock } from './stock.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { QueryStockDto } from './dto/query-stock.dto';
import { Product } from '../products/product.entity';
import { StockDocumentsService } from './stock-documents.service';
import type { StockDocument } from './stock-document.entity';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock) private readonly repo: Repository<Stock>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly documents: StockDocumentsService,
  ) {}

  async findAll(q: QueryStockDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.repo.createQueryBuilder('s').where('s.deleted_at IS NULL');

    if (q.product_id) qb.andWhere('s.product_id = :pid', { pid: q.product_id });
    if (q.status) qb.andWhere('s.status = :st', { st: q.status });
    if (q.search && q.search.trim()) {
      const term = `%${q.search.trim()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('s.batch_no LIKE :term', { term })
            .orWhere('s.vendor_name LIKE :term', { term })
            .orWhere('s.notes LIKE :term', { term }),
        ),
      );
    }

    qb.orderBy('s.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`Stock ${id} not found`);
    return s;
  }

  async create(
    dto: CreateStockDto,
    userEmail: string,
  ): Promise<{ stock: Stock; po_document: StockDocument }> {
    const product = await this.productRepo.findOne({ where: { id: dto.product_id } });
    if (!product) throw new BadRequestException('Invalid product_id');

    const entity = this.repo.create({
      product_id: dto.product_id,
      vendor_id: dto.vendor_id ?? 'TBD',
      vendor_name: dto.vendor_name ?? 'Vendor TBD',
      batch_no: dto.batch_no ?? null,
      qty: dto.qty.toFixed(3),
      qty_uom_id: dto.qty_uom_id ?? product.base_uom_id,
      // Snapshot product prices at the moment of ordering — later product edits
      // MUST NOT retroactively change this stock record.
      buying_price_snapshot: product.buyingPrice,
      buying_currency_id_snapshot: product.buying_currency_id,
      selling_price_snapshot: product.sellingPrice,
      selling_currency_id_snapshot: product.selling_currency_id,
      manufacture_date: dto.manufacture_date ?? null,
      expiry_date: dto.expiry_date ?? null,
      ordered_at: dto.ordered_at ? new Date(dto.ordered_at) : new Date(),
      // Lifecycle rule: new stock always starts as "ordered". Manual override ignored.
      status: 'ordered',
      notes: dto.notes ?? null,
      created_by: userEmail,
      updated_by: userEmail,
    });
    const saved = await this.repo.save(entity);

    // Auto-generate the Purchase Order document for the new stock row.
    const { document } = await this.documents.createForStock(
      saved.id,
      'po',
      { ordered_qty: saved.qty, vendor: saved.vendor_name },
      userEmail,
      { skipTransitionCheck: true },
    );

    return { stock: saved, po_document: document };
  }

  async update(id: string, dto: UpdateStockDto, userEmail: string) {
    const s = await this.findOne(id);
    // Status is document-driven — strip it if a client sends it anyway.
    const { qty, ordered_at, ...rest } = dto;
    delete (rest as Record<string, unknown>).status;
    Object.assign(s, rest, { updated_by: userEmail });
    if (qty !== undefined) s.qty = qty.toFixed(3);
    if (ordered_at !== undefined) s.ordered_at = ordered_at ? new Date(ordered_at) : null;
    return this.repo.save(s);
  }

  async remove(id: string, userEmail: string) {
    const s = await this.findOne(id);
    s.deleted_by = userEmail;
    await this.repo.save(s);
    await this.repo.softRemove(s);
    return { id, deleted: true };
  }
}
