import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { RESIGNATION_REASONS, type ResignationReason } from '../resignation.entity';
import { IsNotBeforeDate } from '../../common/date-range';
import { IsKsaMobile } from '../../common/phone';


export class CreateResignationDto {
  /** Admin/manager may file on behalf of someone else; otherwise ignored. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  resignation_date!: string;

  @ApiProperty({ example: '2026-10-01' })
  @IsDateString()
  @IsNotBeforeDate('resignation_date')
  last_working_date!: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  notice_period_days?: number;

  @ApiProperty({ enum: RESIGNATION_REASONS })
  @IsIn(RESIGNATION_REASONS)
  reason_type!: ResignationReason;

  @ApiProperty()
  @IsString()
  @Length(3, 500)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  handover_notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 128)
  handover_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({ example: '0501234567' })
  @IsOptional()
  @IsKsaMobile()
  contact_mobile?: string;

}

export class DecideResignationDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  note?: string;
}
