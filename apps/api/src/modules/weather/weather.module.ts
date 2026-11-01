import { Module } from '@nestjs/common';
import { OpenMeteoProvider } from './providers/open-meteo.provider';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';
import { WeatherProvider } from './providers/weather-provider.interface';

@Module({
  controllers: [WeatherController],
  providers: [{ provide: WeatherProvider, useClass: OpenMeteoProvider }, WeatherService],
  exports: [WeatherService, WeatherProvider],
})
export class WeatherModule {}
