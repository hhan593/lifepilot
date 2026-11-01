import { Pressable, Text, View } from 'react-native';
import type { HabitWithStatus } from '@/lib/types';

export function HabitCard({
  habit,
  onToggle,
  onDelete,
}: {
  habit: HabitWithStatus;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const last7 = habit.streak.weeks.length > 0 ? recentDays(7) : [];
  const checkedSet = new Set<string>([...(habit.todayChecked ? [habit.today] : [])]);

  return (
    <View className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <View className="flex-row items-center gap-3">
        <Text className="text-3xl">{habit.icon}</Text>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-medium text-zinc-900">
            {habit.name}
          </Text>
          <Text className="mt-0.5 text-xs text-zinc-400">
            本周 {habit.streak.thisWeekCount}/{habit.targetPerWeek} 次
            {habit.streak.streakWeeks > 0 ? `  🔥 连击 ${habit.streak.streakWeeks} 周` : ''}
            {habit.streak.achievedThisWeek ? '  ✅ 已达成' : ''}
          </Text>
        </View>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text className="text-xs text-zinc-300">删除</Text>
        </Pressable>
        <Pressable
          onPress={onToggle}
          className={`size-10 items-center justify-center rounded-full border-2 ${
            habit.todayChecked ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-200'
          }`}
          hitSlop={6}
        >
          <Text className={habit.todayChecked ? 'text-white' : 'text-zinc-300'}>✓</Text>
        </Pressable>
      </View>

      <View className="mt-3 flex-row gap-1.5 border-t border-zinc-100 pt-3">
        {last7.map((d) => (
          <View key={d.date} className="flex-1 items-center gap-1">
            <Text className="text-[10px] text-zinc-400">{d.label}</Text>
            <View
              className={`size-2.5 rounded-full ${checkedSet.has(d.date) ? 'bg-emerald-500' : 'bg-zinc-200'}`}
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
