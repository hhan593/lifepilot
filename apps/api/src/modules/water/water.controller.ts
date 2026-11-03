import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateWaterLogDto } from './dto/water.dto';
import { WaterService } from './water.service';

export class DateQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date 需为 yyyy-MM-dd 格式' })
  date?: string;
}

@ApiBearerAuth()
@ApiTags('water')
@Controller('water')
export class WaterController {
  constructor(private readonly waterService: WaterService) {}

  @Post('logs')
  log(@CurrentUser() user: AuthUser, @Body() dto: CreateWaterLogDto) {
    return this.waterService.log(user.id, dto);
  }

  /** 一键 + 一杯 */
  @Post('quick')
  quickAdd(@CurrentUser() user: AuthUser) {
    return this.waterService.quickAdd(user.id);
  }

  @Get('logs')
  logs(@CurrentUser() user: AuthUser, @Query() dto: DateQueryDto) {
    return this.waterService.listLogs(user.id, dto.date);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() dto: DateQueryDto) {
    return this.waterService.summary(user.id, dto.date);
  }
}
