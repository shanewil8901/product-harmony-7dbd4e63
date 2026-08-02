import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';
import type { RoleCode } from '../../master-data/role.entity';

/** Email + password are updated through dedicated fields, never silently. */
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['email', 'password', 'role'] as const),
) {
  @ApiPropertyOptional({ description: 'New password (optional)' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ enum: ['admin', 'manager', 'warehouse', 'sales', 'employee'] })
  @IsOptional()
  @IsIn(['admin', 'manager', 'warehouse', 'sales', 'employee'], { message: 'Select a valid role' })
  role?: RoleCode;
}
