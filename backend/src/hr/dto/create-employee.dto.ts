import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { RoleCode } from '../../master-data/role.entity';
import { CONTRACT_TYPES, EMPLOYMENT_STATUSES } from '../employee-profile.entity';
import type { ContractType, EmploymentStatus } from '../employee-profile.entity';

export class CreateEmployeeDto {
  // --- Login credentials ---
  @ApiProperty({ example: 'jane@acme.com' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'secret123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(128)
  password!: string;

  @ApiProperty({ enum: ['admin', 'manager', 'warehouse', 'sales', 'employee'] })
  @IsIn(['admin', 'manager', 'warehouse', 'sales', 'employee'], { message: 'Select a valid role' })
  role!: RoleCode;

  // --- Personal ---
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(128)
  first_name!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(128)
  last_name!: string;

  @ApiProperty({ example: '1234567890' })
  @Matches(/^[12]\d{9}$/, {
    message: 'Iqama / National ID must be 10 digits starting with 1 or 2',
  })
  iqama_number!: string;

  @ApiPropertyOptional({ example: '2027-05-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Iqama expiry must be a valid date' })
  iqama_expiry?: string;

  @ApiPropertyOptional({ example: 'Saudi' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nationality?: string;

  @ApiPropertyOptional({ example: '1995-03-12' })
  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid date' })
  date_of_birth?: string;

  @ApiProperty({ example: '+966512345678' })
  @Matches(/^\+9665\d{8}$/, { message: 'Mobile must be in +9665XXXXXXXX format' })
  mobile!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  emergency_contact_name?: string;

  @ApiPropertyOptional({ example: '+966512345678' })
  @IsOptional()
  @Matches(/^\+9665\d{8}$/, { message: 'Emergency phone must be in +9665XXXXXXXX format' })
  emergency_contact_phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3, { message: 'Address is required' })
  @MaxLength(255)
  address_line1!: string;

  @ApiProperty({ example: 'Riyadh' })
  @IsString()
  @MinLength(2, { message: 'City is required' })
  @MaxLength(128)
  address_city!: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @Matches(/^\d{5}$/, { message: 'Postal code must be 5 digits' })
  address_postal_code?: string;

  // --- Bank ---
  @ApiProperty({ example: 'Al Rajhi Bank' })
  @IsString()
  @MinLength(2, { message: 'Bank name is required' })
  @MaxLength(128)
  bank_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bank_account_name?: string;

  @ApiProperty({ example: 'SA0380000000608010167519' })
  @Matches(/^SA\d{22}$/, { message: 'IBAN must be SA followed by 22 digits' })
  iban!: string;

  // --- Employment ---
  @ApiProperty({ example: 'Warehouse Supervisor' })
  @IsString()
  @MinLength(2, { message: 'Job title is required' })
  @MaxLength(128)
  job_title!: string;

  @ApiPropertyOptional({ description: 'Department master-data id' })
  @IsOptional()
  @IsUUID(undefined, { message: 'Select a valid department' })
  department_id?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'Join date must be a valid date' })
  join_date!: string;

  @ApiPropertyOptional({ enum: CONTRACT_TYPES })
  @IsOptional()
  @IsIn(CONTRACT_TYPES, { message: 'Select a valid contract type' })
  contract_type?: ContractType;

  @ApiPropertyOptional({ enum: EMPLOYMENT_STATUSES })
  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES, { message: 'Select a valid employment status' })
  employment_status?: EmploymentStatus;

  // --- Compensation ---
  @ApiProperty({ example: 6000 })
  @IsNumber({}, { message: 'Basic salary must be a number' })
  @Min(0)
  @Max(100000000)
  basic_salary!: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber({}, { message: 'Housing allowance must be a number' })
  @Min(0)
  housing_allowance?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber({}, { message: 'Transport allowance must be a number' })
  @Min(0)
  transport_allowance?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'Other allowance must be a number' })
  @Min(0)
  other_allowance?: number;

  @ApiProperty({ description: 'Currency master-data id for the salary' })
  @IsUUID(undefined, { message: 'Select a salary currency' })
  salary_currency_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
