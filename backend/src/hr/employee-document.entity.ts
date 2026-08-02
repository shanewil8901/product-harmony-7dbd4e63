import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeProfile } from './employee-profile.entity';

export type EmployeeDocType = 'iqama' | 'passport' | 'contract' | 'certificate' | 'other';
export const EMPLOYEE_DOC_TYPES: EmployeeDocType[] = [
  'iqama',
  'passport',
  'contract',
  'certificate',
  'other',
];

export const EMPLOYEE_DOC_LABEL: Record<EmployeeDocType, string> = {
  iqama: 'Iqama / National ID copy',
  passport: 'Passport copy',
  contract: 'Employment contract',
  certificate: 'Certificate',
  other: 'Other',
};

@Entity({ name: 'employee_documents' })
export class EmployeeDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  employee_id!: string;

  @ManyToOne(() => EmployeeProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeProfile;

  @Column({ name: 'doc_type', type: 'varchar', length: 32 })
  doc_type!: EmployeeDocType;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mime_type!: string;

  @Column({ name: 'size_bytes', type: 'int' })
  size_bytes!: number;

  @Column({ name: 'storage_path', type: 'varchar', length: 512 })
  storage_path!: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'datetime', precision: 6 })
  uploaded_at!: Date;

  @Column({ name: 'uploaded_by', type: 'varchar', length: 255, nullable: true })
  uploaded_by!: string | null;
}
