import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TODO_PRIORITIES } from '@lifepilot/shared';

export class CreateTodoDto {
  @ApiProperty({ example: '和老板对齐 Q4 目标', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: '记得带上周报数据' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: TODO_PRIORITIES, default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(TODO_PRIORITIES)
  priority?: (typeof TODO_PRIORITIES)[number];

  @ApiPropertyOptional({ example: '2026-11-02T09:00:00.000Z', nullable: true })
  @IsOptional()
  @IsISO8601()
  dueAt?: string | null;
}

export class UpdateTodoDto extends PartialType(CreateTodoDto) {
  @ApiPropertyOptional({ description: '传 true 完成，false 恢复' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
