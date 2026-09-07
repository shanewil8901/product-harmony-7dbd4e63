import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { LEAVE_TYPES, type LeaveType } from '../leave.entity';
import { IsNotBeforeDate } from '../../common/date-range';

export class ApplyLeaveDto {
  /** Admin/manager may file on behalf of someone else; otherwise ignored. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @ApiProperty({ enum: LEAVE_TYPES })
  @IsIn(LEAVE_TYPES)
  leave_type!: LeaveType;

  @ApiProperty({ example: '2026-03-04' })
  @IsDateString()
  from_date!: string;

  @ApiProperty({ example: '2026-03-05' })
  @IsDateString()
  @IsNotBeforeDate('from_date', { message: 'The end date cannot be before the start date' })
  to_date!: string;

  @ApiProperty()
  @IsString()
  @Length(3, 255)
  reason!: string;
}

export class DecideLeaveDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  note?: string;
}

export class UpdateLeavePolicyDto {
  @ApiProperty()
  @IsUUID()
  role_id!: string;

  @ApiProperty({ enum: LEAVE_TYPES })
  @IsIn(LEAVE_TYPES)
  leave_type!: LeaveType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(365)
  entitlement!: number;

  @ApiPropertyOptional({ enum: ['month', 'year'] })
  @IsOptional()
  @IsIn(['month', 'year'])
  period_unit?: 'month' | 'year';
}

export class UpdatePayrollSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auto_generate?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 28 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  pay_day?: number;

  @ApiPropertyOptional({ description: '0 = current month, 1 = previous month' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  period_offset?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  default_overtime_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  default_gosi_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  default_working_days?: number;
}

export class UpsertWorkCalendarDto {
  @ApiProperty({ example: '2026-03' })
  @IsString()
  @Length(7, 7)
  period!: string;

  @ApiProperty({ minimum: 1, maximum: 31 })
  @IsInt()
  @Min(1)
  @Max(31)
  working_days!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31)
  public_holidays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  notes?: string;
}
