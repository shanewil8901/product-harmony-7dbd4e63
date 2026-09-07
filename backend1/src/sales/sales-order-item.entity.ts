import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { Uom } from '../master-data/uom.entity';
import { SalesOrder } from './sales-order.entity';

/**
 * A sold line. Product description, code and unit price are snapshotted so a
 * later catalogue edit can never rewrite an existing order.
 */
@Entity({ name: 'sales_order_items' })
export class SalesOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  order_id!: string;

  @ManyToOne(() => SalesOrder, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: SalesOrder;

  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  product_id!: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product?: Product | null;

  /** Optional link to the specific warehouse batch this line was served from. */
  @Column({ name: 'stock_id', type: 'varchar', length: 36, nullable: true })
  stock_id!: string | null;

  @Column({ name: 'product_code_snapshot', type: 'varchar', length: 64, nullable: true })
  product_code_snapshot!: string | null;

  @Column({ name: 'description_snapshot', type: 'varchar', length: 255, nullable: true })
  description_snapshot!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  qty!: string;

  @Column({ name: 'uom_id', type: 'varchar', length: 36, nullable: true })
  uom_id!: string | null;

  @ManyToOne(() => Uom, { eager: true, nullable: true })
  @JoinColumn({ name: 'uom_id' })
  uom?: Uom | null;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unit_price!: string;

  @Column({ name: 'unit_cost_snapshot', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  unit_cost_snapshot!: string;

  /** Discount is captured as a percentage of the gross line value. */
  @Column({ name: 'discount_percent', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  discount_percent!: string;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  discount_amount!: string;

  @Column({ name: 'line_total', type: 'decimal', precision: 14, scale: 2 })
  line_total!: string;
}
