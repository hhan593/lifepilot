import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
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
  latest(@CurrentUser() user: AuthUser) {
    return this.reportsService.latest(user.id);
  }

  @Post('weekly/generate')
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateReportDto) {
    return this.reportsService.generate(user.id, dto.weekStart);
  }
}
