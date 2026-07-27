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
import { VendorDocument } from './vendor-document.entity';

export type PaymentTerm = 'cod' | 'advance' | 'net_15' | 'net_30' | 'net_60' | 'net_90';
export const PAYMENT_TERMS: PaymentTerm[] = ['cod', 'advance', 'net_15', 'net_30', 'net_60', 'net_90'];

@Entity({ name: 'vendors' })
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  code!: string; // internal vendor code e.g. V-000001

  @Column({ type: 'varchar', length: 255 })
  legal_name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  legal_name_ar!: string | null;

  // KSA Commercial Registration — 10 digits
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10 })
  cr_number!: string;

  // KSA VAT — 15 digits, starts+ends with 3
  @Column({ type: 'varchar', length: 15, nullable: true })
  vat_number!: string | null;

  // National Address short code, e.g. RRRD1234
  @Column({ type: 'varchar', length: 8, nullable: true })
  national_address_code!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  building_number!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  street!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  postal_code!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  additional_number!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_person!: string | null;

  // KSA mobile e.g. +9665XXXXXXXX
  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  // SA + 22 digits
  @Column({ type: 'varchar', length: 24, nullable: true })
  iban!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bank_name!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'net_30' })
  payment_terms!: PaymentTerm;

  @Column({ type: 'int', default: 7 })
  lead_time_days!: number;

  @Column({ type: 'uuid', nullable: true })
  currency_id!: string | null;

  @ManyToOne(() => Currency, { eager: true, nullable: true })
  @JoinColumn({ name: 'currency_id' })
  currency!: Currency | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: 'active' | 'inactive';

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => VendorDocument, (d) => d.vendor)
  documents!: VendorDocument[];

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  created_by!: string | null;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  updated_by!: string | null;
}
