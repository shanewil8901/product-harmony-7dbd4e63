import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class PunchAttendanceDto {
  @ApiProperty({ description: 'Employee profile id' })
  @IsUUID(undefined, { message: 'Select your employee record' })
  employee_id!: string;

  @ApiProperty({ enum: ['in', 'out'] })
  @IsIn(['in', 'out'], { message: 'Choose check-in or check-out' })
  kind!: 'in' | 'out';

  @ApiProperty({ example: '08:00', description: 'HH:mm' })
  @Matches(TIME_RE, { message: 'Time must be in HH:mm format' })
  time!: string;

  @ApiPropertyOptional({ example: '2026-08-04', description: 'Defaults to today' })
  @IsOptional()
  @IsDateString({}, { message: 'Work date must be a valid date' })
  work_date?: string;
}
