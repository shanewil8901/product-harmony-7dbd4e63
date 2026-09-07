import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Department } from '../master-data/department.entity';
import { Currency } from '../master-data/currency.entity';

export type EmploymentStatus = 'active' | 'probation' | 'on_leave' | 'suspended' | 'terminated';
export const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  'active',
  'probation',
  'on_leave',
  'suspended',
  'terminated',
];

export type ContractType = 'full_time' | 'part_time' | 'contract' | 'temporary';
export const CONTRACT_TYPES: ContractType[] = ['full_time', 'part_time', 'contract', 'temporary'];

/**
 * HR profile for a system user. All master data (department, salary currency)
 * is referenced by id — never stored as a raw code/name.
 */
@Entity({ name: 'employee_profiles' })
export class EmployeeProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36 })
  user_id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index({ unique: true })
  @Column({ name: 'employee_code', type: 'varchar', length: 32 })
  employee_code!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 128 })
  first_name!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 128 })
  last_name!: string;

  /** Saudi Iqama / National ID — 10 digits starting with 1 or 2. */
  @Index({ unique: true })
  @Column({ name: 'iqama_number', type: 'varchar', length: 10 })
  iqama_number!: string;

  @Column({ name: 'iqama_expiry', type: 'date', nullable: true })
  iqama_expiry!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  nationality!: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  date_of_birth!: string | null;

  /** +9665XXXXXXXX */
  @Column({ type: 'varchar', length: 20 })
  mobile!: string;

  @Column({ name: 'emergency_contact_name', type: 'varchar', length: 128, nullable: true })
  emergency_contact_name!: string | null;

  @Column({ name: 'emergency_contact_phone', type: 'varchar', length: 20, nullable: true })
  emergency_contact_phone!: string | null;

  @Column({ name: 'address_line1', type: 'varchar', length: 255 })
  address_line1!: string;

  @Column({ name: 'address_city', type: 'varchar', length: 128 })
  address_city!: string;

  @Column({ name: 'address_postal_code', type: 'varchar', length: 10, nullable: true })
  address_postal_code!: string | null;

  // --- Bank details (payroll) ---
  @Column({ name: 'bank_name', type: 'varchar', length: 128 })
  bank_name!: string;

  @Column({ name: 'bank_account_name', type: 'varchar', length: 255, nullable: true })
  bank_account_name!: string | null;

  /** SA + 22 digits */
  @Column({ type: 'varchar', length: 24 })
  iban!: string;

  // --- Employment ---
  @Column({ name: 'job_title', type: 'varchar', length: 128 })
  job_title!: string;

  @Column({ name: 'department_id', type: 'varchar', length: 36, nullable: true })
  department_id!: string | null;

  @ManyToOne(() => Department, { nullable: true, eager: true })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

  @Column({ name: 'join_date', type: 'date' })
  join_date!: string;

  @Column({ name: 'contract_type', type: 'varchar', length: 16, default: 'full_time' })
  contract_type!: ContractType;

  @Column({ name: 'employment_status', type: 'varchar', length: 16, default: 'active' })
  employment_status!: EmploymentStatus;

  // --- Compensation ---
  @Column({ name: 'basic_salary', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  basic_salary!: string;

  @Column({ name: 'housing_allowance', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  housing_allowance!: string;

  @Column({
    name: 'transport_allowance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  transport_allowance!: string;

  @Column({ name: 'other_allowance', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  other_allowance!: string;

  @Column({ name: 'salary_currency_id', type: 'varchar', length: 36, nullable: true })
  salary_currency_id!: string | null;

  @ManyToOne(() => Currency, { nullable: true, eager: true })
  @JoinColumn({ name: 'salary_currency_id' })
  salary_currency?: Currency | null;

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
}
