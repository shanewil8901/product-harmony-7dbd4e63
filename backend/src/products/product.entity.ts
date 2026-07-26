import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ name: 'productCode', type: 'varchar', length: 255, unique: true })
  productCode!: string;

  @Index()
  @Column({ name: 'product_barcode', type: 'varchar', length: 255, nullable: true })
  product_barcode!: string | null;

  @Column({ name: 'base_uom_id', type: 'varchar', length: 36, nullable: true })
  base_uom_id!: string | null;

  @Column({ name: 'weight_uom_id', type: 'varchar', length: 36, nullable: true })
  weight_uom_id!: string | null;

  @Column({ name: 'buying_currency_id', type: 'varchar', length: 36, nullable: true })
  buying_currency_id!: string | null;

  @Column({ name: 'selling_currency_id', type: 'varchar', length: 36, nullable: true })
  selling_currency_id!: string | null;

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
