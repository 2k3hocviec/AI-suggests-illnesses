import { UserGender } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @IsString()
  @MinLength(3)
  streetAddress?: string;

  @IsOptional()
  @IsInt()
  provinceCode?: number;

  @IsOptional()
  @IsInt()
  districtCode?: number;

  @IsOptional()
  @IsInt()
  wardCode?: number;
}
