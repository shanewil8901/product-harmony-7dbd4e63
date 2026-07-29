import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StockDocType =
  | 'inquiry'
  | 'quotation'
  | 'po'
  | 'vendor_invoice'
  | 'payment'
  | 'shipping'
  | 'customs_clearance'
  | 'dispatch'
  | 'grn'
  | 'putaway'
  | 'sales_invoice'
  | 'payment_receipt'
  | 'write_off'
  | 'cancellation';

export const STOCK_DOC_TYPES: StockDocType[] = [
  'inquiry',
  'quotation',
  'po',
  'vendor_invoice',
  'payment',
  'shipping',
  'customs_clearance',
  'dispatch',
  'grn',
  'putaway',
  'sales_invoice',
  'payment_receipt',
  'write_off',
  'cancellation',
];

@Entity({ name: 'stock_documents' })
export class StockDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'stock_id', type: 'varchar', length: 36 })
  stock_id!: string;

  @Column({ name: 'doc_type', type: 'varchar', length: 32 })
  doc_type!: StockDocType;

  @Index({ unique: true })
  @Column({ name: 'doc_number', type: 'varchar', length: 64 })
  doc_number!: string;

  @Column({ type: 'json', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'generated_at', type: 'datetime', precision: 6 })
  generated_at!: Date;

  @Column({ name: 'generated_by', type: 'varchar', length: 255, nullable: true })
  generated_by!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updated_at!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 6, nullable: true })
  deleted_at!: Date | null;
}
