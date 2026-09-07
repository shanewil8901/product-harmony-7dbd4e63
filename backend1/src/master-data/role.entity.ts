import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type RoleCode =
  | 'admin'
  | 'manager'
  | 'supervisor'
  | 'warehouse'
  | 'sales'
  | 'employee';

export const ROLE_CODES: RoleCode[] = [
  'admin',
  'manager',
  'supervisor',
  'warehouse',
  'sales',
  'employee',
];

@Entity({ name: 'roles' })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code!: RoleCode;

  @Column({ type: 'varchar', length: 128 })
  name!: string;
}
