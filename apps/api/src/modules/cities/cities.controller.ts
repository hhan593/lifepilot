import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchQueryDto {
  @IsString({ message: 'q 必须是字符串' })
  @MinLength(1, { message: 'q 不能为空' })
  @MaxLength(100, { message: 'q 最长 100 字符' })
  q!: string;
}
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateCityDto } from './dto/city.dto';
import { CitiesService } from './cities.service';

@ApiBearerAuth()
@ApiTags('cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.citiesService.list(user.id);
  }

  /** Open-Meteo 地理编码代理，q 支持中文（限制长度：坏输入不再透传外呼） */
  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query() dto: SearchQueryDto) {
    return this.citiesService.search(dto.q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCityDto) {
    return this.citiesService.create(user.id, dto);
  }

  @Patch(':id/primary')
  setPrimary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.citiesService.setPrimary(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.citiesService.remove(user.id, id);
  }
}
