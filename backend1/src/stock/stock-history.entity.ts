import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type StockHistoryAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'document'
  | 'attachment';

@Entity({ name: 'stock_history' })
export class StockHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'stock_id', type: 'varchar', length: 36 })
  stock_id!: string;

  @Column({ type: 'varchar', length: 32 })
  action!: StockHistoryAction;

  /**
   * For `update`/`status_change`: `{ field: { from, to } }`.
   * For `document`: `{ doc_type, doc_number, status_from, status_to, total_amount, currency_code }`.
   * For `attachment`: `{ stage, file_name, attachment_id, action }`.
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
