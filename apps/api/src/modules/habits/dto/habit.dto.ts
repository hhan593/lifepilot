import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateHabitDto {
  @ApiProperty({ example: '每天读书 30 分钟', maxLength: 30 })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;

  @ApiPropertyOptional({ example: '📚' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;

  @ApiPropertyOptional({ example: '#6366f1' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 7, description: '每周目标次数（宽容连击按周计）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  targetPerWeek?: number;
}
