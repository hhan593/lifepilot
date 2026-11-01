import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeocodeResult, WeatherProvider } from '../weather/providers/weather-provider.interface';
import { CreateCityDto } from './dto/city.dto';

@Injectable()
export class CitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherProvider: WeatherProvider,
  ) {}

  list(userId: string) {
    return this.prisma.city.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  search(query: string): Promise<GeocodeResult[]> {
    return this.weatherProvider.geocode(query);
  }

  async create(userId: string, dto: CreateCityDto) {
    const count = await this.prisma.city.count({ where: { userId } });
    return this.prisma.city.create({
      data: {
        userId,
        name: dto.label?.split(',')[0]?.trim() || dto.name,
        latitude: dto.latitude,
        longitude: dto.longitude,
        // 第一个城市自动设为默认
        isPrimary: count === 0,
      },
    });
  }

  async setPrimary(userId: string, cityId: string) {
    const city = await this.prisma.city.findFirst({ where: { id: cityId, userId } });
    if (!city) throw new NotFoundException('城市不存在');
    await this.prisma.$transaction([
      this.prisma.city.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } }),
      this.prisma.city.update({ where: { id: cityId }, data: { isPrimary: true } }),
    ]);
    return { ok: true };
  }

  async remove(userId: string, cityId: string) {
    const city = await this.prisma.city.findFirst({ where: { id: cityId, userId } });
    if (!city) throw new NotFoundException('城市不存在');
    await this.prisma.city.delete({ where: { id: cityId } });
    // 删掉默认城市后自动顶替
    if (city.isPrimary) {
      const next = await this.prisma.city.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (next) {
        await this.prisma.city.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }
    return { ok: true };
  }
}
