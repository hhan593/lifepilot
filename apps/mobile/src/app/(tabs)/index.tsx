import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, post } from '@/lib/api';
import { WeatherCard } from '@/components/weather-card';
import { WaterRing } from '@/components/water-ring';
import { TodoItem } from '@/components/todo-item';
import type { CityWeather } from '@lifepilot/shared';
import type { HabitWithStatus, TodoData, WaterSummary } from '@/lib/types';

export default function TodayScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [newTodo, setNewTodo] = useState('');

  const weather = useQuery({
    queryKey: ['weather'],
    queryFn: () =>
      api<CityWeather>('/weather').catch((err: { status?: number }) =>
        err.status === 404 ? null : Promise.reject(err),
      ),
  });
  const todos = useQuery({
    queryKey: ['todos', 'today'],
    queryFn: () => api<TodoData[]>('/todos?view=today'),
  });
  const water = useQuery({
    queryKey: ['water', 'summary'],
    queryFn: () => api<WaterSummary>('/water/summary'),
  });
  const habits = useQuery({
    queryKey: ['habits'],
    queryFn: () => api<HabitWithStatus[]>('/habits'),
  });

  const addTodo = useMutation({
    mutationFn: (title: string) => post('/todos', { title }),
    onSuccess: () => {
      setNewTodo('');
      void queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
  const toggleTodo = useMutation({
    mutationFn: (input: { id: string; completed: boolean }) =>
      api(`/todos/${input.id}`, { method: 'PATCH', body: JSON.stringify({ completed: input.completed }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });
  const quickWater = useMutation({
    mutationFn: (amountMl: number) => post('/water/logs', { amountMl }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['water'] }),
  });
  const toggleHabit = useMutation({
    mutationFn: (id: string) => post(`/habits/${id}/check-ins`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['habits'] }),
  });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? '夜深了' : hour < 11 ? '早安' : hour < 14 ? '午安' : hour < 18 ? '下午好' : '晚上好';
  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`;
  const todayTodos = todos.data ?? [];
  const w = water.data;

  return (
    <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text className="text-xl font-bold text-zinc-900">
        {greeting}
        <Text className="ml-2 text-sm font-normal text-zinc-400"> {dateLabel}</Text>
      </Text>

      <View className="mt-4 gap-4">
        {weather.data !== undefined ? <WeatherCard data={weather.data} /> : null}

        <View className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <Text className="text-sm font-semibold text-zinc-900">
            今日待办{todayTodos.length > 0 ? `  ${todayTodos.length} 项` : ''}
          </Text>
          <View className="mt-3 flex-row gap-2">
            <TextInput
              className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm"
              placeholder="加一个待办，回车保存"
              value={newTodo}
              onChangeText={setNewTodo}
              onSubmitEditing={() => newTodo.trim() && addTodo.mutate(newTodo.trim())}
              returnKeyType="done"
            />
            <Pressable
              className="items-center justify-center rounded-xl bg-brand-600 px-4"
              onPress={() => newTodo.trim() && addTodo.mutate(newTodo.trim())}
            >
              <Text className="text-sm font-semibold text-white">添加</Text>
            </Pressable>
          </View>

          <View className="mt-1">
            {todayTodos.slice(0, 6).map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                onToggle={(todo, completed) => toggleTodo.mutate({ id: todo.id, completed })}
              />
            ))}
            {todayTodos.length === 0 ? (
              <Text className="py-4 text-center text-sm text-zinc-400">今天没有待办，享受当下 🌿</Text>
            ) : null}
          </View>
          {todayTodos.length > 6 ? (
            <Pressable onPress={() => router.push('/todos')}>
              <Text className="mt-1 text-center text-xs text-brand-600">
                还有 {todayTodos.length - 6} 项，查看全部
              </Text>
            </Pressable>
          ) : null}
        </View>

        {w ? (
          <View className="flex-row items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <WaterRing hydrationMl={w.hydrationMl} goalMl={w.goalMl} percent={w.percent} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-zinc-900">喝水打卡</Text>
              <Text className="mt-1 text-sm text-zinc-500">
                {w.remainingMl > 0 ? `还差 ${w.remainingMl.toLocaleString()}ml 达标` : '今日已达标，棒！🎉'}
              </Text>
              <View className="mt-3 flex-row gap-2">
                <Pressable className="rounded-xl border border-zinc-200 px-3 py-1.5" onPress={() => quickWater.mutate(250)}>
                  <Text className="text-xs text-zinc-700">+250ml</Text>
                </Pressable>
                <Pressable className="rounded-xl border border-zinc-200 px-3 py-1.5" onPress={() => quickWater.mutate(500)}>
                  <Text className="text-xs text-zinc-700">+500ml</Text>
                </Pressable>
                <Pressable className="rounded-xl bg-brand-600 px-3 py-1.5" onPress={() => quickWater.mutate(250)}>
                  <Text className="text-xs font-semibold text-white">记一杯</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View>
          <Text className="mb-2 text-sm font-semibold text-zinc-900">今日习惯</Text>
          {(habits.data ?? []).length === 0 ? (
            <View className="rounded-2xl border border-zinc-200 bg-white p-4">
              <Text className="text-center text-sm text-zinc-400">
                还没有习惯，去「习惯」页创建一个 👇
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              {(habits.data ?? []).map((h) => (
                <Pressable
                  key={h.id}
                  className="w-[47%] flex-1 items-center rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                  onPress={() => toggleHabit.mutate(h.id)}
                >
                  <Text className="text-3xl">{h.icon}</Text>
                  <Text numberOfLines={1} className="mt-1.5 text-xs font-medium text-zinc-900">
                    {h.name}
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-zinc-400">
                    {h.streak.streakWeeks > 0
                      ? `🔥 连击 ${h.streak.streakWeeks} 周`
                      : `本周 ${h.streak.thisWeekCount}/${h.targetPerWeek}`}
                  </Text>
                  <View
                    className={`mt-2 size-9 items-center justify-center rounded-full border-2 ${
                      h.todayChecked ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-200'
                    }`}
                  >
                    <Text className={h.todayChecked ? 'text-white' : 'text-zinc-300'}>✓</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
