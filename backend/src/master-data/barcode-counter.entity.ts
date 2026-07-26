import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'barcode_counters' })
export class BarcodeCounter {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  id!: string; // e.g. 'default'

  @Column({ type: 'bigint' })
  next_val!: string;
}
