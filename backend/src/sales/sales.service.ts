import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { SalesOrder, SALES_ALLOWED_FROM, SalesOrderStatus } from './sales-order.entity';
import { SalesOrderItem } from './sales-order-item.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { Currency } from '../master-data/currency.entity';
import { CreateSalesOrderDto, SalesOrderItemDto } from './dto/create-sales-order.dto';
import { ChangeSalesStatusDto, UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import {
  SalesDocument,
  SALES_DOC_PREFIX,
  type SalesDocType,
} from './sales-document.entity';
import { renderSalesDocumentHtml } from './sales-document-templates';
import { SalesPayment } from './sales-payment.entity';
import { RecordSalesPaymentDto } from './dto/record-sales-payment.dto';
import { SalesHistoryService } from './sales-history.service';

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(SalesOrder) private readonly repo: Repository<SalesOrder>,
    @InjectRepository(SalesOrderItem) private readonly itemRepo: Repository<SalesOrderItem>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Currency) private readonly currencyRepo: Repository<Currency>,
    @InjectRepository(SalesDocument) private readonly docRepo: Repository<SalesDocument>,
    @InjectRepository(SalesPayment) private readonly payRepo: Repository<SalesPayment>,
    private readonly dataSource: DataSource,
    private readonly history: SalesHistoryService,
  ) {}

  /** Never leak raw ids to clients — every relation is flattened to codes/names. */
  private toDto(o: SalesOrder, payments: SalesPayment[] = []) {
    const outstanding = Number(o.total_amount) - Number(o.amount_paid);
    const credit = this.creditSummary(payments);
    return {
      ...o,
      payments,
      ...credit,
      customer_code: o.customer?.code ?? null,
      customer_name: o.customer?.legal_name ?? null,
      customer_phone: o.customer?.phone ?? null,
      customer_vat_number: o.customer?.vat_number ?? null,
      company_vat_number: process.env.COMPANY_VAT_NUMBER ?? null,
      currency_code: o.currency?.code ?? null,
      currency_symbol: o.currency?.symbol ?? null,
      outstanding_amount: money(Math.max(outstanding, 0)),
      items: (o.items ?? []).map((i) => ({
        ...i,
        uom_code: i.uom?.code ?? null,
        product_code: i.product_code_snapshot,
        description: i.description_snapshot,
      })),
    };
  }

  /**
   * Credit invoices stay "Pending payment" until a supervisor confirms the
   * funds. Once the expected date passes without confirmation — or the credit
   * is cancelled — the order is flagged "Not received" / high priority.
   */
  private creditSummary(payments: SalesPayment[]) {
    const today = new Date().toISOString().slice(0, 10);
    const credits = payments.filter((p) => p.method === 'credit');
    const overdue = credits.filter(
      (p) => p.status === 'pending' && !!p.expected_date && p.expected_date < today,
    );
    const notReceived = credits.filter((p) => p.status === 'not_received' || p.status === 'cancelled');
    const pending = credits.filter((p) => p.status === 'pending');

    const sum = (rows: SalesPayment[]) => rows.reduce((s, r) => s + Number(r.amount), 0);
    const payment_state: 'settled' | 'credit_pending' | 'not_received' =
      notReceived.length || overdue.length
        ? 'not_received'
        : pending.length
          ? 'credit_pending'
          : 'settled';

    return {
      payment_state,
      credit_pending_amount: money(sum(pending)),
      credit_not_received_amount: money(sum(notReceived) + sum(overdue)),
      credit_due_date: pending.map((p) => p.expected_date).filter(Boolean).sort()[0] ?? null,
      high_priority: payment_state === 'not_received',
    };
  }

  private async paymentsFor(orderIds: string[]) {
    if (!orderIds.length) return new Map<string, SalesPayment[]>();
    const rows = await this.payRepo.find({
      where: { order_id: In(orderIds) },
      order: { created_at: 'ASC' },
    });
    const map = new Map<string, SalesPayment[]>();
    // Proof scans can be large — list responses only advertise their presence.
    for (const r of rows) {
      const light = {
        ...r,
        proof_file_data: null,
        has_proof_file: !!r.proof_file_data,
      } as SalesPayment;
      map.set(r.order_id, [...(map.get(r.order_id) ?? []), light]);
    }
    return map;
  }

  private async nextOrderNo() {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const like = `SO-${datePart}-%`;
    const last = await this.repo
      .createQueryBuilder('o')
      .withDeleted()
      .where('o.order_no LIKE :like', { like })
      .orderBy('o.order_no', 'DESC')
      .getOne();
    const seq = last ? Number(last.order_no.split('-').pop() ?? '0') + 1 : 1;
    return `SO-${datePart}-${String(seq).padStart(4, '0')}`;
  }

  private async resolveCurrency(code: string | undefined, fallbackId: string | null) {
    if (code) {
      const found = await this.currencyRepo.findOne({ where: { code: code.toUpperCase() } });
      if (!found) throw new BadRequestException(`Unknown currency "${code}"`);
      return found;
    }
    if (fallbackId) {
      const found = await this.currencyRepo.findOne({ where: { id: fallbackId } });
      if (found) return found;
    }
    return this.currencyRepo.findOne({ where: { code: 'SAR' } });
  }

  /** Build item rows with snapshotted product data and per-line totals. */
  private async buildItems(dtoItems: SalesOrderItemDto[]) {
    const ids = [...new Set(dtoItems.map((i) => i.product_id))];
    const products = await this.productRepo.find({ where: { id: In(ids) } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const rows = dtoItems.map((i) => {
      const p = byId.get(i.product_id);
      if (!p) throw new BadRequestException('Unknown product on one of the order lines');
      const unitPrice = i.unit_price ?? Number(p.sellingPrice);
      const gross = i.qty * unitPrice;
      // Discounts are percentage-based; a legacy amount is converted back to %.
      const percent =
        i.discount_percent !== undefined
          ? i.discount_percent
          : gross > 0 && i.discount_amount
            ? (i.discount_amount / gross) * 100
            : 0;
      const boundedPercent = Math.min(Math.max(percent, 0), 100);
      const discount = (gross * boundedPercent) / 100;
      const lineTotal = Math.max(gross - discount, 0);
      return {
        product_id: p.id,
        stock_id: i.stock_id ?? null,
        product_code_snapshot: p.productCode ?? null,
        description_snapshot: p.description ?? null,
        qty: i.qty.toFixed(3),
        uom_id: i.uom_id ?? p.base_uom_id ?? null,
        unit_price: money(unitPrice),
        unit_cost_snapshot: money(Number(p.buyingPrice ?? 0)),
        discount_percent: boundedPercent.toFixed(2),
        discount_amount: money(discount),
        line_total: money(lineTotal),
      };
    });
    const subtotal = rows.reduce((s, r) => s + Number(r.line_total), 0);
    return { rows, subtotal };
  }

  private totals(subtotal: number, vatRate: number) {
    const vat = (subtotal * vatRate) / 100;
    return {
      subtotal: money(subtotal),
      vat_rate: vatRate.toFixed(2),
      vat_amount: money(vat),
      total_amount: money(subtotal + vat),
    };
  }

  async list(params: { search?: string; status?: string; customer_id?: string } = {}) {
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.currency', 'currency')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.uom', 'uom')
      .where('o.deleted_at IS NULL')
      .orderBy('o.created_at', 'DESC');

    if (params.status) qb.andWhere('o.status = :st', { st: params.status });
    if (params.customer_id) qb.andWhere('o.customer_id = :cid', { cid: params.customer_id });
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      qb.andWhere(
        '(o.order_no LIKE :term OR o.invoice_no LIKE :term OR customer.legal_name LIKE :term OR customer.code LIKE :term)',
        { term },
      );
    }
    const rows = await qb.getMany();
    const payments = await this.paymentsFor(rows.map((r) => r.id));
    return rows.map((r) => this.toDto(r, payments.get(r.id) ?? []));
  }

  async findOne(id: string) {
    const o = await this.repo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!o) throw new NotFoundException('Sales order not found');
    const payments = await this.payRepo.find({
      where: { order_id: o.id },
      order: { created_at: 'ASC' },
    });
    return this.toDto(
      o,
      payments.map((p) => ({ ...p, proof_file_data: null, has_proof_file: !!p.proof_file_data }) as SalesPayment),
    );
  }

  async create(dto: CreateSalesOrderDto, actor: string) {
    const customer = await this.customerRepo.findOne({ where: { id: dto.customer_id } });
    if (!customer) throw new BadRequestException('Unknown customer — register the customer first');
    if (customer.status !== 'active')
      throw new BadRequestException('That customer is inactive — reactivate it before selling');

    const currency = await this.resolveCurrency(dto.currency_code, customer.currency_id);
    const { rows, subtotal } = await this.buildItems(dto.items);
    const vatRate = dto.vat_rate ?? 15;

    const id = await this.dataSource.transaction(async (mgr) => {
      const order = await mgr.save(
        mgr.create(SalesOrder, {
          order_no: await this.nextOrderNo(),
          customer_id: customer.id,
          order_date: dto.order_date ?? new Date().toISOString().slice(0, 10),
          expected_delivery_date: dto.expected_delivery_date ?? null,
          status: 'draft' as SalesOrderStatus,
          currency_id: currency?.id ?? null,
          discount_amount: '0.00',
          amount_paid: '0.00',
          notes: dto.notes ?? null,
          created_by: actor,
          updated_by: actor,
          ...this.totals(subtotal, vatRate),
        }),
      );
      await mgr.save(rows.map((r) => mgr.create(SalesOrderItem, { ...r, order_id: order.id })));
      return order.id;
    });
    const created = await this.findOne(id);
    await this.history.logCreate(created as unknown as Record<string, unknown>, actor);
    return created;
  }

  async update(id: string, dto: UpdateSalesOrderDto, actor: string) {
    const order = await this.repo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!order) throw new NotFoundException('Sales order not found');
    const before = { ...order };
    if (order.status !== 'draft')
      throw new BadRequestException(
        `Only draft orders can be edited — this order is "${order.status}".`,
      );

    if (dto.currency_code) {
      const currency = await this.resolveCurrency(dto.currency_code, order.currency_id);
      order.currency_id = currency?.id ?? null;
    }
    if (dto.order_date) order.order_date = dto.order_date;
    if (dto.expected_delivery_date !== undefined)
      order.expected_delivery_date = dto.expected_delivery_date ?? null;
    if (dto.notes !== undefined) order.notes = dto.notes ?? null;

    const vatRate = dto.vat_rate ?? Number(order.vat_rate);
    if (dto.items?.length) {
      const { rows, subtotal } = await this.buildItems(dto.items);
      await this.dataSource.transaction(async (mgr) => {
        await mgr.delete(SalesOrderItem, { order_id: order.id });
        await mgr.save(rows.map((r) => mgr.create(SalesOrderItem, { ...r, order_id: order.id })));
        Object.assign(order, this.totals(subtotal, vatRate), { updated_by: actor });
        await mgr.save(SalesOrder, order);
      });
    } else {
      Object.assign(order, this.totals(Number(order.subtotal), vatRate), { updated_by: actor });
      await this.repo.save(order);
    }
    await this.history.logUpdate(id, before, order, actor);
    return this.findOne(id);
  }

  /** Forward-only status machine with the data each stage legally requires. */
  async changeStatus(id: string, dto: ChangeSalesStatusDto, actor: string) {
    const order = await this.repo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!order) throw new NotFoundException('Sales order not found');

    const previousStatus = order.status;
    const allowedFrom = SALES_ALLOWED_FROM[dto.status] ?? [];
    if (!allowedFrom.includes(order.status)) {
      throw new BadRequestException(
        `Cannot move a "${order.status}" order to "${dto.status}". Allowed from: ${
          allowedFrom.join(', ') || 'nothing'
        }.`,
      );
    }

    // The invoice number is issued by the system; a manual override is only
    // honoured when the caller explicitly supplies one.
    if (dto.status === 'invoiced') {
      order.invoice_no = dto.invoice_no?.trim() || (await this.nextDocNo('sales_invoice'));
      order.invoiced_at = new Date();
    }
    if (dto.status === 'paid') {
      const paid = dto.amount_paid ?? Number(order.total_amount);
      if (!(paid > 0)) throw new BadRequestException('Enter the amount received.');
      if (paid + 0.009 < Number(order.total_amount))
        throw new BadRequestException(
          `Payment is short — ${money(Number(order.total_amount) - paid)} still outstanding. Record a partial payment instead.`,
        );
      order.amount_paid = money(paid);
      order.paid_at = new Date();
    }
    if (dto.status === 'cancelled') {
      if (!dto.reason?.trim())
        throw new BadRequestException('A cancellation reason is required.');
      order.cancel_reason = dto.reason.trim();
    }

    order.status = dto.status;
    order.updated_by = actor;
    await this.repo.save(order);

    // Delivery notes and invoices are system-generated — never typed by hand.
    if (dto.status === 'delivered') await this.issueDocument(order.id, 'delivery_order', actor);
    if (dto.status === 'invoiced')
      await this.issueDocument(order.id, 'sales_invoice', actor, order.invoice_no ?? undefined);

    await this.history.logStatusChange(
      order.id,
      previousStatus,
      dto.status,
      actor,
      dto.reason?.trim() ? { reason: dto.reason.trim() } : {},
    );

    return this.findOne(id);
  }

  /** Sequential document numbers, e.g. DO-20260810-0001 / INV-20260810-0001. */
  private async nextDocNo(type: SalesDocType) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const like = `${SALES_DOC_PREFIX[type]}-${datePart}-%`;
    const last = await this.docRepo
      .createQueryBuilder('d')
      .where('d.doc_no LIKE :like', { like })
      .orderBy('d.doc_no', 'DESC')
      .getOne();
    const seq = last ? Number(last.doc_no.split('-').pop() ?? '0') + 1 : 1;
    return `${SALES_DOC_PREFIX[type]}-${datePart}-${String(seq).padStart(4, '0')}`;
  }

  /**
   * Issues a document once per order and type. The order snapshot is stored on
   * the document so reprints never change when the order changes later.
   */
  async issueDocument(orderId: string, type: SalesDocType, actor: string, docNo?: string) {
    const existing = await this.docRepo.findOne({ where: { order_id: orderId, doc_type: type } });
    if (existing) return existing;
    const snapshot = await this.findOne(orderId);
    const saved = await this.docRepo.save(
      this.docRepo.create({
        doc_no: docNo ?? (await this.nextDocNo(type)),
        doc_type: type,
        order_id: orderId,
        payload: snapshot as unknown as Record<string, unknown>,
        issued_at: new Date(),
        issued_by: actor,
      }),
    );
    await this.history.logDocument(
      orderId,
      { doc_type: type, doc_number: saved.doc_no },
      actor,
    );
    return saved;
  }

  async documents(orderId: string) {
    return this.docRepo.find({ where: { order_id: orderId }, order: { issued_at: 'ASC' } });
  }

  /** Printable HTML rendered from the stored snapshot. */
  async renderDocument(orderId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId, order_id: orderId } });
    if (!doc) throw new NotFoundException('Document not found');
    const order = (doc.payload ?? (await this.findOne(orderId))) as unknown as Parameters<
      typeof renderSalesDocumentHtml
    >[1];
    return renderSalesDocumentHtml(doc, order);
  }

  /** Payments recorded against an order — cash, bank transfer or credit. */
  async payments(orderId: string) {
    return this.payRepo.find({ where: { order_id: orderId }, order: { created_at: 'ASC' } });
  }

  /**
   * Partial settlement without advancing the lifecycle. Cash and bank
   * transfers settle straight away; credit is parked until confirmed.
   */
  async recordPayment(id: string, dto: RecordSalesPaymentDto, actor: string) {
    const order = await this.repo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!order) throw new NotFoundException('Sales order not found');
    const amount = Number(dto.amount);
    if (!(amount > 0)) throw new BadRequestException('Enter an amount greater than zero.');
    if (order.status === 'cancelled' || order.status === 'draft')
      throw new BadRequestException('Confirm the order before recording payments.');

    const committed = await this.committedAmount(id);
    if (committed + amount > Number(order.total_amount) + 0.009)
      throw new BadRequestException('That payment exceeds the order total.');

    const isCredit = dto.method === 'credit';
    let expected = dto.expected_date ?? null;
    if (isCredit) {
      if (!dto.credit_days && !expected)
        throw new BadRequestException('Enter the number of days until the cash is expected.');
      if (!expected && dto.credit_days) {
        const d = new Date();
        d.setDate(d.getDate() + dto.credit_days);
        expected = d.toISOString().slice(0, 10);
      }
    }

    const payment = await this.payRepo.save(
      this.payRepo.create({
        order_id: id,
        amount: money(amount),
        method: dto.method,
        status: isCredit ? 'pending' : 'received',
        proof_doc_no: dto.proof_doc_no?.trim() || null,
        proof_file_name: dto.proof_file_name ?? null,
        proof_file_data: dto.proof_file_data ?? null,
        bank_reference: dto.bank_reference?.trim() || null,
        credit_reference: dto.credit_reference?.trim() || null,
        credit_days: dto.credit_days ?? null,
        expected_date: expected,
        confirmed_at: isCredit ? null : new Date(),
        confirmed_by: isCredit ? null : actor,
        note: dto.note?.trim() || null,
        created_by: actor,
      }),
    );

    if (!isCredit) await this.applySettlement(order, amount, actor);
    else {
      order.updated_by = actor;
      await this.repo.save(order);
    }
    await this.history.logPayment(
      id,
      {
        method: payment.method,
        amount: payment.amount,
        status: payment.status,
        reference: payment.bank_reference ?? payment.credit_reference ?? payment.proof_doc_no,
        note: payment.note,
      },
      actor,
    );
    return { payment, order: await this.findOne(id) };
  }

  /** Money already received or awaiting credit confirmation. */
  private async committedAmount(orderId: string) {
    const rows = await this.payRepo.find({ where: { order_id: orderId } });
    return rows
      .filter((r) => r.status === 'received' || r.status === 'pending')
      .reduce((s, r) => s + Number(r.amount), 0);
  }

  private async applySettlement(order: SalesOrder, amount: number, actor: string) {
    const paid = Number(order.amount_paid) + amount;
    order.amount_paid = money(paid);
    if (paid + 0.009 >= Number(order.total_amount) && order.status === 'invoiced') {
      order.status = 'paid';
      order.paid_at = new Date();
    }
    order.updated_by = actor;
    await this.repo.save(order);
  }

  /**
   * Supervisor decision on a credit line: `received` books the cash,
   * `not_received` (or cancellation) flags the order as high priority.
   */
  async decideCredit(
    orderId: string,
    paymentId: string,
    decision: 'received' | 'not_received' | 'cancelled',
    actor: string,
    note?: string,
  ) {
    const payment = await this.payRepo.findOne({ where: { id: paymentId, order_id: orderId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.method !== 'credit')
      throw new BadRequestException('Only credit payments need confirmation.');
    if (payment.status !== 'pending')
      throw new BadRequestException(`This credit is already "${payment.status}".`);

    const order = await this.repo.findOne({ where: { id: orderId, deleted_at: IsNull() } });
    if (!order) throw new NotFoundException('Sales order not found');

    payment.status = decision;
    payment.confirmed_at = new Date();
    payment.confirmed_by = actor;
    if (note?.trim()) payment.note = note.trim();
    await this.payRepo.save(payment);

    if (decision === 'received') await this.applySettlement(order, Number(payment.amount), actor);
    else {
      order.updated_by = actor;
      await this.repo.save(order);
    }
    await this.history.logPayment(
      orderId,
      {
        method: payment.method,
        amount: payment.amount,
        status: decision,
        reference: payment.credit_reference ?? payment.bank_reference,
        note: payment.note,
      },
      actor,
    );
    return this.findOne(orderId);
  }

  async remove(id: string, actor: string) {
    const order = await this.repo.findOne({ where: { id, deleted_at: IsNull() } });
    if (!order) throw new NotFoundException('Sales order not found');
    if (order.status !== 'draft' && order.status !== 'cancelled')
      throw new BadRequestException('Only draft or cancelled orders can be deleted.');
    order.updated_by = actor;
    await this.repo.save(order);
    const snapshot = await this.findOne(id);
    await this.repo.softDelete(id);
    await this.history.logDelete(snapshot as unknown as Record<string, unknown>, actor);
    return { id, deleted: true };
  }
}
