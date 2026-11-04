import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCityDto {
  @ApiProperty({ example: '北京' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 39.9042 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 116.4074 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ example: '北京, 北京市, 中国' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class SetPrimaryDto {
  @ApiProperty()
  @IsBoolean()
  isPrimary!: boolean;
}
