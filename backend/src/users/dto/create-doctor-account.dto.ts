import { ConsultationType, UserGender } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDoctorAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(120)
  password: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId: number;

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

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  streetAddress: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  provinceCode: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  communeCode: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workingTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ConsultationType, { each: true })
  consultationType: ConsultationType[];
}
