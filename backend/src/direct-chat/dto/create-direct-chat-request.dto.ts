import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateDirectChatRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  doctorId: number;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  consultationSummary?: string;
}
