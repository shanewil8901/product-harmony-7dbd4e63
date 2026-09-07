import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { Currency } from '../master-data/currency.entity';
import { SalesOrderItem } from './sales-order-item.entity';

export type SalesOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'delivered'
  | 'invoiced'
  | 'paid'
  | 'cancelled';

export const SALES_ORDER_STATUSES: SalesOrderStatus[] = [
  'draft',
  'confirmed',
  'delivered',
  'invoiced',
  'paid',
  'cancelled',
];

/** Forward-only sales lifecycle; cancellation is allowed before delivery. */
export const SALES_ALLOWED_FROM: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: [],
  confirmed: ['draft'],
  delivered: ['confirmed'],
  invoiced: ['delivered', 'confirmed'],
  paid: ['invoiced'],
  cancelled: ['draft', 'confirmed'],
};

@Entity({ name: 'sales_orders' })
export class SalesOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'order_no', type: 'varchar', length: 32 })
  order_no!: string;

  @Index()
  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  customer_id!: string;

  @ManyToOne(() => Customer, { eager: true, nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ name: 'order_date', type: 'date' })
  order_date!: string;

  @Column({ name: 'expected_delivery_date', type: 'date', nullable: true })
  expected_delivery_date!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: SalesOrderStatus;

  @Column({ name: 'currency_id', type: 'varchar', length: 36, nullable: true })
  currency_id!: string | null;

  @ManyToOne(() => Currency, { eager: true, nullable: true })
  @JoinColumn({ name: 'currency_id' })
  currency?: Currency | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  subtotal!: string;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  discount_amount!: string;

  /** KSA standard VAT — stored per order so historical documents stay correct. */
  @Column({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2, default: '15.00' })
  vat_rate!: string;

  @Column({ name: 'vat_amount', type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  vat_amount!: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  total_amount!: string;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  amount_paid!: string;

  @Column({ name: 'invoice_no', type: 'varchar', length: 64, nullable: true })
  invoice_no!: string | null;

  @Column({ name: 'invoiced_at', type: 'datetime', precision: 6, nullable: true })
  invoiced_at!: Date | null;

  @Column({ name: 'paid_at', type: 'datetime', precision: 6, nullable: true })
  paid_at!: Date | null;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 255, nullable: true })
  cancel_reason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => SalesOrderItem, (i) => i.order, { cascade: true, eager: true })
  items!: SalesOrderItem[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;
  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by!: string | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updated_at!: Date;
  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by!: string | null;
  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 6, nullable: true })
  deleted_at!: Date | null;
}
