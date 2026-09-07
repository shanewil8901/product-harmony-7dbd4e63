import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { Stock } from '../stock/stock.entity';
import { Vendor } from '../vendors/vendor.entity';

/**
 * Manual correction to on-hand stock. Inventory itself stays derived:
 * available = received − sold + Σ(signed adjustments).
 */
export type AdjustmentType =
  | 'customer_return'
  | 'vendor_return'
  | 'damage'
  | 'loss'
  | 'expiry'
  | 'found'
  | 'correction_increase'
  | 'correction_decrease';

export const ADJUSTMENT_TYPES: AdjustmentType[] = [
  'customer_return',
  'vendor_return',
  'damage',
  'loss',
  'expiry',
  'found',
  'correction_increase',
  'correction_decrease',
];

/** +1 adds stock back on hand, −1 removes it. */
export const ADJUSTMENT_SIGN: Record<AdjustmentType, 1 | -1> = {
  customer_return: 1,
  found: 1,
  correction_increase: 1,
  vendor_return: -1,
  damage: -1,
  loss: -1,
  expiry: -1,
  correction_decrease: -1,
};

@Entity({ name: 'stock_adjustments' })
export class StockAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  product_id!: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product | null;

  /** Optional batch this correction belongs to. */
  @Column({ name: 'stock_id', type: 'varchar', length: 36, nullable: true })
  stock_id!: string | null;

  @ManyToOne(() => Stock, { nullable: true })
  @JoinColumn({ name: 'stock_id' })
  stock?: Stock | null;

  /** Vendor for vendor returns; customer returns leave this empty. */
  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  vendor_id!: string | null;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor?: Vendor | null;

  @Column({ type: 'varchar', length: 32 })
  type!: AdjustmentType;

  /** Always stored positive — the type decides the direction. */
  @Column({ type: 'decimal', precision: 12, scale: 3 })
  qty!: string;

  @Column({ name: 'reference_no', type: 'varchar', length: 64, nullable: true })
  reference_no!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'adjusted_at', type: 'datetime', precision: 6 })
  adjusted_at!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by!: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 6, nullable: true })
  deleted_at!: Date | null;

  @Column({ name: 'deleted_by', type: 'varchar', length: 255, nullable: true })
  deleted_by!: string | null;
}
