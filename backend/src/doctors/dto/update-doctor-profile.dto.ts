import { ConsultationType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function parseConsultationTypes(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
}

export class UpdateDoctorProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  academicTitle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workplace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  streetAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  provinceCode?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  communeCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workingTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ConsultationType, { each: true })
  @Transform(({ value }) => parseConsultationTypes(value))
  consultationType?: ConsultationType[];
}
