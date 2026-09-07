import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PAYMENT_TERMS, type PaymentTerm } from '../vendor.entity';
import { IsKsaMobile } from '../../common/phone';

// KSA validation regex
const CR_RE = /^\d{10}$/;
const VAT_RE = /^3\d{13}3$/;
const IBAN_RE = /^SA\d{22}$/;
const NAT_ADDR_RE = /^[A-Z]{4}\d{4}$/;

export class CreateVendorDto {
  @ApiProperty({ example: 'Al Rajhi Trading Co.' })
  @IsString()
  @MaxLength(255)
  legal_name!: string;

  @ApiPropertyOptional({ example: 'شركة الراجحي التجارية' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legal_name_ar?: string;

  @ApiProperty({ example: '1010101010', description: 'KSA CR — 10 digits' })
  @Matches(CR_RE, { message: 'cr_number must be exactly 10 digits' })
  cr_number!: string;

  @ApiPropertyOptional({ example: '300000000000003', description: 'KSA VAT — 15 digits, starts/ends with 3' })
  @IsOptional()
  @Matches(VAT_RE, { message: 'vat_number must be 15 digits starting and ending with 3' })
  vat_number?: string;

  @ApiPropertyOptional({ example: 'RRRD1234', description: 'National Address short code (4 letters + 4 digits)' })
  @IsOptional()
  @Matches(NAT_ADDR_RE, { message: 'national_address_code must be 4 uppercase letters + 4 digits' })
  national_address_code?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) building_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) street?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) city?: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @Matches(/^\d{5}$/, { message: 'postal_code must be 5 digits' })
  postal_code?: string;

  @ApiPropertyOptional({ example: '1234' })
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'additional_number must be 4 digits' })
  additional_number?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) contact_person?: string;

  @ApiProperty({ example: '0501234567' })
  @IsKsaMobile('Phone must be 10 digits starting with 05 (e.g. 0501234567)')
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'SA0380000000608010167519' })
  @IsOptional()
  @Matches(IBAN_RE, { message: 'iban must start with SA followed by 22 digits' })
  iban?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) bank_name?: string;

  @ApiPropertyOptional({ enum: PAYMENT_TERMS, default: 'net_30' })
  @IsOptional()
  @IsIn(PAYMENT_TERMS)
  payment_terms?: PaymentTerm;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  lead_time_days?: number;

  @ApiPropertyOptional({ description: 'Currency master-data id' })
  @IsOptional()
  @IsUUID()
  currency_id?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Import/Export license number issued by KSA authorities' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  import_export_license_no?: string;
}
