import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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
} from 'class-validator';
import { PAYMENT_TERMS, type CustomerType, type PaymentTerm } from '../customer.entity';

const CR_RE = /^\d{10}$/;
const VAT_RE = /^3\d{13}3$/;
const PHONE_RE = /^\+9665\d{8}$/;
const NATID_RE = /^[12]\d{9}$/;
const NAT_ADDR_RE = /^[A-Z]{4}\d{4}$/;

export class CreateCustomerDto {
  @ApiProperty({ enum: ['individual', 'business'] })
  @IsIn(['individual', 'business'])
  customer_type!: CustomerType;

  @ApiProperty({ example: 'Fahad Al Otaibi' })
  @IsString()
  @MaxLength(255)
  legal_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legal_name_ar?: string;

  @ApiPropertyOptional({ example: '1010101010', description: 'Business CR — 10 digits' })
  @IsOptional()
  @Matches(CR_RE, { message: 'cr_number must be 10 digits' })
  cr_number?: string;

  @ApiPropertyOptional({ example: '300000000000003' })
  @IsOptional()
  @Matches(VAT_RE, { message: 'vat_number must be 15 digits starting and ending with 3' })
  vat_number?: string;

  @ApiPropertyOptional({ example: '1012345678', description: 'National ID / Iqama — 10 digits' })
  @IsOptional()
  @Matches(NATID_RE, { message: 'national_id must be 10 digits starting with 1 or 2' })
  national_id?: string;

  @ApiPropertyOptional({ example: 'RRRD1234' })
  @IsOptional()
  @Matches(NAT_ADDR_RE, { message: 'national_address_code must be 4 letters + 4 digits' })
  national_address_code?: string;

  @ApiProperty({ example: '+966501234567' })
  @Matches(PHONE_RE, { message: 'phone must be in the form +9665XXXXXXXX' })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  // Billing
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) billing_building_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) billing_street?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) billing_district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) billing_city?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{5}$/, { message: 'billing_postal_code must be 5 digits' }) billing_postal_code?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}$/, { message: 'billing_additional_number must be 4 digits' }) billing_additional_number?: string;

  // Shipping
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() shipping_same_as_billing?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) shipping_building_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) shipping_street?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) shipping_district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) shipping_city?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{5}$/) shipping_postal_code?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}$/) shipping_additional_number?: string;

  @ApiPropertyOptional({ example: 10000, description: 'DECIMAL(14,2)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  credit_limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currency_id?: string;

  @ApiPropertyOptional({ enum: PAYMENT_TERMS, default: 'cod' })
  @IsOptional()
  @IsIn(PAYMENT_TERMS)
  payment_terms?: PaymentTerm;

  @ApiPropertyOptional({ enum: ['active', 'inactive'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
