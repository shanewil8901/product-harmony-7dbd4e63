import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Currency } from '../master-data/currency.entity';
import { CustomerDocument } from './customer-document.entity';

export type CustomerType = 'individual' | 'business';
export type PaymentTerm = 'cod' | 'advance' | 'net_15' | 'net_30' | 'net_60' | 'net_90';
export const PAYMENT_TERMS: PaymentTerm[] = ['cod', 'advance', 'net_15', 'net_30', 'net_60', 'net_90'];

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  code!: string; // C-000001

  @Column({ type: 'varchar', length: 16 })
  customer_type!: CustomerType;

  @Column({ type: 'varchar', length: 255 })
  legal_name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  legal_name_ar!: string | null;

  // Business only
  @Column({ type: 'varchar', length: 10, nullable: true })
  cr_number!: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  vat_number!: string | null;

  // Individual only — National ID / Iqama, 10 digits (KSA IDs start with 1 or 2)
  @Column({ type: 'varchar', length: 10, nullable: true })
  national_id!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  national_address_code!: string | null;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  // Billing
  @Column({ type: 'varchar', length: 255, nullable: true })
  billing_building_number!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  billing_street!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  billing_district!: string | null;
  @Column({ type: 'varchar', length: 128, nullable: true })
  billing_city!: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true })
  billing_postal_code!: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true })
  billing_additional_number!: string | null;

  // Shipping
  @Column({ type: 'boolean', default: true })
  shipping_same_as_billing!: boolean;
  @Column({ type: 'varchar', length: 255, nullable: true })
  shipping_building_number!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  shipping_street!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true })
  shipping_district!: string | null;
  @Column({ type: 'varchar', length: 128, nullable: true })
  shipping_city!: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true })
  shipping_postal_code!: string | null;
  @Column({ type: 'varchar', length: 10, nullable: true })
  shipping_additional_number!: string | null;

  // Financial
  @Column({ type: 'decimal', precision: 14, scale: 2, default: '0.00' })
  credit_limit!: string;

  @Column({ type: 'uuid', nullable: true })
  currency_id!: string | null;

  @ManyToOne(() => Currency, { eager: true, nullable: true })
  @JoinColumn({ name: 'currency_id' })
  currency!: Currency | null;

  @Column({ type: 'varchar', length: 16, default: 'cod' })
  payment_terms!: PaymentTerm;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => CustomerDocument, (d) => d.customer)
  documents!: CustomerDocument[];

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 255, nullable: true })
  created_by!: string | null;
  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at!: Date;
  @Column({ type: 'varchar', length: 255, nullable: true })
  updated_by!: string | null;
}
