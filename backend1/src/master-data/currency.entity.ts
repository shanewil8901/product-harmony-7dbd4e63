import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'currencies' })
export class Currency {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 8, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  symbol!: string | null;
}
