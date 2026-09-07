import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { StockDocType } from './stock-document.entity';

/** Attachments may be tied to a lifecycle stage, or be general to the stock row. */
export type StockAttachmentStage = StockDocType | 'general';

@Entity({ name: 'stock_attachments' })
export class StockAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'stock_id', type: 'varchar', length: 36 })
  stock_id!: string;

  /** Lifecycle stage this file belongs to ('general' when not stage-specific). */
  @Column({ type: 'varchar', length: 32, default: 'general' })
  stage!: StockAttachmentStage;

  /** Optional link to the generated document of that stage. */
  @Column({ name: 'stock_document_id', type: 'varchar', length: 36, nullable: true })
  stock_document_id!: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mime_type!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ name: 'storage_path', type: 'varchar', length: 512 })
  storage_path!: string;

  @Column({ name: 'reference_no', type: 'varchar', length: 64, nullable: true })
  reference_no!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'datetime', precision: 6 })
  uploaded_at!: Date;

  @Column({ name: 'uploaded_by', type: 'varchar', length: 255, nullable: true })
  uploaded_by!: string | null;
}
