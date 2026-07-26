import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'uoms' })
export class Uom {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  // 'base' | 'weight' | 'both'
  @Column({ type: 'varchar', length: 16, default: 'both' })
  kind!: string;
}
