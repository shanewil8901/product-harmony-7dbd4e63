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
import { Department } from '../master-data/department.entity';
import { Uom } from '../master-data/uom.entity';
import { Currency } from '../master-data/currency.entity';
import { Vendor } from '../vendors/vendor.entity';

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'baseQty', type: 'decimal', precision: 10, scale: 3 })
  baseQty!: string;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  weight!: string;

  @Column({ name: 'buyingPrice', type: 'decimal', precision: 10, scale: 2 })
  buyingPrice!: string;

  @Column({ name: 'sellingPrice', type: 'decimal', precision: 10, scale: 2 })
  sellingPrice!: string;

  @Column({ name: 'department_id', type: 'varchar', length: 36, nullable: true })
  department_id!: string | null;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

  /** Default supplier for this product — chosen when the product is registered. */
  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  vendor_id!: string | null;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor?: Vendor | null;

  @Column({ name: 'productCode', type: 'varchar', length: 255, unique: true })
  productCode!: string;

  @Index()
  @Column({ name: 'product_barcode', type: 'varchar', length: 255, nullable: true })
  product_barcode!: string | null;

  @Column({ name: 'base_uom_id', type: 'varchar', length: 36, nullable: true })
  base_uom_id!: string | null;

  @ManyToOne(() => Uom, { nullable: true })
  @JoinColumn({ name: 'base_uom_id' })
  base_uom?: Uom | null;

  @Column({ name: 'weight_uom_id', type: 'varchar', length: 36, nullable: true })
  weight_uom_id!: string | null;

  @ManyToOne(() => Uom, { nullable: true })
  @JoinColumn({ name: 'weight_uom_id' })
  weight_uom?: Uom | null;

  @Column({ name: 'buying_currency_id', type: 'varchar', length: 36, nullable: true })
  buying_currency_id!: string | null;

  @ManyToOne(() => Currency, { nullable: true })
  @JoinColumn({ name: 'buying_currency_id' })
  buying_currency?: Currency | null;

  @Column({ name: 'selling_currency_id', type: 'varchar', length: 36, nullable: true })
  selling_currency_id!: string | null;

  @ManyToOne(() => Currency, { nullable: true })
  @JoinColumn({ name: 'selling_currency_id' })
  selling_currency?: Currency | null;

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
