// ---- 待办优先级 ----
export const TODO_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export const PRIORITY_LABEL: Record<TodoPriority, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  URGENT: "紧急",
};

// ---- 饮品与水分折算系数（WaterMinder 式个性化折算）----
export const DRINK_TYPES = [
  "WATER",
  "TEA",
  "COFFEE",
  "JUICE",
  "MILK",
  "SODA",
  "OTHER",
] as const;
export type DrinkType = (typeof DRINK_TYPES)[number];

export const DRINK_LABEL: Record<DrinkType, string> = {
  WATER: "水",
  TEA: "茶",
  COFFEE: "咖啡",
  JUICE: "果汁",
  MILK: "牛奶",
  SODA: "汽水",
  OTHER: "其他",
};

export const HYDRATION_COEFFICIENT: Record<DrinkType, number> = {
  WATER: 1.0,
  TEA: 0.98,
  COFFEE: 0.9,
  JUICE: 0.95,
  MILK: 0.9,
  SODA: 0.9,
  OTHER: 1.0,
};

// ---- 个性化饮水目标计算 ----
export const ACTIVITY_LEVELS = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  SEDENTARY: "久坐",
  LIGHT: "轻度活动",
  MODERATE: "中等活动",
  ACTIVE: "高强度",
};

const ACTIVITY_BONUS_ML: Record<ActivityLevel, number> = {
  SEDENTARY: 0,
  LIGHT: 250,
  MODERATE: 500,
  ACTIVE: 750,
};

/** 按体重 + 活动量计算每日饮水目标（33ml/kg + 活动加成，向上取整到 50ml） */
export function calcWaterGoalMl(weightKg: number, level: ActivityLevel = "LIGHT"): number {
  const raw = weightKg * 33 + ACTIVITY_BONUS_ML[level];
  return Math.min(5000, Math.max(1200, Math.round(raw / 50) * 50));
}

// ---- WMO 天气代码 → 中文描述 + 图标 key（前后端共用）----
export type WeatherIcon =
  | "sun"
  | "moon"
  | "cloud-sun"
  | "cloud-moon"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "sleet"
  | "thunder";

export const WEATHER_CODE_INFO: Record<number, { label: string; icon: WeatherIcon }> = {
  0: { label: "晴", icon: "sun" },
  1: { label: "基本晴", icon: "cloud-sun" },
  2: { label: "多云", icon: "cloud-sun" },
  3: { label: "阴", icon: "cloud" },
  45: { label: "雾", icon: "fog" },
  48: { label: "雾凇", icon: "fog" },
  51: { label: "小毛毛雨", icon: "drizzle" },
  53: { label: "毛毛雨", icon: "drizzle" },
  55: { label: "大毛毛雨", icon: "drizzle" },
  56: { label: "冻毛毛雨", icon: "sleet" },
  57: { label: "冻毛毛雨", icon: "sleet" },
  61: { label: "小雨", icon: "rain" },
  63: { label: "中雨", icon: "rain" },
  65: { label: "大雨", icon: "rain" },
  66: { label: "冻雨", icon: "sleet" },
  67: { label: "冻雨", icon: "sleet" },
  71: { label: "小雪", icon: "snow" },
  73: { label: "中雪", icon: "snow" },
  75: { label: "大雪", icon: "snow" },
  77: { label: "米雪", icon: "snow" },
  80: { label: "小阵雨", icon: "rain" },
  81: { label: "阵雨", icon: "rain" },
  82: { label: "强阵雨", icon: "rain" },
  85: { label: "小阵雪", icon: "snow" },
  86: { label: "大阵雪", icon: "snow" },
  95: { label: "雷阵雨", icon: "thunder" },
  96: { label: "雷阵雨伴冰雹", icon: "thunder" },
  99: { label: "强雷雨伴冰雹", icon: "thunder" },
};

export function weatherInfo(code: number, isDay = true): { label: string; icon: WeatherIcon } {
  const info = WEATHER_CODE_INFO[code] ?? { label: "未知", icon: "cloud" as const };
  // 夜间把太阳类图标换成月亮
  if (!isDay && info.icon === "sun") return { ...info, icon: "moon" };
  if (!isDay && info.icon === "cloud-sun") return { ...info, icon: "cloud-moon" };
  return info;
}

// ---- 天气数据结构（Open-Meteo 映射后的统一返回）----
export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  label: string;
  icon: WeatherIcon;
  isDay: boolean;
}

export interface HourlyPoint {
  time: string; // 本地时间 "YYYY-MM-DDTHH:00"
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
  label: string;
  icon: WeatherIcon;
}

export interface DailyPoint {
  date: string; // 本地日期 "YYYY-MM-DD"
  weatherCode: number;
  label: string;
  icon: WeatherIcon;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
}

export interface CityWeather {
  city: { id: string; name: string };
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
}

// ---- 周报 ----
export interface WeeklyReportPayload {
  weekStart: string;
  weekEnd: string;
  score: number;
  grade: "S" | "A" | "B" | "C";
  title: string;
  personaSummary: string;
  todos: {
    created: number;
    completed: number;
    open: number;
    completionRate: number;
    dailyCompleted: number[];
    topCompleted: { id: string; title: string; priority: TodoPriority }[];
  };
  water: {
    goalMl: number;
    avgMlPerDay: number;
    goalHitDays: number;
    dailyMl: number[];
    bestDayIndex: number;
    drinkBreakdown: { type: DrinkType; amountMl: number; percentage: number }[];
  };
  habits: {
    id: string;
    name: string;
    icon: string;
    color: string;
    targetPerWeek: number;
    done: number;
    achieved: boolean;
    dailyStatus: boolean[];
  }[];
  highlights: string[];
  suggestions: string[];
  markdown: string;
}

export interface WeeklyReportSummary {
  weekStart: string;
  weekEnd: string;
  score: number;
  grade: "S" | "A" | "B" | "C";
  title: string;
  completionRate: number;
  generatedAt: string;
}

// ---- Web Push 通知载荷 ----
export interface PushPayload {
  kind: "water" | "weekly" | "todo";
  title: string;
  body: string;
  url: string;
}

/** 本地时区的 yyyy-MM-dd（toISOString 是 UTC，UTC+ 时区会回退一天 —— 周报翻页/今日判断必须用本地日期） */
export function formatLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 以本地日期为刻度平移 N 天，返回 yyyy-MM-dd（isoDate 需为 yyyy-MM-dd） */
export function shiftLocalDate(isoDate: string, deltaDays: number): string {
  const [y, m, day] = isoDate.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, day ?? 1);
  d.setDate(d.getDate() + deltaDays);
  return formatLocalDate(d);
}
