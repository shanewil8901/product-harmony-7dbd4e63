import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Single-row configuration for automatic payslip generation. `id` is always
 * 'default' so the table can never hold conflicting schedules.
 */
@Entity({ name: 'payroll_settings' })
export class PayrollSettings {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  id!: string;

  @Column({ name: 'auto_generate', type: 'boolean', default: true })
  auto_generate!: boolean;

  /** Day of month payslips are issued (1-28). */
  @Column({ name: 'pay_day', type: 'int', default: 25 })
  pay_day!: number;

  /** 0 = pay the current month, 1 = pay the previous month. */
  @Column({ name: 'period_offset', type: 'int', default: 0 })
  period_offset!: number;

  @Column({
    name: 'default_overtime_rate',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: '0.00',
  })
  default_overtime_rate!: string;

  @Column({
    name: 'default_gosi_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: '9.00',
  })
  default_gosi_percent!: string;

  /** Fallback when a month has no working-day calendar entry. */
  @Column({ name: 'default_working_days', type: 'int', default: 26 })
  default_working_days!: number;

  @Column({ name: 'last_run_period', type: 'varchar', length: 7, nullable: true })
  last_run_period!: string | null;

  @Column({ name: 'last_run_at', type: 'datetime', precision: 6, nullable: true })
  last_run_at!: Date | null;

  @Column({ name: 'last_run_summary', type: 'varchar', length: 255, nullable: true })
  last_run_summary!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updated_at!: Date;
  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by!: string | null;
}

/**
 * Working days per month — set by admin/manager because public holidays vary.
 * Payroll divides the gross by this number to get the daily rate.
 */
@Entity({ name: 'work_calendars' })
export class WorkCalendar {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** YYYY-MM */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 7 })
  period!: string;

  @Column({ name: 'working_days', type: 'int' })
  working_days!: number;

  @Column({ name: 'public_holidays', type: 'int', default: 0 })
  public_holidays!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updated_at!: Date;
  @Column({ name: 'updated_by', type: 'varchar', length: 255, nullable: true })
  updated_by!: string | null;
}

/** Where the working-days figure used by a payroll run came from. */
export type CalendarSource = 'calendar' | 'previous-calendar' | 'default';

/**
 * Audit trail of every payroll generation attempt (scheduled, manual or test)
 * so it is always visible which month was generated and which calendar data
 * the amounts were based on.
 */
@Entity({ name: 'payroll_run_logs' })
export class PayrollRunLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Correlates every line of one run; surfaced in the UI and the logs. */
  @Index()
  @Column({ name: 'request_id', type: 'varchar', length: 36 })
  request_id!: string;

  @Index()
  @Column({ type: 'varchar', length: 7 })
  period!: string;

  /** scheduled | manual | test */
  @Column({ name: 'trigger_type', type: 'varchar', length: 16 })
  trigger_type!: string;

  @Column({ name: 'calendar_source', type: 'varchar', length: 24 })
  calendar_source!: string;

  /** The month the working days were actually taken from, when not the period. */
  @Column({ name: 'source_period', type: 'varchar', length: 7, nullable: true })
  source_period!: string | null;

  @Column({ name: 'working_days', type: 'int' })
  working_days!: number;

  @Column({ name: 'created_count', type: 'int', default: 0 })
  created_count!: number;

  @Column({ name: 'skipped_count', type: 'int', default: 0 })
  skipped_count!: number;

  /** A test generation records what would happen without writing payslips. */
  @Column({ name: 'dry_run', type: 'boolean', default: false })
  dry_run!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  summary!: string | null;

  @Column({ name: 'actor', type: 'varchar', length: 255, nullable: true })
  actor!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;
}
