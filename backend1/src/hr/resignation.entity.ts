import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeProfile } from './employee-profile.entity';

export type ResignationReason =
  | 'better_opportunity'
  | 'personal'
  | 'health'
  | 'relocation'
  | 'retirement'
  | 'end_of_contract'
  | 'other';

export const RESIGNATION_REASONS: ResignationReason[] = [
  'better_opportunity',
  'personal',
  'health',
  'relocation',
  'retirement',
  'end_of_contract',
  'other',
];

/** Sequential sign-off: supervisor → manager → admin. */
export type ResignationStatus =
  | 'pending_supervisor'
  | 'pending_manager'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export const RESIGNATION_STATUSES: ResignationStatus[] = [
  'pending_supervisor',
  'pending_manager',
  'pending_admin',
  'approved',
  'rejected',
  'withdrawn',
];

@Entity({ name: 'resignations' })
export class Resignation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'varchar', length: 36 })
  employee_id!: string;

  @ManyToOne(() => EmployeeProfile, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeProfile;

  /** Date the resignation letter is submitted. */
  @Column({ name: 'resignation_date', type: 'date' })
  resignation_date!: string;

  /** Requested last working day. */
  @Column({ name: 'last_working_date', type: 'date' })
  last_working_date!: string;

  @Column({ name: 'notice_period_days', type: 'int', default: 30 })
  notice_period_days!: number;

  @Column({ name: 'reason_type', type: 'varchar', length: 32 })
  reason_type!: ResignationReason;

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @Column({ name: 'handover_notes', type: 'varchar', length: 1000, nullable: true })
  handover_notes!: string | null;

  @Column({ name: 'handover_to', type: 'varchar', length: 128, nullable: true })
  handover_to!: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 190, nullable: true })
  contact_email!: string | null;

  @Column({ name: 'contact_mobile', type: 'varchar', length: 24, nullable: true })
  contact_mobile!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'pending_supervisor' })
  status!: ResignationStatus;

  /* ------------------------------------------------- end-of-service benefit */
  /** Basic salary used for the calculation (snapshot at approval). */
  @Column({ name: 'benefit_basic_salary', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  benefit_basic_salary!: string;
  @Column({ name: 'service_months', type: 'int', default: 0 })
  service_months!: number;
  @Column({ name: 'service_years', type: 'decimal', precision: 6, scale: 2, default: '0.00' })
  service_years!: string;
  @Column({ name: 'benefit_amount', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  benefit_amount!: string;

  /* --------------------------------------------------------- approval trail */
  @Column({ name: 'supervisor_by', type: 'varchar', length: 255, nullable: true })
  supervisor_by!: string | null;
  @Column({ name: 'supervisor_at', type: 'datetime', precision: 6, nullable: true })
  supervisor_at!: Date | null;

  @Column({ name: 'manager_by', type: 'varchar', length: 255, nullable: true })
  manager_by!: string | null;
  @Column({ name: 'manager_at', type: 'datetime', precision: 6, nullable: true })
  manager_at!: Date | null;

  @Column({ name: 'admin_by', type: 'varchar', length: 255, nullable: true })
  admin_by!: string | null;
  @Column({ name: 'admin_at', type: 'datetime', precision: 6, nullable: true })
  admin_at!: Date | null;

  @Column({ name: 'decided_by', type: 'varchar', length: 255, nullable: true })
  decided_by!: string | null;
  @Column({ name: 'decided_by_role', type: 'varchar', length: 32, nullable: true })
  decided_by_role!: string | null;
  @Column({ name: 'decided_at', type: 'datetime', precision: 6, nullable: true })
  decided_at!: Date | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 255, nullable: true })
  rejection_reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;
  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  created_by!: string | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updated_at!: Date;
  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by!: string | null;
}
