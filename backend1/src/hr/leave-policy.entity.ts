import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../master-data/role.entity';
import type { LeaveType } from './leave.entity';

export type LeavePeriodUnit = 'month' | 'year';

/**
 * Entitlements are defined per ROLE (not per employee); every employee holding
 * the role inherits them, while the consumed balance is tracked individually.
 */
@Entity({ name: 'role_leave_policies' })
@Unique('uq_role_leave_type', ['role_id', 'leave_type'])
export class RoleLeavePolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'role_id', type: 'varchar', length: 36 })
  role_id!: string;

  @ManyToOne(() => Role, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'leave_type', type: 'varchar', length: 16 })
  leave_type!: LeaveType;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: '0.00' })
  entitlement!: string;

  @Column({ name: 'period_unit', type: 'varchar', length: 8, default: 'year' })
  period_unit!: LeavePeriodUnit;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updated_at!: Date;
  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by!: string | null;
}

/** Company defaults seeded for every role on first boot. */
export const DEFAULT_LEAVE_POLICY: {
  leave_type: LeaveType;
  entitlement: number;
  period_unit: LeavePeriodUnit;
}[] = [
  { leave_type: 'casual', entitlement: 1, period_unit: 'month' },
  { leave_type: 'annual', entitlement: 14, period_unit: 'year' },
  { leave_type: 'medical', entitlement: 4, period_unit: 'year' },
  { leave_type: 'short', entitlement: 2, period_unit: 'month' },
  { leave_type: 'emergency', entitlement: 2, period_unit: 'year' },
];
