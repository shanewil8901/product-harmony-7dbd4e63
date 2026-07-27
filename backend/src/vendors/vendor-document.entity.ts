import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';

export type VendorDocType =
  | 'cr'
  | 'vat'
  | 'national_address'
  | 'iban_letter'
  | 'other';

export const VENDOR_DOC_TYPES: VendorDocType[] = [
  'cr',
  'vat',
  'national_address',
  'iban_letter',
  'other',
];

export const VENDOR_DOC_LABEL: Record<VendorDocType, string> = {
  cr: 'Commercial Registration',
  vat: 'VAT Certificate',
  national_address: 'National Address Certificate',
  iban_letter: 'Bank IBAN Letter',
  other: 'Other',
};

@Entity({ name: 'vendor_documents' })
export class VendorDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  vendor_id!: string;

  @ManyToOne(() => Vendor, (v) => v.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor!: Vendor;

  @Column({ type: 'varchar', length: 32 })
  doc_type!: VendorDocType;

  @Column({ type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ type: 'varchar', length: 128 })
  mime_type!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'varchar', length: 512 })
  storage_path!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  reference_no!: string | null;

  @Column({ type: 'date', nullable: true })
  issue_date!: string | null;

  @Column({ type: 'date', nullable: true })
  expiry_date!: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  uploaded_at!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  uploaded_by!: string | null;
}
