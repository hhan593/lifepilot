import type { TodoPriority, WeeklyReportPayload } from '@lifepilot/shared';

export interface TodoData {
  id: string;
  title: string;
  notes: string | null;
  priority: TodoPriority;
  dueAt: string | null;
  completedAt: string | null;
}

export interface WaterSummary {
  date: string;
  totalMl: number;
  hydrationMl: number;
  goalMl: number;
  percent: number;
  remainingMl: number;
  logCount: number;
}

export interface HabitWithStatus {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetPerWeek: number;
  today: string;
  todayChecked: boolean;
  streak: {
    streakWeeks: number;
    thisWeekCount: number;
    achievedThisWeek: boolean;
    weeks: { weekStart: string; count: number; achieved: boolean }[];
  };
}

export interface UserSettingsData {
  weightKg: number | null;
  activityLevel: string;
  waterGoalMl: number;
  cupSizeMl: number;
  waterReminderEnabled: boolean;
  waterReminderTimes: string[];
  quietStart: string;
  quietEnd: string;
  weeklyReportDay: number;
  weeklyReportHour: number;
  aiWeeklyReport: boolean;
}

export interface MeData {
  id: string;
  email: string;
  timezone: string;
  settings: UserSettingsData;
}

export interface CityData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isPrimary: boolean;
}

export interface GeocodeItem {
  name: string;
  label: string;
  latitude: number;
  longitude: number;
}

export type { WeeklyReportPayload };
