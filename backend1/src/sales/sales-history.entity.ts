import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type SalesHistoryAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'document'
  | 'payment';

@Entity({ name: 'sales_history' })
export class SalesHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  order_id!: string;

  @Column({ type: 'varchar', length: 32 })
  action!: SalesHistoryAction;

  /**
   * For `update`/`status_change`: `{ field: { from, to } }`.
   * For `document`: `{ doc_type, doc_number }`.
   * For `payment`: `{ method, amount, currency_code, status, note }`.
   * For `create`/`delete`: null (see snapshot).
   */
  @Column({ name: 'changes', type: 'json', nullable: true })
  changes!: unknown;

  /** Full row snapshot at the time of the event. */
  @Column({ name: 'snapshot', type: 'json', nullable: true })
  snapshot!: unknown;

  @CreateDateColumn({ name: 'changed_at', type: 'datetime', precision: 6 })
  changed_at!: Date;

  @Column({ name: 'changed_by', type: 'varchar', length: 255, nullable: true })
  changed_by!: string | null;
}
