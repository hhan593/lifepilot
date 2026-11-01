import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { DRINK_TYPES } from '@lifepilot/shared';

export class CreateWaterLogDto {
  @ApiProperty({ example: 250 })
  @IsInt()
  @Min(10)
  @Max(2000)
  amountMl!: number;

  @ApiPropertyOptional({ enum: DRINK_TYPES, default: 'WATER' })
  @IsOptional()
  @IsEnum(DRINK_TYPES)
  drinkType?: (typeof DRINK_TYPES)[number];

  @ApiPropertyOptional({ description: '不传默认当前时间' })
  @IsOptional()
  @IsDateString()
  loggedAt?: string;
}
