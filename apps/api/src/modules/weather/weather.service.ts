import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { CityWeather } from '@lifepilot/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Forecast, WeatherProvider } from './providers/weather-provider.interface';

const CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class WeatherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: WeatherProvider,
  ) {}

  /** cityId 不传时用主城市；无任何城市时抛 404 */
  async getWeather(userId: string, cityId?: string): Promise<CityWeather> {
    const city = cityId
      ? await this.prisma.city.findFirst({ where: { id: cityId, userId } })
      : await this.prisma.city.findFirst({ where: { userId, isPrimary: true } });

    if (!city) {
      const any = await this.prisma.city.findFirst({ where: { userId } });
      if (!any) throw new NotFoundException('还没有添加城市，请先在设置中添加');
      return this.withCache(any);
    }
    return this.withCache(city);
  }

  private async withCache(city: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }): Promise<CityWeather> {
    const key = `${city.latitude.toFixed(2)},${city.longitude.toFixed(2)}`;

    const cached = await this.prisma.weatherCache.findUnique({ where: { key } });
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return { city: { id: city.id, name: city.name }, ...(cached.payload as unknown as Forecast) };
    }

    let forecast: Forecast;
    try {
      forecast = await this.provider.getForecast(city.latitude, city.longitude);
    } catch (err) {
      // 源站故障时降级返回过期缓存
      if (cached) {
        return { city: { id: city.id, name: city.name }, ...(cached.payload as unknown as Forecast) };
      }
      throw new BadGatewayException(
        `天气服务暂时不可用: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    await this.prisma.weatherCache.upsert({
      where: { key },
      create: {
        key,
        payload: forecast as unknown as Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
      update: { payload: forecast as unknown as Prisma.InputJsonValue, fetchedAt: new Date() },
    });

    return { city: { id: city.id, name: city.name }, ...forecast };
  }
}
