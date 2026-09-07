import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeProfile } from './employee-profile.entity';

export type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * A re-entry of attendance for a day that already holds a value. The main
 * attendance table is only touched once a manager or admin approves it.
 */
@Entity({ name: 'employee_attendance_requests' })
export class AttendanceRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  employee_id!: string;

  @ManyToOne(() => EmployeeProfile, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeProfile;

  @Index()
  @Column({ name: 'work_date', type: 'date' })
  work_date!: string;

  /** Which punch the employee is re-entering. */
  @Column({ type: 'varchar', length: 8 })
  kind!: 'in' | 'out';

  @Column({ name: 'requested_time', type: 'time' })
  requested_time!: string;

  /** The value currently stored, kept for the approver's context. */
  @Column({ name: 'current_time_value', type: 'time', nullable: true })
  current_time_value!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: AttendanceRequestStatus;

  @Column({ name: 'requested_by', type: 'varchar', length: 36, nullable: true })
  requested_by!: string | null;

  @Column({ name: 'decided_by', type: 'varchar', length: 36, nullable: true })
  decided_by!: string | null;

  @Column({ name: 'decided_role', type: 'varchar', length: 32, nullable: true })
  decided_role!: string | null;

  @Column({ name: 'decided_at', type: 'datetime', precision: 6, nullable: true })
  decided_at!: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decision_note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;
}
