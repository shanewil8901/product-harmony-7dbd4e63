import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SalesOrder } from './sales-order.entity';

/** Documents the system issues automatically as the sales order advances. */
export type SalesDocType = 'delivery_order' | 'sales_invoice';
export const SALES_DOC_TYPES: SalesDocType[] = ['delivery_order', 'sales_invoice'];

export const SALES_DOC_LABEL: Record<SalesDocType, string> = {
  delivery_order: 'Delivery Order',
  sales_invoice: 'Sales Invoice',
};

export const SALES_DOC_PREFIX: Record<SalesDocType, string> = {
  delivery_order: 'DO',
  sales_invoice: 'INV',
};

@Entity({ name: 'sales_documents' })
export class SalesDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'doc_no', type: 'varchar', length: 32 })
  doc_no!: string;

  @Column({ name: 'doc_type', type: 'varchar', length: 24 })
  doc_type!: SalesDocType;

  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  order_id!: string;

  @ManyToOne(() => SalesOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: SalesOrder;

  /** Immutable snapshot of the order at the moment the document was issued. */
  @Column({ type: 'json', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ name: 'issued_at', type: 'datetime', precision: 6 })
  issued_at!: Date;

  @Column({ name: 'issued_by', type: 'varchar', length: 255, nullable: true })
  issued_by!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  created_at!: Date;
}
