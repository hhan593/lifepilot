import { Module } from '@nestjs/common';
import { WeatherModule } from '../weather/weather.module';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';

@Module({
  imports: [WeatherModule],
  controllers: [CitiesController],
  providers: [CitiesService],
})
export class CitiesModule {}
