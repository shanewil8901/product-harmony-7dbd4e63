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

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'half_day'
  | 'leave'
  | 'sick_leave'
  | 'holiday';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'half_day',
  'leave',
  'sick_leave',
  'holiday',
];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  half_day: 'Half day',
  leave: 'Leave',
  sick_leave: 'Sick leave',
  holiday: 'Holiday',
};

/** One row per employee per calendar day. */
@Entity({ name: 'employee_attendance' })
@Unique('uq_attendance_employee_day', ['employee_id', 'work_date'])
export class Attendance {
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

  @Column({ type: 'varchar', length: 16, default: 'present' })
  status!: AttendanceStatus;

  @Column({ name: 'check_in', type: 'time', nullable: true })
  check_in!: string | null;

  @Column({ name: 'check_out', type: 'time', nullable: true })
  check_out!: string | null;

  @Column({ name: 'worked_hours', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  worked_hours!: string;

  @Column({ name: 'overtime_hours', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  overtime_hours!: string;

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
