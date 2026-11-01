import { Text, View } from 'react-native';
import type { CityWeather, WeatherIcon } from '@lifepilot/shared';

const ICONS: Record<WeatherIcon, string> = {
  sun: '☀️',
  moon: '🌙',
  'cloud-sun': '⛅',
  'cloud-moon': '☁️',
  cloud: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '❄️',
  sleet: '🌨️',
  thunder: '⛈️',
};

export function WeatherCard({ data }: { data: CityWeather | null }) {
  if (!data) {
    return (
      <View className="rounded-2xl border border-zinc-200 bg-white p-4">
        <Text className="text-sm font-semibold text-zinc-900">还没有天气数据</Text>
        <Text className="mt-1 text-sm text-zinc-500">去「设置」里添加一个城市吧</Text>
      </View>
    );
  }

  const c = data.current;
  const today = data.daily[0];

  return (
    <View className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm font-medium text-zinc-500">{data.city.name}</Text>
          <View className="mt-1 flex-row items-baseline gap-2">
            <Text className="text-5xl font-bold text-zinc-900">{c.temperature}°</Text>
            <Text className="text-base">{ICONS[c.icon] ?? '☁️'}</Text>
            <Text className="text-sm text-zinc-600">{c.label}</Text>
          </View>
          {today ? (
            <Text className="mt-1 text-xs text-zinc-400">
              {today.tempMin}° / {today.tempMax}°
            </Text>
          ) : null}
        </View>
        <View className="items-end gap-0.5">
          <Text className="text-xs text-zinc-400">湿度 {c.humidity}%</Text>
          <Text className="text-xs text-zinc-400">风速 {c.windSpeed} km/h</Text>
          <Text className="text-xs text-zinc-400">体感 {c.apparentTemperature}°</Text>
        </View>
      </View>

      {/* 逐小时 */}
      <View className="mt-4 flex-row gap-3">
        {data.hourly.slice(0, 12).map((h) => (
          <View key={h.time} className="w-10 items-center gap-1">
            <Text className="text-xs text-zinc-400">{Number(h.time.slice(11, 13))}时</Text>
            <Text style={{ fontSize: 13 }}>{ICONS[h.icon] ?? '☁️'}</Text>
            <Text className="text-xs font-medium text-zinc-700">{h.temperature}°</Text>
          </View>
        ))}
      </View>

      {/* 未来 5 日 */}
      <View className="mt-3 gap-1.5 border-t border-zinc-100 pt-3">
        {data.daily.map((d, i) => (
          <View key={d.date} className="flex-row items-center gap-3">
            <Text className="w-8 text-xs text-zinc-400">{i === 0 ? '今天' : weekday(d.date)}</Text>
            <Text style={{ fontSize: 13 }}>{ICONS[d.icon] ?? '☁️'}</Text>
            <Text className="text-sm text-zinc-500">{d.label}</Text>
            <Text className="ml-auto tabular-nums text-xs text-zinc-400">
              {d.tempMin}° / {d.tempMax}°
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function weekday(date: string): string {
  return '周' + '日一二三四五六'[new Date(`${date}T00:00:00`).getDay()];
}
