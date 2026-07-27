import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Customer } from './customer.entity';
import { CustomerDocument, CustomerDocType } from './customer-document.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'customers');

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectRepository(CustomerDocument) private readonly docRepo: Repository<CustomerDocument>,
  ) {}

  async findAll(q: { search?: string; status?: string; customer_type?: string; page?: number; limit?: number }) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.repo.createQueryBuilder('c').leftJoinAndSelect('c.currency', 'currency');
    if (q.status) qb.andWhere('c.status = :status', { status: q.status });
    if (q.customer_type) qb.andWhere('c.customer_type = :ct', { ct: q.customer_type });
    if (q.search?.trim()) {
      const term = `%${q.search.trim()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b.where('c.legal_name LIKE :t', { t: term })
            .orWhere('c.legal_name_ar LIKE :t', { t: term })
            .orWhere('c.code LIKE :t', { t: term })
            .orWhere('c.cr_number LIKE :t', { t: term })
            .orWhere('c.national_id LIKE :t', { t: term })
            .orWhere('c.phone LIKE :t', { t: term }),
        ),
      );
    }
    qb.orderBy('c.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows, total, page, limit };
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id }, relations: ['currency', 'documents'] });
    if (!c) throw new NotFoundException(`Customer ${id} not found`);
    return c;
  }

  async create(dto: CreateCustomerDto, userEmail: string) {
    this.validateTypeConstraints(dto);
    const code = await this.nextCode();
    const { credit_limit, ...rest } = dto;
    const entity = this.repo.create({
      ...rest,
      code,
      credit_limit: (credit_limit ?? 0).toFixed(2),
      currency_id: dto.currency_id ?? null,
      payment_terms: dto.payment_terms ?? 'cod',
      status: dto.status ?? 'active',
      shipping_same_as_billing: dto.shipping_same_as_billing ?? true,
      created_by: userEmail,
      updated_by: userEmail,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateCustomerDto, userEmail: string) {
    const c = await this.findOne(id);
    const merged = { ...c, ...dto } as Customer;
    this.validateTypeConstraints(merged);
    const { credit_limit, ...rest } = dto;
    Object.assign(c, rest, { updated_by: userEmail });
    if (credit_limit !== undefined) c.credit_limit = credit_limit.toFixed(2);
    return this.repo.save(c);
  }

  async remove(id: string) {
    const c = await this.findOne(id);
    const dir = path.join(UPLOAD_ROOT, id);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    await this.repo.remove(c);
    return { id, deleted: true };
  }

  private validateTypeConstraints(dto: { customer_type: string; cr_number?: string | null; national_id?: string | null }) {
    if (dto.customer_type === 'business' && !dto.cr_number) {
      throw new BadRequestException('cr_number is required for business customers');
    }
    if (dto.customer_type === 'individual' && !dto.national_id) {
      throw new BadRequestException('national_id is required for individual customers');
    }
  }

  // ---------- Documents ----------

  async listDocuments(customerId: string) {
    await this.findOne(customerId);
    return this.docRepo.find({ where: { customer_id: customerId }, order: { uploaded_at: 'DESC' } });
  }

  async addDocument(
    customerId: string,
    file: Express.Multer.File | undefined,
    body: { doc_type: CustomerDocType; reference_no?: string; issue_date?: string; expiry_date?: string },
    userEmail: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    await this.findOne(customerId);
    const doc = this.docRepo.create({
      customer_id: customerId,
      doc_type: body.doc_type,
      file_name: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      storage_path: file.path,
      reference_no: body.reference_no ?? null,
      issue_date: body.issue_date ?? null,
      expiry_date: body.expiry_date ?? null,
      uploaded_by: userEmail,
    });
    return this.docRepo.save(doc);
  }

  async getDocument(customerId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId, customer_id: customerId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async removeDocument(customerId: string, docId: string) {
    const doc = await this.getDocument(customerId, docId);
    await fs.unlink(doc.storage_path).catch(() => undefined);
    await this.docRepo.remove(doc);
    return { id: docId, deleted: true };
  }

  private async nextCode(): Promise<string> {
    const last = await this.repo
      .createQueryBuilder('c')
      .select('c.code', 'code')
      .orderBy('c.created_at', 'DESC')
      .limit(1)
      .getRawOne<{ code: string }>();
    const next = last?.code ? Number(last.code.replace(/\D/g, '')) + 1 : 1;
    return `C-${String(next).padStart(6, '0')}`;
  }
}
