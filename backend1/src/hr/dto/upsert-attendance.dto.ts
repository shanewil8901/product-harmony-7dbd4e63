import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ATTENDANCE_STATUSES } from '../attendance.entity';
import type { AttendanceStatus } from '../attendance.entity';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertAttendanceDto {
  @ApiProperty({ description: 'Employee profile id' })
  @IsUUID(undefined, { message: 'Select an employee' })
  employee_id!: string;

  @ApiProperty({ example: '2026-08-02', description: 'YYYY-MM-DD' })
  @IsDateString({}, { message: 'Work date must be a valid date' })
  work_date!: string;

  @ApiProperty({ enum: ATTENDANCE_STATUSES })
  @IsIn(ATTENDANCE_STATUSES, { message: 'Select a valid attendance status' })
  status!: AttendanceStatus;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(TIME_RE, { message: 'Check-in must be in HH:mm format' })
  check_in?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @Matches(TIME_RE, { message: 'Check-out must be in HH:mm format' })
  check_out?: string;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @IsNumber({}, { message: 'Overtime hours must be a number' })
  @Min(0)
  @Max(24)
  overtime_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
