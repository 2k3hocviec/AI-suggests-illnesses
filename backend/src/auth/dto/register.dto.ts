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

export class RegisterDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsString()
  @MinLength(3)
  streetAddress: string;

  @IsInt()
  provinceCode: number;

  @IsInt()
  districtCode: number;

  @IsInt()
  wardCode: number;
}
