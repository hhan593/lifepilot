import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { WeatherService } from './weather.service';

@ApiBearerAuth()
@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  current(@CurrentUser() user: AuthUser, @Query('cityId') cityId?: string) {
    return this.weatherService.getWeather(user.id, cityId);
  }
}
