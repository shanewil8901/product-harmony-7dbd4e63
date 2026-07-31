import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { Uom } from '../master-data/uom.entity';
import { Currency } from '../master-data/currency.entity';

export type StockStatus =
  | 'inquiry_sent'
  | 'quotation_received'
  | 'quotation_approved'
  | 'invoice_received'
  | 'payment_processed'
  | 'shipped'
  | 'customs_cleared'
  | 'ordered'
  | 'in_transit'
  | 'received'
  | 'in_warehouse'
  | 'sold_out'
  | 'settled'
  | 'expired'
  | 'cancelled';

export const STOCK_STATUSES: StockStatus[] = [
  'inquiry_sent',
  'quotation_received',
  'quotation_approved',
  'invoice_received',
  'payment_processed',
  'shipped',
  'customs_cleared',
  'ordered',
  'in_transit',
  'received',
  'in_warehouse',
  'sold_out',
  'settled',
  'expired',
  'cancelled',
];

@Entity({ name: 'product_stock' })
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  product_id!: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product | null;

  /** Registered vendor id — enforced non-empty and validated against the vendors table. */
  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  vendor_id!: string | null;

  @Column({ name: 'vendor_name', type: 'varchar', length: 255, nullable: true })
  vendor_name!: string | null;

  @Column({ name: 'batch_no', type: 'varchar', length: 64, nullable: true })
  batch_no!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  qty!: string;

  @Column({ name: 'qty_uom_id', type: 'varchar', length: 36, nullable: true })
  qty_uom_id!: string | null;

  @ManyToOne(() => Uom, { nullable: true })
  @JoinColumn({ name: 'qty_uom_id' })
  qty_uom?: Uom | null;

  // --- Snapshot of the product's buy/sell values at the time this order was placed ---
  @Column({ name: 'buying_price_snapshot', type: 'decimal', precision: 10, scale: 2 })
  buying_price_snapshot!: string;

  @Column({ name: 'buying_currency_id_snapshot', type: 'varchar', length: 36, nullable: true })
  buying_currency_id_snapshot!: string | null;

  @ManyToOne(() => Currency, { nullable: true })
  @JoinColumn({ name: 'buying_currency_id_snapshot' })
  buying_currency_snapshot?: Currency | null;

  @Column({ name: 'selling_price_snapshot', type: 'decimal', precision: 10, scale: 2 })
  selling_price_snapshot!: string;

  @Column({ name: 'selling_currency_id_snapshot', type: 'varchar', length: 36, nullable: true })
  selling_currency_id_snapshot!: string | null;

  @ManyToOne(() => Currency, { nullable: true })
  @JoinColumn({ name: 'selling_currency_id_snapshot' })
  selling_currency_snapshot?: Currency | null;

  @Column({ name: 'manufacture_date', type: 'date', nullable: true })
  manufacture_date!: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiry_date!: string | null;

  @Column({ name: 'ordered_at', type: 'datetime', precision: 6, nullable: true })
  ordered_at!: Date | null;

  @Column({ type: 'varchar', length: 32, default: 'ordered' })
  status!: StockStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

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

  @Column({ name: 'deleted_by', type: 'varchar', length: 255, nullable: true })
  deleted_by!: string | null;
}
