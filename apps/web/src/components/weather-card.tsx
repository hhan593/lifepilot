"use client";

import Link from "next/link";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Moon,
  Sun,
  Wind,
} from "lucide-react";
import type { CityWeather, WeatherIcon } from "@lifepilot/shared";

const ICONS: Record<WeatherIcon, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  sleet: CloudHail,
  thunder: CloudLightning,
};

export function WeatherCard({ data }: { data: CityWeather | null }) {
  if (!data) {
    return (
      <div className="card flex items-center justify-between">
        <div>
          <p className="section-title">还没有天气数据</p>
          <p className="mt-1 text-sm text-zinc-500">去设置里添加一个城市吧</p>
        </div>
        <Link href="/app/settings" className="btn-ghost">
          添加城市
        </Link>
      </div>
    );
  }

  const Icon = ICONS[data.current.icon] ?? Cloud;
  const today = data.daily[0];

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{data.city.name}</p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-5xl font-bold tracking-tight">{data.current.temperature}°</span>
            <div className="flex items-center gap-1.5 text-sm text-zinc-600">
              <Icon className="size-5 text-amber-500" />
              {data.current.label}
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            {today ? `${today.tempMin}° / ${today.tempMax}°` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-zinc-400">
          <span className="flex items-center gap-1">
            <Droplets className="size-3.5" /> {data.current.humidity}%
          </span>
          <span className="flex items-center gap-1">
            <Wind className="size-3.5" /> {data.current.windSpeed} km/h
          </span>
          <span>体感 {data.current.apparentTemperature}°</span>
        </div>
      </div>

      {/* 逐小时 */}
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {data.hourly.map((h) => {
          const HIcon = ICONS[h.icon] ?? Cloud;
          const hour = h.time.slice(11, 13);
          return (
            <div key={h.time} className="flex w-11 shrink-0 flex-col items-center gap-1 text-xs">
              <span className="text-zinc-400">{`${Number(hour)}时`}</span>
              <HIcon className="size-4 text-zinc-500" />
              <span className="font-medium">{h.temperature}°</span>
              {h.precipitationProbability > 20 && (
                <span className="text-sky-500">{h.precipitationProbability}%</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 未来 5 日 */}
      <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3">
        {data.daily.map((d) => {
          const DIcon = ICONS[d.icon] ?? Cloud;
          const label = new Date(`${d.date}T00:00:00`).toLocaleDateString("zh-CN", {
            weekday: "short",
          });
          return (
            <div key={d.date} className="flex items-center gap-3 text-sm">
              <span className="w-8 text-zinc-400">{label}</span>
              <DIcon className="size-4 text-zinc-500" />
              <span className="text-zinc-500">{d.label}</span>
              {d.precipitationProbability > 20 && (
                <span className="text-xs text-sky-500">{d.precipitationProbability}%</span>
              )}
              <span className="ml-auto tabular-nums text-zinc-400">
                {d.tempMin}° / <span className="text-zinc-600">{d.tempMax}°</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
