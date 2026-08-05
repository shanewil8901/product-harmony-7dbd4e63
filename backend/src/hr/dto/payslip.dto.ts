import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PAYSLIP_STATUSES } from '../payslip.entity';
import type { PayslipStatus } from '../payslip.entity';

export class GeneratePayslipDto {
  @ApiProperty({ description: 'Employee profile id' })
  @IsUUID(undefined, { message: 'Select an employee' })
  employee_id!: string;

  @ApiProperty({ example: '2026-08', description: 'Payroll period YYYY-MM' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Period must be in YYYY-MM format' })
  period!: string;

  @ApiPropertyOptional({ description: 'Overtime pay rate per hour', example: 40 })
  @IsOptional()
  @IsNumber({}, { message: 'Overtime rate must be a number' })
  @Min(0)
  overtime_rate?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'Bonus must be a number' })
  @Min(0)
  bonus?: number;

  @ApiPropertyOptional({ description: 'GOSI / social insurance deduction', example: 540 })
  @IsOptional()
  @IsNumber({}, { message: 'GOSI deduction must be a number' })
  @Min(0)
  gosi_deduction?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'Other deduction must be a number' })
  @Min(0)
  other_deduction?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/**
 * Bulk run: the same common values are applied to every employee matching the
 * selected role (and optional department). Employees that already have a
 * payslip for the period are skipped — existing data is never overwritten.
 */
export class BulkGeneratePayslipDto {
  @ApiProperty({ example: 'employee', description: 'Role code to run payroll for' })
  @IsString({ message: 'Select a role' })
  role!: string;

  @ApiPropertyOptional({ description: 'Limit the run to one department' })
  @IsOptional()
  @IsUUID(undefined, { message: 'Select a department from the list' })
  department_id?: string;

  @ApiProperty({ example: '2026-08', description: 'Payroll period YYYY-MM' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Period must be in YYYY-MM format' })
  period!: string;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsNumber({}, { message: 'Overtime rate must be a number' })
  @Min(0)
  overtime_rate?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'Bonus must be a number' })
  @Min(0)
  bonus?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'GOSI deduction must be a number' })
  @Min(0)
  gosi_deduction?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'Other deduction must be a number' })
  @Min(0)
  other_deduction?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdatePayslipStatusDto {
  @ApiProperty({ enum: PAYSLIP_STATUSES })
  @IsIn(PAYSLIP_STATUSES, { message: 'Select a valid payslip status' })
  status!: PayslipStatus;
}

