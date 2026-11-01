import { CurrentWeather, DailyPoint, HourlyPoint } from '@lifepilot/shared';

export interface GeocodeResult {
  name: string;
  /** 展示用：城市, 省份, 国家 */
  label: string;
  latitude: number;
  longitude: number;
}

export interface Forecast {
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
}

/**
 * 天气 Provider 适配层：MVP 用 Open-Meteo（免费无 key），
 * 后续可加 QWeatherProvider（国内分钟级降水）无缝替换。
 * 用抽象类作 DI token（接口在运行时不存在）。
 */
export abstract class WeatherProvider {
  abstract geocode(query: string, lang?: string): Promise<GeocodeResult[]>;
  abstract getForecast(latitude: number, longitude: number): Promise<Forecast>;
}
