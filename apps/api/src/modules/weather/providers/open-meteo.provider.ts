import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { weatherInfo } from '@lifepilot/shared';
import { Forecast, GeocodeResult, WeatherProvider } from './weather-provider.interface';

interface OpenMeteoForecastResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: (number | null)[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
  };
}

interface OpenMeteoGeocodeResponse {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }[];
}

@Injectable()
export class OpenMeteoProvider extends WeatherProvider {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async geocode(query: string, lang = 'zh'): Promise<GeocodeResult[]> {
    const url = new URL(`${this.config.get<string>('GEOCODING_BASE_URL')}/search`);
    url.searchParams.set('name', query);
    url.searchParams.set('count', '5');
    url.searchParams.set('language', lang);
    url.searchParams.set('format', 'json');

    const data = await this.getJson<OpenMeteoGeocodeResponse>(url);
    return (data.results ?? []).map((r) => ({
      name: r.name,
      label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  }

  async getForecast(latitude: number, longitude: number): Promise<Forecast> {
    const url = new URL(`${this.config.get<string>('OPEN_METEO_BASE_URL')}/forecast`);
    url.searchParams.set('latitude', latitude.toFixed(4));
    url.searchParams.set('longitude', longitude.toFixed(4));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    );
    url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability');
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '5');

    const data = await this.getJson<OpenMeteoForecastResponse>(url);

    const c = data.current;
    const isDay = c.is_day === 1;
    const info = weatherInfo(c.weather_code, isDay);

    const hourly = data.hourly.time.slice(0, 24).map((time, i) => {
      const hInfo = weatherInfo(data.hourly.weather_code[i] ?? 0, true);
      return {
        time,
        temperature: Math.round(data.hourly.temperature_2m[i] ?? 0),
        precipitationProbability: data.hourly.precipitation_probability[i] ?? 0,
        weatherCode: data.hourly.weather_code[i] ?? 0,
        label: hInfo.label,
        icon: hInfo.icon,
      };
    });

    const daily = data.daily.time.map((date, i) => {
      const dInfo = weatherInfo(data.daily.weather_code[i] ?? 0, true);
      return {
        date,
        weatherCode: data.daily.weather_code[i] ?? 0,
        label: dInfo.label,
        icon: dInfo.icon,
        tempMax: Math.round(data.daily.temperature_2m_max[i] ?? 0),
        tempMin: Math.round(data.daily.temperature_2m_min[i] ?? 0),
        precipitationProbability: data.daily.precipitation_probability_max[i] ?? 0,
      };
    });

    return {
      current: {
        temperature: Math.round(c.temperature_2m),
        apparentTemperature: Math.round(c.apparent_temperature),
        humidity: Math.round(c.relative_humidity_2m),
        windSpeed: Math.round(c.wind_speed_10m),
        weatherCode: c.weather_code,
        label: info.label,
        icon: info.icon,
        isDay,
      },
      hourly,
      daily,
    };
  }

  private async getJson<T>(url: URL): Promise<T> {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`Open-Meteo 请求失败: ${res.status} ${url.pathname}`);
    }
    return (await res.json()) as T;
  }
}
