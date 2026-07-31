import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Vendor } from './vendor.entity';
import { VendorDocument, VendorDocType } from './vendor-document.entity';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'vendors');

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor) private readonly repo: Repository<Vendor>,
    @InjectRepository(VendorDocument) private readonly docRepo: Repository<VendorDocument>,
  ) {}

  async findAll(q: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.repo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.currency', 'currency');
    if (q.status) qb.andWhere('v.status = :status', { status: q.status });
    if (q.search?.trim()) {
      const term = `%${q.search.trim()}%`;
      qb.andWhere(
        new Brackets((b) =>
          b.where('v.legal_name LIKE :t', { t: term })
            .orWhere('v.legal_name_ar LIKE :t', { t: term })
            .orWhere('v.code LIKE :t', { t: term })
            .orWhere('v.cr_number LIKE :t', { t: term })
            .orWhere('v.vat_number LIKE :t', { t: term })
            .orWhere('v.phone LIKE :t', { t: term }),
        ),
      );
    }
    qb.orderBy('v.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows, total, page, limit };
  }

  async findOne(id: string) {
    const v = await this.repo.findOne({ where: { id }, relations: ['currency', 'documents'] });
    if (!v) throw new NotFoundException(`Vendor ${id} not found`);
    return v;
  }

  /** ZATCA compliance: a registered vendor must always carry a VAT number. */
  private assertCompliance(vat?: string | null) {
    if (!vat || !vat.trim())
      throw new BadRequestException('VAT registration number is required for vendors');
  }

  async create(dto: CreateVendorDto, userEmail: string) {
    this.assertCompliance(dto.vat_number);
    const dupe = await this.repo.findOne({ where: { cr_number: dto.cr_number } });
    if (dupe) throw new ConflictException('A vendor with this CR number already exists');
    const code = await this.nextCode();
    const entity = this.repo.create({
      ...dto,
      code,
      currency_id: dto.currency_id ?? null,
      payment_terms: dto.payment_terms ?? 'net_30',
      lead_time_days: dto.lead_time_days ?? 7,
      status: dto.status ?? 'active',
      created_by: userEmail,
      updated_by: userEmail,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateVendorDto, userEmail: string) {
    const v = await this.findOne(id);
    if (dto.cr_number && dto.cr_number !== v.cr_number) {
      const dupe = await this.repo.findOne({ where: { cr_number: dto.cr_number } });
      if (dupe && dupe.id !== id) throw new ConflictException('CR number already in use');
    }
    Object.assign(v, dto, { updated_by: userEmail });
    this.assertCompliance(v.vat_number);
    return this.repo.save(v);
  }

  async remove(id: string) {
    const v = await this.findOne(id);
    // best-effort: remove uploaded files on disk
    const dir = path.join(UPLOAD_ROOT, id);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    await this.repo.remove(v);
    return { id, deleted: true };
  }

  // ---------- Documents ----------

  async listDocuments(vendorId: string) {
    await this.findOne(vendorId);
    return this.docRepo.find({ where: { vendor_id: vendorId }, order: { uploaded_at: 'DESC' } });
  }

  async addDocument(
    vendorId: string,
    file: Express.Multer.File | undefined,
    body: { doc_type: VendorDocType; reference_no?: string; issue_date?: string; expiry_date?: string },
    userEmail: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    await this.findOne(vendorId);
    const doc = this.docRepo.create({
      vendor_id: vendorId,
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

  async getDocument(vendorId: string, docId: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId, vendor_id: vendorId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async removeDocument(vendorId: string, docId: string) {
    const doc = await this.getDocument(vendorId, docId);
    await fs.unlink(doc.storage_path).catch(() => undefined);
    await this.docRepo.remove(doc);
    return { id: docId, deleted: true };
  }

  private async nextCode(): Promise<string> {
    const last = await this.repo
      .createQueryBuilder('v')
      .select('v.code', 'code')
      .orderBy('v.created_at', 'DESC')
      .limit(1)
      .getRawOne<{ code: string }>();
    const next = last?.code ? Number(last.code.replace(/\D/g, '')) + 1 : 1;
    return `V-${String(next).padStart(6, '0')}`;
  }
}
