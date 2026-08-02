import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeProfile } from './employee-profile.entity';
import { Currency } from '../master-data/currency.entity';

export type PayslipStatus = 'draft' | 'approved' | 'paid' | 'cancelled';
export const PAYSLIP_STATUSES: PayslipStatus[] = ['draft', 'approved', 'paid', 'cancelled'];

/** One payslip per employee per payroll month (YYYY-MM). */
@Entity({ name: 'employee_payslips' })
@Unique('uq_payslip_employee_period', ['employee_id', 'period'])
export class Payslip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  employee_id!: string;

  @ManyToOne(() => EmployeeProfile, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeProfile;

  /** Payroll period in YYYY-MM form. */
  @Index()
  @Column({ type: 'varchar', length: 7 })
  period!: string;

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

  @Column({ name: 'overtime_amount', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  overtime_amount!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  bonus!: string;

  /** GOSI / social insurance employee share. */
  @Column({ name: 'gosi_deduction', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  gosi_deduction!: string;

  @Column({
    name: 'unpaid_leave_deduction',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  unpaid_leave_deduction!: string;

  @Column({ name: 'other_deduction', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  other_deduction!: string;

  @Column({ name: 'net_pay', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  net_pay!: string;

  @Column({ name: 'currency_id', type: 'varchar', length: 36, nullable: true })
  currency_id!: string | null;

  @ManyToOne(() => Currency, { nullable: true, eager: true })
  @JoinColumn({ name: 'currency_id' })
  currency?: Currency | null;

  /** Attendance snapshot used to build this payslip. */
  @Column({ name: 'worked_days', type: 'int', default: 0 })
  worked_days!: number;

  @Column({ name: 'absent_days', type: 'int', default: 0 })
  absent_days!: number;

  @Column({ name: 'overtime_hours', type: 'decimal', precision: 6, scale: 2, default: '0.00' })
  overtime_hours!: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: PayslipStatus;

  @Column({ name: 'paid_at', type: 'datetime', precision: 6, nullable: true })
  paid_at!: Date | null;

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
