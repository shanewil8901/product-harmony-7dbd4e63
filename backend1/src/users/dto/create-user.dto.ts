import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { RoleCode } from '../../master-data/role.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'jane@acme.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'secret123', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ enum: ['admin', 'manager', 'employee'] })
  @IsIn(['admin', 'manager', 'employee'])
  role!: RoleCode;
}
