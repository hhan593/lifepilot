import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';
import { ACTIVITY_LEVELS } from '@lifepilot/shared';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 65, description: '体重 kg，提供后自动重算饮水目标' })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(200)
  weightKg?: number;

  @ApiPropertyOptional({ enum: ACTIVITY_LEVELS })
  @IsOptional()
  @IsEnum(ACTIVITY_LEVELS)
  activityLevel?: (typeof ACTIVITY_LEVELS)[number];

  @ApiPropertyOptional({ example: 2200, description: '手动指定的每日饮水目标 ml' })
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(6000)
  waterGoalMl?: number;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(1000)
  cupSizeMl?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  waterReminderEnabled?: boolean;

  @ApiPropertyOptional({ example: ['10:00', '15:00'], maxItems: 12 })
  @IsOptional()
  @IsString({ each: true })
  @Matches(HHMM, { each: true, message: '提醒时间需为 HH:MM 格式' })
  @ArrayMaxSize(12)
  @ArrayUnique()
  waterReminderTimes?: string[];

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Matches(HHMM)
  quietStart?: string;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @Matches(HHMM)
  quietEnd?: string;

  @ApiPropertyOptional({ example: 5, description: '周报生成日 1=周一 … 7=周日' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  weeklyReportDay?: number;

  @ApiPropertyOptional({ example: 17 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  weeklyReportHour?: number;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Asia/Shanghai' })
  @IsOptional()
  @MinLength(1)
  @MaxLength(64)
  timezone?: string;
}

export class SettingsResponseDto extends PartialType(UpdateSettingsDto) {}
