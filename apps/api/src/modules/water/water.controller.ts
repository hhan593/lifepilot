import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateWaterLogDto } from './dto/water.dto';
import { WaterService } from './water.service';

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
  logs(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.waterService.listLogs(user.id, date);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.waterService.summary(user.id, date);
  }
}
