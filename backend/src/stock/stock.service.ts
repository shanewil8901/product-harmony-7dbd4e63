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
import { StockHistoryService } from './stock-history.service';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock) private readonly repo: Repository<Stock>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly documents: StockDocumentsService,
    private readonly history: StockHistoryService,
  ) {}

  private readonly STOCK_RELATIONS = [
    'product',
    'qty_uom',
    'buying_currency_snapshot',
    'selling_currency_snapshot',
  ];

  private enrich<T extends Stock>(s: T) {
    // Inventory value is always based on the BUYING (cost) price, never the selling price.
    const totalBuyingValue = Number(s.qty) * Number(s.buying_price_snapshot);
    const totalSellingValue = Number(s.qty) * Number(s.selling_price_snapshot);
    return {
      ...s,
      product_code: s.product?.productCode ?? null,
      product_description: s.product?.description ?? null,
      qty_uom_code: s.qty_uom?.code ?? null,
      qty_uom_name: s.qty_uom?.name ?? null,
      buying_currency_code: s.buying_currency_snapshot?.code ?? null,
      buying_currency_symbol: s.buying_currency_snapshot?.symbol ?? null,
      selling_currency_code: s.selling_currency_snapshot?.code ?? null,
      selling_currency_symbol: s.selling_currency_snapshot?.symbol ?? null,
      total_buying_value: totalBuyingValue.toFixed(2),
      total_selling_value: totalSellingValue.toFixed(2),
    };
  }

  /** Aggregate buying value grouped by currency — reports must never mix currencies. */
  private summarize(rows: Stock[]) {
    const byCurrency = new Map<string, { currency_code: string; total_buying_value: number; qty: number; count: number }>();
    for (const r of rows) {
      const code = r.buying_currency_snapshot?.code ?? '—';
      const entry =
        byCurrency.get(code) ?? { currency_code: code, total_buying_value: 0, qty: 0, count: 0 };
      entry.total_buying_value += Number(r.qty) * Number(r.buying_price_snapshot);
      entry.qty += Number(r.qty);
      entry.count += 1;
      byCurrency.set(code, entry);
    }
    return [...byCurrency.values()].map((e) => ({
      currency_code: e.currency_code,
      total_buying_value: e.total_buying_value.toFixed(2),
      total_qty: e.qty.toFixed(3),
      lines: e.count,
    }));
  }

  async findAll(q: QueryStockDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.product', 'product')
      .leftJoinAndSelect('s.qty_uom', 'qty_uom')
      .leftJoinAndSelect('s.buying_currency_snapshot', 'buying_currency_snapshot')
      .leftJoinAndSelect('s.selling_currency_snapshot', 'selling_currency_snapshot')
      .where('s.deleted_at IS NULL');

    if (q.product_id) qb.andWhere('s.product_id = :pid', { pid: q.product_id });
    if (q.status) qb.andWhere('s.status = :st', { st: q.status });
    if (q.search && q.search.trim()) {
      const term = `%${q.search.trim()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b
            .where('s.batch_no LIKE :term', { term })
            .orWhere('s.vendor_name LIKE :term', { term })
            .orWhere('s.notes LIKE :term', { term })
            // Autocomplete search also matches the joined product.
            .orWhere('product.productCode LIKE :term', { term })
            .orWhere('product.description LIKE :term', { term }),
        ),
      );
    }

    qb.orderBy('s.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => this.enrich(r)),
      total,
      page,
      limit,
      summary: this.summarize(rows),
    };
  }


  async findOne(id: string) {
    const s = await this.repo.findOne({
      where: { id },
      relations: this.STOCK_RELATIONS,
    });
    if (!s) throw new NotFoundException(`Stock ${id} not found`);
    return this.enrich(s);
  }

  /** Vendor must exist, be active, and not be soft-deleted — no placeholders allowed. */
  private async requireVendor(vendorId: string | null | undefined) {
    if (!vendorId) throw new BadRequestException('Vendor is required — select a registered vendor');
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor)
      throw new BadRequestException('Unknown vendor — only registered vendors can be used');
    if (vendor.status !== 'active')
      throw new BadRequestException(`Vendor "${vendor.legal_name}" is not active`);
    return vendor;
  }

  private assertDates(manufacture: string | null, expiry: string | null) {
    if (!expiry) throw new BadRequestException('Expiry date is required');
    if (manufacture && new Date(expiry) <= new Date(manufacture))
      throw new BadRequestException('Expiry date must be after the manufacture date');
  }

  async create(
    dto: CreateStockDto,
    userEmail: string,
  ): Promise<{ stock: Stock; po_document: StockDocument }> {
    const product = await this.productRepo.findOne({ where: { id: dto.product_id } });
    if (!product) throw new BadRequestException('Invalid product_id');

    const vendor = await this.requireVendor(dto.vendor_id);
    this.assertDates(dto.manufacture_date ?? null, dto.expiry_date ?? null);

    const entity = this.repo.create({
      product_id: dto.product_id,
      vendor_id: vendor.id,
      vendor_name: vendor.legal_name,
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
      expiry_date: dto.expiry_date,
      ordered_at: dto.ordered_at ? new Date(dto.ordered_at) : new Date(),
      // New procurement lifecycle starts at "inquiry_sent" (auto Inquiry doc).
      status: 'inquiry_sent',
      notes: dto.notes ?? null,
      created_by: userEmail,
      updated_by: userEmail,
    });
    const saved = await this.repo.save(entity);
    await this.history.logCreate(saved, userEmail);

    // Auto-generate the Inquiry document — first stage of the procurement pipeline.
    const { document } = await this.documents.createForStock(
      saved.id,
      'inquiry',
      { vendor: saved.vendor_name, requested_qty: saved.qty },
      userEmail,
      { skipTransitionCheck: true },
    );

    return { stock: saved, po_document: document };
  }

  async update(id: string, dto: UpdateStockDto, userEmail: string) {
    const s = await this.findOne(id);
    const before: Partial<Stock> = { ...s };
    // Status is document-driven — strip it if a client sends it anyway.
    const { qty, ordered_at, vendor_id, vendor_name, ...rest } = dto;
    delete (rest as Record<string, unknown>).status;
    Object.assign(s, rest, { updated_by: userEmail });

    // Vendor can be changed, but never cleared or set to an unregistered value.
    if (vendor_id !== undefined) {
      const vendor = await this.requireVendor(vendor_id);
      s.vendor_id = vendor.id;
      s.vendor_name = vendor.legal_name;
    }
    this.assertDates(s.manufacture_date ?? null, s.expiry_date ?? null);

    if (qty !== undefined) s.qty = qty.toFixed(3);
    if (ordered_at !== undefined) s.ordered_at = ordered_at ? new Date(ordered_at) : null;
    const saved = await this.repo.save(s);
    await this.history.logUpdate(id, before, saved, userEmail);
    return saved;
  }


  async remove(id: string, userEmail: string) {
    const s = await this.findOne(id);
    s.deleted_by = userEmail;
    await this.repo.save(s);
    await this.repo.softRemove(s);
    await this.history.logDelete(s, userEmail);
    return { id, deleted: true };
  }
}
