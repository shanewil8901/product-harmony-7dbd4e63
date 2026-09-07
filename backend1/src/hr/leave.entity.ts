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

export type LeaveType = 'casual' | 'annual' | 'medical' | 'short' | 'emergency';
export const LEAVE_TYPES: LeaveType[] = ['casual', 'annual', 'medical', 'short', 'emergency'];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  casual: 'Casual leave',
  annual: 'Annual leave',
  medical: 'Medical leave',
  short: 'Short leave',
  emergency: 'Emergency leave',
};

/**
 * Two-step corporate approval: the supervisor signs off first, the manager (or
 * an admin) gives the final approval. Either step can reject.
 */
export type LeaveStatus =
  | 'pending_supervisor'
  | 'pending_manager'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export const LEAVE_STATUSES: LeaveStatus[] = [
  'pending_supervisor',
  'pending_manager',
  'pending_admin',
  'approved',
  'rejected',
  'cancelled',
];

/** A short leave is a part-day absence — one instance, a quarter of a day. */
export const SHORT_LEAVE_DAY_FRACTION = 0.25;

@Entity({ name: 'leave_requests' })
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'varchar', length: 36 })
  employee_id!: string;

  @ManyToOne(() => EmployeeProfile, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeProfile;

  @Column({ name: 'leave_type', type: 'varchar', length: 16 })
  leave_type!: LeaveType;

  @Column({ name: 'from_date', type: 'date' })
  from_date!: string;

  @Column({ name: 'to_date', type: 'date' })
  to_date!: string;

  /** Payroll days consumed (0.25 for a short leave). */
  @Column({ type: 'decimal', precision: 6, scale: 2, default: '0.00' })
  days!: string;

  /** Balance units consumed (a short leave costs one unit of its monthly quota). */
  @Column({ type: 'decimal', precision: 6, scale: 2, default: '0.00' })
  units!: string;

  /** Days that fall outside the entitlement and are therefore deducted. */
  @Column({ name: 'unpaid_days', type: 'decimal', precision: 6, scale: 2, default: '0.00' })
  unpaid_days!: string;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'pending_supervisor' })
  status!: LeaveStatus;

  @Column({ name: 'supervisor_by', type: 'varchar', length: 255, nullable: true })
  supervisor_by!: string | null;
  @Column({ name: 'supervisor_at', type: 'datetime', precision: 6, nullable: true })
  supervisor_at!: Date | null;
  @Column({ name: 'supervisor_note', type: 'varchar', length: 255, nullable: true })
  supervisor_note!: string | null;

  @Column({ name: 'manager_by', type: 'varchar', length: 255, nullable: true })
  manager_by!: string | null;
  @Column({ name: 'manager_at', type: 'datetime', precision: 6, nullable: true })
  manager_at!: Date | null;
  @Column({ name: 'manager_note', type: 'varchar', length: 255, nullable: true })
  manager_note!: string | null;

  /** Who finally decided the request, and with what role. */
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
