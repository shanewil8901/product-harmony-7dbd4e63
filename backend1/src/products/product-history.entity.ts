import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ProductHistoryAction = 'create' | 'update' | 'delete';

@Entity({ name: 'product_history' })
export class ProductHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'product_id', type: 'varchar', length: 36 })
  product_id!: string;

  @Column({ type: 'varchar', length: 16 })
  action!: ProductHistoryAction;

  /** JSON object of `{ field: { from, to } }` for update, or full snapshot for create/delete. */
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
