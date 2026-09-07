import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

export type CustomerDocType =
  | 'cr'
  | 'vat'
  | 'national_id'
  | 'iqama'
  | 'national_address'
  | 'other';

export const CUSTOMER_DOC_TYPES: CustomerDocType[] = [
  'cr',
  'vat',
  'national_id',
  'iqama',
  'national_address',
  'other',
];

export const CUSTOMER_DOC_LABEL: Record<CustomerDocType, string> = {
  cr: 'Commercial Registration',
  vat: 'VAT Certificate',
  national_id: 'National ID',
  iqama: 'Iqama',
  national_address: 'National Address Certificate',
  other: 'Other',
};

@Entity({ name: 'customer_documents' })
export class CustomerDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  customer_id!: string;

  @ManyToOne(() => Customer, (c) => c.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'varchar', length: 32 })
  doc_type!: CustomerDocType;

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
