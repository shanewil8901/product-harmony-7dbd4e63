import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { StockDocType } from './stock-document.entity';
import type { StockStatus } from './stock.entity';
import type { RoleCode } from '../master-data/role.entity';

export type StageAuditResult = 'success' | 'denied' | 'failed';

/**
 * Immutable audit trail of every lifecycle-stage attempt.
 *
 * Unlike `stock_history` (which only records what changed after a successful
 * write) this table also records refused attempts — who tried to run which
 * stage, with what role, and why it was rejected.
 */
@Entity({ name: 'stock_stage_audit' })
export class StockStageAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'stock_id', type: 'varchar', length: 36 })
  stock_id!: string;

  @Column({ name: 'document_id', type: 'varchar', length: 36, nullable: true })
  document_id!: string | null;

  @Index()
  @Column({ name: 'doc_type', type: 'varchar', length: 32 })
  doc_type!: StockDocType;

  @Column({ name: 'doc_number', type: 'varchar', length: 64, nullable: true })
  doc_number!: string | null;

  @Column({ name: 'stage_label', type: 'varchar', length: 128 })
  stage_label!: string;

  @Column({ name: 'status_from', type: 'varchar', length: 32, nullable: true })
  status_from!: StockStatus | null;

  @Column({ name: 'status_to', type: 'varchar', length: 32, nullable: true })
  status_to!: StockStatus | null;

  @Column({ type: 'varchar', length: 16 })
  result!: StageAuditResult;

  /** Rejection / failure explanation — null on success. */
  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  /** Reference numbers and dates submitted with the stage form. */
  @Column({ type: 'json', nullable: true })
  payload!: unknown;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  total_amount!: string | null;

  @Column({ name: 'currency_code', type: 'varchar', length: 8, nullable: true })
  currency_code!: string | null;

  @Index()
  @Column({ name: 'actor_email', type: 'varchar', length: 255, nullable: true })
  actor_email!: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 32, nullable: true })
  actor_role!: RoleCode | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;
}
