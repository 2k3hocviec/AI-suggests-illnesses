import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateDirectChatRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  doctorId: number;
}
