import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

class GenerateReportDto {
  @ApiPropertyOptional({ example: '2026-10-26' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  weekStart?: string;
}

@ApiBearerAuth()
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly')
  @ApiOperation({ summary: '获取某周或最新周报（如未生成且指定了日期则自动生成）' })
  latest(@CurrentUser() user: AuthUser, @Query('weekStart') weekStart?: string) {
    return this.reportsService.latest(user.id, weekStart);
  }

  @Get('history')
  @ApiOperation({ summary: '获取历史周报概览列表' })
  history(@CurrentUser() user: AuthUser) {
    return this.reportsService.history(user.id);
  }

  @Post('weekly/generate')
  @ApiOperation({ summary: '手动生成或重新生成周报' })
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateReportDto) {
    return this.reportsService.generate(user.id, dto.weekStart);
  }
}
