import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SalesOrder } from './sales-order.entity';

export type SalesPaymentMethod = 'cash' | 'bank_transfer' | 'credit';
export const SALES_PAYMENT_METHODS: SalesPaymentMethod[] = ['cash', 'bank_transfer', 'credit'];

/**
 * Credit lifecycle. Cash / bank transfers settle immediately and are stored as
 * `received`; credit stays `pending` until a supervisor confirms the funds.
 */
export type SalesPaymentStatus = 'pending' | 'received' | 'not_received' | 'cancelled';
export const SALES_PAYMENT_STATUSES: SalesPaymentStatus[] = [
  'pending',
  'received',
  'not_received',
  'cancelled',
];

@Entity({ name: 'sales_payments' })
export class SalesPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  order_id!: string;

  @ManyToOne(() => SalesOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: SalesOrder;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 24 })
  method!: SalesPaymentMethod;

  @Column({ type: 'varchar', length: 24, default: 'received' })
  status!: SalesPaymentStatus;

  /** Cash: voucher / receipt number. */
  @Column({ name: 'proof_doc_no', type: 'varchar', length: 64, nullable: true })
  proof_doc_no!: string | null;

  /** Cash: uploaded scan, stored inline as a data URL. */
  @Column({ name: 'proof_file_name', type: 'varchar', length: 255, nullable: true })
  proof_file_name!: string | null;

  @Column({ name: 'proof_file_data', type: 'longtext', nullable: true })
  proof_file_data!: string | null;

  /** Bank transfer reference. */
  @Column({ name: 'bank_reference', type: 'varchar', length: 64, nullable: true })
  bank_reference!: string | null;

  /** Credit reference number and agreed settlement window. */
  @Column({ name: 'credit_reference', type: 'varchar', length: 64, nullable: true })
  credit_reference!: string | null;

  @Column({ name: 'credit_days', type: 'int', nullable: true })
  credit_days!: number | null;

  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expected_date!: string | null;

  @Column({ name: 'confirmed_at', type: 'datetime', precision: 6, nullable: true })
  confirmed_at!: Date | null;

  @Column({ name: 'confirmed_by', type: 'varchar', length: 255, nullable: true })
  confirmed_by!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updated_at!: Date;
}
