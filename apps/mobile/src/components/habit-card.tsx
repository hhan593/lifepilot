import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from '@/lib/api';
import type { HabitWithStatus } from '@/lib/types';

interface HistoryDay {
  date: string;
  checked: boolean;
}

export function HabitCard({
  habit,
  onToggle,
  onDelete,
}: {
  habit: HabitWithStatus;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  // 与 Web 版一致拉取打卡历史：只看 todayChecked 时过去 6 天永远灰色，与 streak 数据矛盾
  const history = useQuery({
    queryKey: ['habit-history', habit.id],
    queryFn: () => api<HistoryDay[]>(`/habits/${habit.id}/history`),
  });
  const last7 = recentDays(7);
  const checkedSet = new Set<string>((history.data ?? []).filter((d) => d.checked).map((d) => d.date));
  if (habit.todayChecked) checkedSet.add(habit.today);

  return (
    <View className="overflow-hidden rounded-3xl bg-white p-4 shadow-xs border border-zinc-200/80">
      <View className="flex-row items-center gap-3">
        {/* 图标 */}
        <View className="size-11 items-center justify-center rounded-2xl bg-zinc-50 border border-zinc-100">
          <Text className="text-2xl">{habit.icon}</Text>
        </View>

        {/* 详情 */}
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-xs font-bold text-zinc-900">
            {habit.name}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Text className="text-[11px] font-semibold text-zinc-500">
              本周 {habit.streak.thisWeekCount}/{habit.targetPerWeek} 次
            </Text>
            {habit.streak.streakWeeks > 0 && (
              <View className="rounded-md bg-amber-50 px-1.5 py-0.5 border border-amber-200/60">
                <Text className="text-[9px] font-bold text-amber-700">
                  🔥 连击 {habit.streak.streakWeeks} 周
                </Text>
              </View>
            )}
            {habit.streak.achievedThisWeek && (
              <View className="rounded-md bg-emerald-50 px-1.5 py-0.5 border border-emerald-200/60">
                <Text className="text-[9px] font-bold text-emerald-700">达标</Text>
              </View>
            )}
          </View>
        </View>

        {/* 删除 */}
        <Pressable onPress={onDelete} hitSlop={8} className="px-1">
          <Text className="text-xs text-zinc-300">✕</Text>
        </Pressable>

        {/* 今日打卡按键 */}
        <Pressable
          onPress={onToggle}
          className={`size-10 items-center justify-center rounded-2xl border-2 transition-all ${
            habit.todayChecked
              ? 'border-emerald-500 bg-emerald-500 shadow-2xs'
              : 'border-zinc-200 bg-zinc-50 active:bg-zinc-100'
          }`}
          hitSlop={6}
        >
          <Text className={`text-sm font-bold ${habit.todayChecked ? 'text-white' : 'text-zinc-300'}`}>
            ✓
          </Text>
        </Pressable>
      </View>

      {/* 底部 7 日连续性追踪条 */}
      <View className="mt-3 flex-row gap-1.5 border-t border-zinc-100 pt-3">
        {last7.map((d) => (
          <View key={d.date} className="flex-1 items-center gap-1">
            <Text className="text-[9px] font-semibold text-zinc-400">{d.label}</Text>
            <View
              className={`size-2.5 rounded-full ${
                checkedSet.has(d.date) ? 'bg-emerald-500' : 'bg-zinc-200'
              }`}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function recentDays(n: number): { date: string; label: string }[] {
  const out: { date: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      date: d.toLocaleDateString('sv-SE'),
      label: '周' + '日一二三四五六'[d.getDay()],
    });
  }
  return out;
}
